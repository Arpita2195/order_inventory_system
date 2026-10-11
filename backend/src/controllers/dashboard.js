const orderService = require('../services/orders');
const { sendSuccess, sendError } = require('../utils/response');

const handleError = (res, error) => {
  const status = Number(error.status) || 500;
  const code = error.code || 'SERVER_ERROR';
  const message = error.message || 'An unexpected error occurred';
  const details = Array.isArray(error.details) ? error.details : [];
  return sendError(res, code, message, details, status);
};

const dashboardSummary = async (req, res) => {
  try {
    const data = await orderService.getDashboardSummary();
    return sendSuccess(res, data, 'Dashboard summary retrieved successfully');
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { dashboardSummary };
