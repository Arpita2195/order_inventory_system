const inventoryService = require('../services/inventory');
const { sendSuccess, sendException } = require('../utils/response');

const getInventory = async (req, res) => {
  try {
    const data = await inventoryService.listInventory(req.validatedQuery);
    return sendSuccess(res, data, 'Inventory retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const getLowStock = async (req, res) => {
  try {
    const data = await inventoryService.getLowStock();
    return sendSuccess(res, data, 'Low stock products retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const restock = async (req, res) => {
  try {
    const data = await inventoryService.restockProduct(req.params.productId, req.body);
    return sendSuccess(res, data, 'Stock restocked successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const adjust = async (req, res) => {
  try {
    const data = await inventoryService.adjustStock(req.params.productId, req.body);
    return sendSuccess(res, data, 'Stock adjustment recorded successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const getHistory = async (req, res) => {
  try {
    const data = await inventoryService.getHistory(req.params.productId);
    return sendSuccess(res, data, 'Inventory history retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

module.exports = { getInventory, getLowStock, restock, adjust, getHistory };
