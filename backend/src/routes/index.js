const express = require('express');
const productsRouter = require('./products');
const customersRouter = require('./customers');
const inventoryRouter = require('./inventory');
const ordersRouter = require('./orders');
const dashboardRouter = require('./dashboard');
const usersRouter = require('./users');

const router = express.Router();

router.use('/products', productsRouter);
router.use('/customers', customersRouter);
router.use('/inventory', inventoryRouter);
router.use('/orders', ordersRouter);
router.use('/dashboard', dashboardRouter);
router.use('/users', usersRouter);

module.exports = router;
