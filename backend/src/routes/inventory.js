const express = require('express');
const controller = require('../controllers/inventory');
const { validateParams } = require('../middlewares/validate');
const { validateQuery } = require('../middlewares/validate');
const { productIdParamsSchema, inventoryListQuerySchema } = require('../utils/validators');

const router = express.Router();

router.get('/', validateQuery(inventoryListQuerySchema), controller.getInventory);
router.get('/low-stock', controller.getLowStock);
router.get('/:productId/history', validateParams(productIdParamsSchema), controller.getHistory);
router.post('/:productId/restock', validateParams(productIdParamsSchema), controller.restock);
router.post('/:productId/adjust', validateParams(productIdParamsSchema), controller.adjust);

module.exports = router;
