const { pool } = require('../config/db');
const { createPaginatedResult } = require('../utils/pagination');

const listInventory = async ({ search = '', status = 'all', page = 1, limit = 10 }) => {
  let where = 'WHERE 1 = 1';
  const values = [];
  if (search) {
    where += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    values.push(`%${search}%`, `%${search}%`);
  }
  if (status === 'low') where += ' AND i.quantity_on_hand <= i.reorder_level AND p.is_active = 1';
  if (status === 'healthy') where += ' AND i.quantity_on_hand > i.reorder_level AND p.is_active = 1';
  if (status === 'inactive') where += ' AND p.is_active = 0';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM inventory i JOIN products p ON p.id = i.product_id ${where}`,
    values
  );
  const [rows] = await pool.query(`
    SELECT p.id, p.sku, p.name, p.price, i.quantity_on_hand, i.reorder_level,
      CASE WHEN i.quantity_on_hand <= i.reorder_level THEN 1 ELSE 0 END AS is_low_stock,
      p.is_active
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    ${where}
    ORDER BY p.name ASC, p.id ASC
    LIMIT ? OFFSET ?
  `, [...values, limit, (page - 1) * limit]);
  return createPaginatedResult(rows, Number(countRows[0].total), { page, limit });
};

const getInventorySummary = async (executor = pool) => {
  const [rows] = await executor.query(`
    SELECT p.id, p.sku, p.name, p.price, i.quantity_on_hand, i.reorder_level,
      CASE WHEN i.quantity_on_hand <= i.reorder_level THEN 1 ELSE 0 END AS is_low_stock,
      p.is_active
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    ORDER BY p.name ASC
  `);
  return rows;
};

const getLowStock = async () => {
  const [rows] = await pool.query(`
    SELECT p.id, p.sku, p.name, i.quantity_on_hand, i.reorder_level
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE i.quantity_on_hand <= i.reorder_level AND p.is_active = 1
    ORDER BY i.quantity_on_hand ASC
  `);
  return rows;
};

const getInventoryHistory = async (productId) => {
  const [rows] = await pool.query(
    `SELECT it.*, o.order_number
     FROM inventory_transactions it
     LEFT JOIN orders o ON o.id = it.order_id
     WHERE it.product_id = ?
     ORDER BY it.created_at DESC`,
    [productId]
  );
  return rows;
};

const getInventoryByProduct = async (connection, productId) => {
  const [rows] = await connection.query(
    'SELECT * FROM inventory WHERE product_id = ? FOR UPDATE',
    [productId]
  );
  return rows[0] || null;
};

const addTransaction = async (connection, { productId, changeQty, reason, orderId = null, note = '' }) => {
  await connection.query(
    'INSERT INTO inventory_transactions (product_id, change_qty, reason, order_id, note) VALUES (?, ?, ?, ?, ?)',
    [productId, changeQty, reason, orderId, note]
  );
};

const updateStock = async (connection, productId, deltaQty) => {
  await connection.query(
    'UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = NOW() WHERE product_id = ?',
    [deltaQty, productId]
  );
};

module.exports = {
  listInventory,
  getInventorySummary,
  getLowStock,
  getInventoryHistory,
  getInventoryByProduct,
  addTransaction,
  updateStock
};
