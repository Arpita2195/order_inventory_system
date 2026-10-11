const { withTransaction } = require('../config/db');
const customerRepo = require('../repositories/customers');
const orderRepo = require('../repositories/orders');
const { customerSchema } = require('../utils/validators');

const buildError = (status, code, message, details = []) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const listCustomers = async (query = {}) => customerRepo.listCustomers(query);

const getCustomer = async (id) => {
  const customer = await customerRepo.getCustomerById(id);
  if (!customer) {
    throw buildError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }
  return customer;
};

const createCustomer = async (payload) => {
  const parsed = customerSchema.parse(payload);
  const duplicate = await customerRepo.findByEmail(parsed.email.toLowerCase());
  if (duplicate) {
    throw buildError(409, 'EMAIL_ALREADY_EXISTS', 'A customer with this email already exists');
  }

  return withTransaction(async (connection) => {
    const id = await customerRepo.createCustomer(connection, {
      ...parsed,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone || ''
    });
    return customerRepo.getCustomerById(id, connection);
  });
};

const updateCustomer = async (id, payload) => {
  const customer = await customerRepo.getCustomerById(id);
  if (!customer) {
    throw buildError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const parsed = customerSchema.partial().parse(payload);
  if (parsed.email) {
    const duplicate = await customerRepo.findByEmail(parsed.email.toLowerCase());
    if (duplicate && duplicate.id !== Number(id)) {
      throw buildError(409, 'EMAIL_ALREADY_EXISTS', 'A customer with this email already exists');
    }
  }

  const clean = { ...parsed };
  if (clean.email) clean.email = clean.email.toLowerCase();
  if (clean.phone === '') clean.phone = '';
  if (clean.address === '') clean.address = '';

  await withTransaction(async (connection) => {
    await customerRepo.updateCustomer(connection, id, clean);
  });

  return getCustomer(id);
};

const getCustomerWithHistory = async (id) => {
  const customer = await getCustomer(id);
  const orders = await orderRepo.getCustomerOrderHistory(id);
  return {
    ...customer,
    orders
  };
};

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  getCustomerWithHistory
};
