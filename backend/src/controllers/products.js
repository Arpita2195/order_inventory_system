const productService = require('../services/products');
const { sendSuccess, sendException } = require('../utils/response');

const listProducts = async (req, res) => {
  try {
    const data = await productService.listProducts(req.validatedQuery);
    return sendSuccess(res, data, 'Products retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const getProduct = async (req, res) => {
  try {
    const data = await productService.getProduct(req.params.id);
    return sendSuccess(res, data, 'Product retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const createProduct = async (req, res) => {
  try {
    const data = await productService.createProduct(req.body);
    return sendSuccess(res, data, 'Product created successfully', 201);
  } catch (error) {
    return sendException(res, error);
  }
};

const updateProduct = async (req, res) => {
  try {
    const data = await productService.updateProduct(req.params.id, req.body);
    return sendSuccess(res, data, 'Product updated successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const toggleStatus = async (req, res) => {
  try {
    const data = await productService.toggleStatus(req.params.id, req.body.isActive);
    return sendSuccess(res, data, 'Product status updated successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

module.exports = { listProducts, getProduct, createProduct, updateProduct, toggleStatus };
