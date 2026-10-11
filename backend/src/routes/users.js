const express = require('express');
const controller = require('../controllers/users');
const { requireRole } = require('../middlewares/authenticate');
const { validateParams, validateQuery } = require('../middlewares/validate');
const { numericIdParamsSchema, userListQuerySchema } = require('../utils/validators');

const router = express.Router();
router.use(requireRole('ADMIN'));

router.get('/', validateQuery(userListQuerySchema), controller.listUsers);
router.post('/', controller.createUser);
router.patch('/:id', validateParams(numericIdParamsSchema), controller.updateUser);

module.exports = router;
