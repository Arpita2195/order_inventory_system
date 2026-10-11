const { sendException } = require('../utils/response');

const validate = (schema, source) => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return sendException(res, result.error);
  }
  if (source === 'query') req.validatedQuery = result.data;
  return next();
};

module.exports = {
  validateParams: (schema) => validate(schema, 'params'),
  validateQuery: (schema) => validate(schema, 'query')
};
