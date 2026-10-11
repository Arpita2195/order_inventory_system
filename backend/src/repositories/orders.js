const { pool } = require('../config/db');
const { createPaginatedResult } = require('../utils/pagination');

const getOrders = async ({ search = '', status = 'all', page = 1, limit = 10 } = {}) => {
  let where = 'WHERE 1 = 1';
  const values = [];

  if (search) {
    where += ' AND (o.order_number LIKE ? OR c.name LIKE ?)';
    const term = `%${search}%`;
    values.push(term, term);
  }

  if (status !== 'all') {
    where += ' AND o.status = ?';
    values.push(status);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT o.id) AS total FROM orders o JOIN customers c ON c.id = o.customer_id ${where}`,
    values
  );
  const [rows] = await pool.query(`
    SELECT o.*, c.name AS customer_name, COUNT(oi.id) AS item_count
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    ${where}
    GROUP BY o.id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT ? OFFSET ?
  `, [...values, limit, (page - 1) * limit]);
  return createPaginatedResult(rows, Number(countRows[0].total), { page, limit });
};

const getOrderById = async (id, executor = pool) => {
  const [rows] = await executor.query(
    `SELECT o.*, c.name AS customer_name, c.email, c.phone, c.address
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const getOrderItems = async (orderId, executor = pool) => {
  const [rows] = await executor.query(
    `SELECT oi.*, p.name AS product_name, p.sku
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return rows;
};

const getOrderByNumber = async (orderNumber) => {
  const [rows] = await pool.query('SELECT * FROM orders WHERE order_number = ? LIMIT 1', [orderNumber]);
  return rows[0] || null;
};

const createOrder = async (connection, orderData) => {
  const { orderNumber, customerId, totalAmount } = orderData;
  const [result] = await connection.query(
    'INSERT INTO orders (order_number, customer_id, status, total_amount) VALUES (?, ?, ?, ?)',
    [orderNumber, customerId, 'PENDING', Number(totalAmount)]
  );
  return result.insertId;
};

const insertOrderItem = async (connection, orderId, item) => {
  const { productId, quantity, unitPrice, lineTotal } = item;
  await connection.query(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
    [orderId, productId, quantity, Number(unitPrice), Number(lineTotal)]
  );
};

const updateOrderStatus = async (connection, id, status) => {
  await connection.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
};

const getCustomerOrderHistory = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT o.*, COUNT(oi.id) AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [customerId]
  );
  return rows;
};

const getDashboardSummary = async () => {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM products) AS total_products,
      (SELECT COUNT(*) FROM inventory i JOIN products p ON p.id = i.product_id WHERE i.quantity_on_hand <= i.reorder_level AND p.is_active = 1) AS low_stock_products,
      (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()) AS orders_today,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'CANCELLED') AS revenue
  `);
  return rows[0];
};

const getRecentOrders = async () => {
  const [rows] = await pool.query(
    `SELECT o.*, c.name AS customer_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC
     LIMIT 10`
  );
  return rows;
};

const getSalesTrend = async () => {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
           SUM(total_amount) AS revenue,
           COUNT(*) AS order_count
    FROM orders
    WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      AND status <> 'CANCELLED'
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')
  `);
  return rows;
};

const getOrderStatusBreakdown = async () => {
  const [rows] = await pool.query(`
    SELECT status, COUNT(*) AS count
    FROM orders
    GROUP BY status
    ORDER BY FIELD(status, 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
  `);
  return rows;
};

module.exports = {
  getOrders,
  getOrderById,
  getOrderItems,
  getOrderByNumber,
  createOrder,
  insertOrderItem,
  updateOrderStatus,
  getCustomerOrderHistory,
  getDashboardSummary,
  getRecentOrders,
  getSalesTrend,
  getOrderStatusBreakdown
};
