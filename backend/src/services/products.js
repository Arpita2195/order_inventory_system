const { withTransaction } = require('../config/db');
const { productSchema, productStatusSchema } = require('../utils/validators');
const productRepo = require('../repositories/products');

const buildError = (status, code, message, details = []) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const listProducts = async (query = {}) => productRepo.listProducts(query);

const getProduct = async (id) => {
  const product = await productRepo.getProductById(id);
  if (!product) {
    throw buildError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
  return product;
};

const createProduct = async (payload) => {
  const parsed = productSchema.parse(payload);
  const existing = await productRepo.findBySku(parsed.sku);
  if (existing) {
    throw buildError(409, 'SKU_ALREADY_EXISTS', 'A product with this SKU already exists');
  }

  return withTransaction(async (connection) => {
    const id = await productRepo.createProduct(connection, parsed);
    const product = await productRepo.getProductById(id, connection);
    return product;
  });
};

const updateProduct = async (id, payload) => {
  const parsed = productSchema.partial().parse(payload);
  const existing = await productRepo.getProductById(id);
  if (!existing) {
    throw buildError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  const sanitized = {};
  if (parsed.sku !== undefined) sanitized.sku = parsed.sku;
  if (parsed.name !== undefined) sanitized.name = parsed.name;
  if (parsed.description !== undefined) sanitized.description = parsed.description;
  if (parsed.price !== undefined) sanitized.price = parsed.price;
  if (parsed.is_active !== undefined) sanitized.is_active = Number(parsed.is_active);

  if (parsed.sku !== undefined) {
    const duplicate = await productRepo.findBySku(sanitized.sku);
    if (duplicate && duplicate.id !== Number(id)) {
      throw buildError(409, 'SKU_ALREADY_EXISTS', 'A product with this SKU already exists');
    }
  }

  await withTransaction(async (connection) => {
    await productRepo.updateProduct(connection, id, sanitized);
  });

  return productRepo.getProductById(id);
};

const toggleStatus = async (id, isActive) => {
  const parsed = productStatusSchema.parse({ isActive });
  const existing = await productRepo.getProductById(id);
  if (!existing) {
    throw buildError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  await withTransaction(async (connection) => {
    await productRepo.toggleProductStatus(connection, id, parsed.isActive);
  });

  return getProduct(id);
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  toggleStatus
};
