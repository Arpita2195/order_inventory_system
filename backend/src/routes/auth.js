const express = require('express');
const controller = require('../controllers/auth');
const { authenticate, rateLimitLogin } = require('../middlewares/authenticate');

const router = express.Router();

router.post('/login', rateLimitLogin, controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);

module.exports = router;
