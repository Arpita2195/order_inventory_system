const express = require('express');
const controller = require('../controllers/customers');
const { validateParams, validateQuery } = require('../middlewares/validate');
const { numericIdParamsSchema, customerListQuerySchema } = require('../utils/validators');

const router = express.Router();

router.get('/', validateQuery(customerListQuerySchema), controller.listCustomers);
router.get('/:id', validateParams(numericIdParamsSchema), controller.getCustomer);
router.post('/', controller.createCustomer);
router.put('/:id', validateParams(numericIdParamsSchema), controller.updateCustomer);

module.exports = router;
