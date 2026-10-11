const customerService = require('../services/customers');
const { sendSuccess, sendException } = require('../utils/response');

const listCustomers = async (req, res) => {
  try {
    const data = await customerService.listCustomers(req.validatedQuery);
    return sendSuccess(res, data, 'Customers retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const getCustomer = async (req, res) => {
  try {
    const data = await customerService.getCustomerWithHistory(req.params.id);
    return sendSuccess(res, data, 'Customer retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const createCustomer = async (req, res) => {
  try {
    const data = await customerService.createCustomer(req.body);
    return sendSuccess(res, data, 'Customer created successfully', 201);
  } catch (error) {
    return sendException(res, error);
  }
};

const updateCustomer = async (req, res) => {
  try {
    const data = await customerService.updateCustomer(req.params.id, req.body);
    return sendSuccess(res, data, 'Customer updated successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer };
