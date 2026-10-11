const express = require('express');
const controller = require('../controllers/dashboard');

const router = express.Router();

router.get('/summary', controller.dashboardSummary);

module.exports = router;
