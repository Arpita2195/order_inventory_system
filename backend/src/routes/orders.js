const express = require('express');
const controller = require('../controllers/orders');
const { validateParams, validateQuery } = require('../middlewares/validate');
const { numericIdParamsSchema, orderListQuerySchema } = require('../utils/validators');

const router = express.Router();

router.get('/', validateQuery(orderListQuerySchema), controller.listOrders);
router.get('/:id', validateParams(numericIdParamsSchema), controller.getOrder);
router.post('/', controller.createOrder);
router.patch('/:id/status', validateParams(numericIdParamsSchema), controller.updateStatus);
router.post('/:id/cancel', validateParams(numericIdParamsSchema), controller.cancelOrder);

module.exports = router;
