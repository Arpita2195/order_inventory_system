const { pool, withTransaction } = require('../config/db');
const inventoryRepo = require('../repositories/inventory');
const productRepo = require('../repositories/products');
const { inventoryRestockSchema, inventoryAdjustmentSchema } = require('../utils/validators');

const buildError = (status, code, message, details = []) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const listInventory = async (query) => inventoryRepo.listInventory(query);

const getLowStock = async () => inventoryRepo.getLowStock();

const getHistory = async (productId) => {
  const product = await productRepo.getProductById(productId);
  if (!product) {
    throw buildError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
  return inventoryRepo.getInventoryHistory(productId);
};

const restockProduct = async (productId, payload) => {
  const parsed = inventoryRestockSchema.parse(payload);
  const product = await productRepo.getProductById(productId);
  if (!product) {
    throw buildError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  return withTransaction(async (connection) => {
    await inventoryRepo.updateStock(connection, productId, parsed.quantity);
    await inventoryRepo.addTransaction(connection, {
      productId,
      changeQty: parsed.quantity,
      reason: 'RESTOCK',
      note: parsed.note || 'Inventory restock'
    });
    return inventoryRepo.getInventorySummary(connection);
  });
};

const adjustStock = async (productId, payload) => {
  const parsed = inventoryAdjustmentSchema.parse(payload);
  const product = await productRepo.getProductById(productId);
  if (!product) {
    throw buildError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  return withTransaction(async (connection) => {
    const current = await inventoryRepo.getInventoryByProduct(connection, productId);
    if (!current) {
      throw buildError(404, 'INVENTORY_NOT_FOUND', 'Inventory record not found');
    }

    if (current.quantity_on_hand + parsed.quantity < 0) {
      throw buildError(409, 'INSUFFICIENT_STOCK', 'Adjustment would make stock negative', [{
        productId,
        requested: parsed.quantity,
        available: current.quantity_on_hand
      }]);
    }

    await inventoryRepo.updateStock(connection, productId, parsed.quantity);
    await inventoryRepo.addTransaction(connection, {
      productId,
      changeQty: parsed.quantity,
      reason: 'ADJUSTMENT',
      note: parsed.note
    });
    return inventoryRepo.getInventorySummary(connection);
  });
};

module.exports = {
  listInventory,
  getLowStock,
  getHistory,
  restockProduct,
  adjustStock
};
