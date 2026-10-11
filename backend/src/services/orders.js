const { pool, withTransaction } = require('../config/db');
const { createOrderSchema, statusSchema } = require('../utils/validators');
const orderRepo = require('../repositories/orders');
const customerRepo = require('../repositories/customers');
const inventoryRepo = require('../repositories/inventory');

const buildError = (status, code, message, details = []) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const allowedTransitions = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

const mergeItems = (items) => {
  const map = new Map();

  items.forEach((item) => {
    const productId = Number(item.productId);
    const qty = Number(item.quantity);
    if (!map.has(productId)) {
      map.set(productId, qty);
      return;
    }
    map.set(productId, map.get(productId) + qty);
  });

  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
};

const listOrders = async (query = {}) => orderRepo.getOrders(query);

const getOrder = async (id, executor = pool) => {
  const order = await orderRepo.getOrderById(id, executor);
  if (!order) {
    throw buildError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  const items = await orderRepo.getOrderItems(id, executor);
  return { ...order, items };
};

const createOrder = async (payload) => {
  const parsed = createOrderSchema.parse(payload);
  const customer = await customerRepo.getCustomerById(parsed.customerId);
  if (!customer) {
    throw buildError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const merged = mergeItems(parsed.items);
  if (!merged.length) {
    throw buildError(400, 'INVALID_REQUEST', 'Order items are required');
  }

  const productIds = [...new Set(merged.map((item) => item.productId))].sort((a, b) => a - b);
  const placeholders = productIds.map(() => '?').join(', ');

  return withTransaction(async (connection) => {
    const [products] = await connection.query(
      `SELECT p.id, p.name, p.sku, p.price, p.is_active, i.quantity_on_hand
       FROM products p
       JOIN inventory i ON i.product_id = p.id
       WHERE p.id IN (${placeholders})
       ORDER BY p.id ASC
       FOR UPDATE`,
      productIds
    );

    const productMap = new Map(products.map((product) => [product.id, product]));
    const conflicts = [];

    merged.forEach((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        conflicts.push({ productId: item.productId, requested: item.quantity, available: 0, reason: 'PRODUCT_NOT_FOUND' });
        return;
      }
      if (product.is_active !== 1) {
        conflicts.push({ productId: item.productId, requested: item.quantity, available: product.quantity_on_hand, reason: 'INACTIVE_PRODUCT' });
        return;
      }
      if (product.quantity_on_hand < item.quantity) {
        conflicts.push({ productId: item.productId, requested: item.quantity, available: product.quantity_on_hand, reason: 'INSUFFICIENT_STOCK' });
      }
    });

    if (conflicts.length) {
      throw buildError(409, 'INSUFFICIENT_STOCK', 'Some items do not have enough stock', conflicts);
    }

    const totalAmount = merged.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return sum + Number(product.price) * Number(item.quantity);
    }, 0);

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const orderId = await orderRepo.createOrder(connection, { orderNumber, customerId: parsed.customerId, totalAmount });

    for (const item of merged) {
      const product = productMap.get(item.productId);
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * Number(item.quantity);

      await orderRepo.insertOrderItem(connection, orderId, {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal
      });
    }

    for (const item of merged) {
      await connection.query(
        'UPDATE inventory SET quantity_on_hand = quantity_on_hand - ?, updated_at = NOW() WHERE product_id = ?',
        [item.quantity, item.productId]
      );
      await inventoryRepo.addTransaction(connection, {
        productId: item.productId,
        changeQty: -item.quantity,
        reason: 'ORDER',
        orderId,
        note: `Order ${orderNumber}`
      });
    }

    await connection.query('UPDATE orders SET total_amount = ?, status = ?, updated_at = NOW() WHERE id = ?', [totalAmount, 'PENDING', orderId]);

    const resultOrder = await orderRepo.getOrderById(orderId, connection);
    const items = await orderRepo.getOrderItems(orderId, connection);
    return { ...resultOrder, items };
  });
};

const updateOrderStatus = async (id, payload) => {
  const { status } = statusSchema.parse(payload);
  await withTransaction(async (connection) => {
    const [orders] = await connection.query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!orders.length) {
      throw buildError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    const currentStatus = orders[0].status;
    const valid = allowedTransitions[currentStatus] || [];
    if (!valid.includes(status)) {
      throw buildError(409, 'INVALID_STATUS_TRANSITION', `Cannot move from ${currentStatus} to ${status}`);
    }

    await orderRepo.updateOrderStatus(connection, id, status);
  });

  return getOrder(id);
};

const cancelOrder = async (id) => {
  return withTransaction(async (connection) => {
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    const order = orders[0];
    if (!order) {
      throw buildError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw buildError(409, 'INVALID_STATUS_TRANSITION', 'This order cannot be cancelled');
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw buildError(409, 'INVALID_STATUS_TRANSITION', `Order status ${order.status} cannot be cancelled`);
    }

    const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ? FOR UPDATE', [id]);
    if (!items.length) {
      throw buildError(400, 'NO_ITEMS_FOUND', 'Order does not contain items');
    }

    const productIds = [...new Set(items.map((item) => item.product_id))].sort((a, b) => a - b);
    const [inventoryRows] = await connection.query(
      `SELECT i.*
       FROM inventory i
       WHERE i.product_id IN (${productIds.map(() => '?').join(', ')})
       ORDER BY i.product_id ASC
       FOR UPDATE`,
      productIds
    );

    const inventoryMap = new Map(inventoryRows.map((row) => [row.product_id, row]));

    for (const item of items) {
      const stockRecord = inventoryMap.get(item.product_id);
      if (!stockRecord) {
        throw buildError(404, 'PRODUCT_NOT_FOUND', 'Associated product inventory record not found');
      }

      await connection.query(
        'UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = NOW() WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
      await inventoryRepo.addTransaction(connection, {
        productId: item.product_id,
        changeQty: item.quantity,
        reason: 'CANCEL',
        orderId: id,
        note: `Cancelled order ${order.order_number}`
      });
    }

    await connection.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', ['CANCELLED', id]);

    return getOrder(id, connection);
  });
};

const getDashboardSummary = async () => {
  const [result, lowStock, recentOrders, salesTrend, orderStatusBreakdown] = await Promise.all([
    orderRepo.getDashboardSummary(),
    inventoryRepo.getLowStock(),
    orderRepo.getRecentOrders(),
    orderRepo.getSalesTrend(),
    orderRepo.getOrderStatusBreakdown()
  ]);
  return {
    ...result,
    lowStock,
    recentOrders,
    salesTrend,
    orderStatusBreakdown,
    pending_order_count: Number(orderStatusBreakdown.find((item) => item.status === 'PENDING')?.count || 0)
  };
};

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getDashboardSummary
};
