const { pool } = require('../config/db');
const { createPaginatedResult } = require('../utils/pagination');

const listProducts = async ({ search = '', status = 'all', page = 1, limit = 10 } = {}) => {
  let where = 'WHERE 1 = 1';
  const values = [];

  if (search) {
    where += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    const term = `%${search}%`;
    values.push(term, term);
  }

  if (status === 'active') {
    where += ' AND p.is_active = 1';
  } else if (status === 'inactive') {
    where += ' AND p.is_active = 0';
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p LEFT JOIN inventory i ON i.product_id = p.id ${where}`,
    values
  );
  const [rows] = await pool.query(`
    SELECT p.*, i.quantity_on_hand, i.reorder_level,
      CASE WHEN i.quantity_on_hand <= i.reorder_level THEN 1 ELSE 0 END AS is_low_stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ${where}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ? OFFSET ?
  `, [...values, limit, (page - 1) * limit]);
  return createPaginatedResult(rows, Number(countRows[0].total), { page, limit });
};

const getProductById = async (id, executor = pool) => {
  const [rows] = await executor.query(
    `SELECT p.*, i.quantity_on_hand, i.reorder_level,
      CASE WHEN i.quantity_on_hand <= i.reorder_level THEN 1 ELSE 0 END AS is_low_stock
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findBySku = async (sku) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE sku = ? LIMIT 1', [sku]);
  return rows[0] || null;
};

const createProduct = async (connection, productData) => {
  const { sku, name, description, price, is_active } = productData;
  const [result] = await connection.query(
    'INSERT INTO products (sku, name, description, price, is_active) VALUES (?, ?, ?, ?, ?)',
    [sku, name, description || '', Number(price), is_active === undefined ? 1 : Number(is_active)]
  );

  await connection.query(
    'INSERT INTO inventory (product_id, quantity_on_hand, reorder_level) VALUES (?, 0, 10)',
    [result.insertId]
  );
  await connection.query(
    `INSERT INTO inventory_transactions (product_id, change_qty, reason, note)
     VALUES (?, 0, 'ADJUSTMENT', 'Opening balance')`,
    [result.insertId]
  );

  return result.insertId;
};

const updateProduct = async (connection, id, updates) => {
  const fileds = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      fileds.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (!fileds.length) {
    return false;
  }

  values.push(id);
  await connection.query(`UPDATE products SET ${fileds.join(', ')} WHERE id = ?`, values);
  return true;
};

const toggleProductStatus = async (connection, id, isActive) => {
  await connection.query('UPDATE products SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return true;
};

module.exports = {
  listProducts,
  getProductById,
  findBySku,
  createProduct,
  updateProduct,
  toggleProductStatus
};
