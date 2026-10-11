const { pool } = require('../config/db');
const { createPaginatedResult } = require('../utils/pagination');

const listCustomers = async ({ search = '', page = 1, limit = 10 } = {}) => {
  let where = 'WHERE 1 = 1';
  const values = [];

  if (search) {
    where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM customers ${where}`, values);
  const [rows] = await pool.query(
    `SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...values, limit, (page - 1) * limit]
  );
  return createPaginatedResult(rows, Number(countRows[0].total), { page, limit });
};

const getCustomerById = async (id, executor = pool) => {
  const [rows] = await executor.query('SELECT * FROM customers WHERE id = ?', [id]);
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const [rows] = await pool.query('SELECT * FROM customers WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
};

const createCustomer = async (connection, customerData) => {
  const { name, email, phone = '', address = '' } = customerData;
  const [result] = await connection.query(
    'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
    [name, email, phone || '', address || '']
  );
  return result.insertId;
};

const updateCustomer = async (connection, id, customerData) => {
  const keys = [];
  const values = [];

  Object.entries(customerData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      keys.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (!keys.length) {
    return false;
  }

  values.push(id);
  await connection.query(`UPDATE customers SET ${keys.join(', ')} WHERE id = ?`, values);
  return true;
};

const getCustomerOrders = async (id) => {
  const [rows] = await pool.query(
    `SELECT o.*, COUNT(oi.id) AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [id]
  );
  return rows;
};

module.exports = {
  listCustomers,
  getCustomerById,
  findByEmail,
  createCustomer,
  updateCustomer,
  getCustomerOrders
};
