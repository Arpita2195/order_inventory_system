const orderService = require('../services/orders');
const { sendSuccess, sendException } = require('../utils/response');

const listOrders = async (req, res) => {
  try {
    const data = await orderService.listOrders(req.validatedQuery);
    return sendSuccess(res, data, 'Orders retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const getOrder = async (req, res) => {
  try {
    const data = await orderService.getOrder(req.params.id);
    return sendSuccess(res, data, 'Order retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const createOrder = async (req, res) => {
  try {
    const data = await orderService.createOrder(req.body);
    return sendSuccess(res, data, 'Order created successfully', 201);
  } catch (error) {
    return sendException(res, error);
  }
};

const updateStatus = async (req, res) => {
  try {
    const data = await orderService.updateOrderStatus(req.params.id, req.body);
    return sendSuccess(res, data, 'Order status updated successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const data = await orderService.cancelOrder(req.params.id);
    return sendSuccess(res, data, 'Order cancelled successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

module.exports = { listOrders, getOrder, createOrder, updateStatus, cancelOrder };
