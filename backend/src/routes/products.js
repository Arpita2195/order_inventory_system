const express = require('express');
const controller = require('../controllers/products');
const { validateParams, validateQuery } = require('../middlewares/validate');
const { numericIdParamsSchema, productListQuerySchema } = require('../utils/validators');

const router = express.Router();

router.get('/', validateQuery(productListQuerySchema), controller.listProducts);
router.get('/:id', validateParams(numericIdParamsSchema), controller.getProduct);
router.post('/', controller.createProduct);
router.put('/:id', validateParams(numericIdParamsSchema), controller.updateProduct);
router.patch('/:id/status', validateParams(numericIdParamsSchema), controller.toggleStatus);

module.exports = router;
