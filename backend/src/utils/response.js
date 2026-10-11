const sendSuccess = (res, data, message = 'Operation completed successfully', status = 200) => {
  return res.status(status).json({
    success: true,
    data,
    message
  });
};

const sendError = (res, code, message, details = [], status = 400) => {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details
    }
  });
};

const sendException = (res, error) => {
  if (error.name === 'ZodError') {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return sendError(res, 'VALIDATION_ERROR', 'Request validation failed', details, 400);
  }

  const status = Number(error.status) || 500;
  const code = error.code || 'SERVER_ERROR';
  const message = error.message || 'An unexpected error occurred';
  const details = Array.isArray(error.details) ? error.details : [];
  return sendError(res, code, message, details, status);
};

module.exports = { sendSuccess, sendError, sendException };
