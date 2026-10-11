# StockFlow — Order & Inventory Management System

A full-stack order and inventory management application built with Node.js + Express and React + Vite.

## Features

- Product catalog with active/inactive toggles
- Inventory tracking and stock adjustments
- Low-stock monitoring
- Customer management
- Order creation, status workflow, and cancellation logic
- Dashboard summaries for sales and inventory health
- JWT sign-in with Admin/Staff role-based access
- Server-side search, filters, and configurable pagination for products, inventory, customers, orders, and team accounts

## Tech stack

- Backend: Node.js, Express, MySQL, Zod
- Frontend: React, Vite, Axios, React Router

## Project structure

- `backend/` — Express API and MySQL schema setup
- `frontend/` — React application shell and screens

## Setup

1. Copy the backend example environment file:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update the database credentials in `backend/.env` to match your local MySQL instance.
   Set `JWT_SECRET` to a unique random value of at least 32 bytes. Never commit or share it.

3. Create the database, then import the schema and seed data and apply migrations. For local MySQL, create `stockflow_db` first and run each script with that database selected:

   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS stockflow_db"
   mysql -u root -p --database=stockflow_db < backend/db/schema.sql
   mysql -u root -p --database=stockflow_db < backend/db/seed.sql
   mysql -u root -p --database=stockflow_db < backend/db/migrations/001_reconcile_inventory_transactions.sql
   mysql -u root -p --database=stockflow_db < backend/db/migrations/002_add_auth_users.sql
   ```

   The demo seed is safe to rerun: it does not reset current stock or overwrite existing customer/order details, and it avoids adding duplicate sample order lines and movements. The stock-history migration is repeatable and doesn't change stock quantities.
   For a managed MySQL service, create/select the provider's database first (Aiven's default database is commonly `defaultdb`) and run each script in that database. These scripts do not hard-code a database name.

4. Install backend dependencies and create the first Admin account:

   ```bash
   cd backend
   npm install
   npm run create-admin
   ```

   The setup command prompts for the initial Admin email, display name, and a password (minimum 12 characters); password input is hidden. Do not use a shared/default password. Only the first active Admin can be bootstrapped this way. Later accounts and roles are managed inside **Team & access**.

5. Start the backend:

   ```bash
   node server.js
   ```

6. Start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev -- --host 0.0.0.0
   ```

7. Open the frontend, sign in with the Admin account, and create Staff accounts as needed.

## Verification and API references

Run the backend tests and frontend checks from their respective directories:

```bash
cd backend
npm test
cd ../frontend
npm run lint
npm run build
```

Import [`docs/StockFlow.postman_collection.json`](./docs/StockFlow.postman_collection.json) into Postman to try the core API endpoints. Set its `baseUrl` collection variable if the backend runs on another host or port. The schema relationships are shown in [`docs/database-erd.md`](./docs/database-erd.md).
For the end-to-end system walkthrough, see the [StockFlow technical guide](./docs/StockFlow-technical-guide.md).

The API requires a signed JWT Bearer token for all operational endpoints. Sign-in is `POST /api/v1/auth/login`; the token is returned in the login response and expires after the configured `JWT_EXPIRES_IN` (default 8 hours). Sign-out revokes the current account's existing tokens. Admin-only user management is under `/api/v1/users`; Staff accounts can perform the same product, inventory, customer, and order operations as Admins.

List APIs support server-side `search`, `page`, and `limit` (maximum 100). Products accept `status=all|active|inactive`; inventory accepts `status=all|low|healthy|inactive`; orders accept `status=all|PENDING|CONFIRMED|SHIPPED|DELIVERED|CANCELLED`; users accept role and active-status filters. Paginated responses have `{ items, pagination: { page, limit, total, totalPages } }`. Resource IDs must be positive safe integers.

The backend connects to MySQL using `backend/.env`; the frontend calls the backend API and never connects to MySQL directly. The setup uses a separate `stockflow_db` database because an existing `order_inventory_db` had a different schema.

## View the app data in MySQL Workbench

The app saves its data in the local MySQL database named `stockflow_db`. Products and customers are stored in their own tables; stock quantities are stored in `inventory`; orders and their line items are stored in `orders` and `order_items`; stock movements are recorded in `inventory_transactions`.

1. Open MySQL Workbench and connect to the same local MySQL server used by the backend:
   - Hostname: `localhost`
   - Port: `3306`
   - Username: the value of `DB_USER` in `backend/.env`
   - Password: the value of `DB_PASSWORD` in `backend/.env`
2. In the left **SCHEMAS** panel, click the refresh icon. Expand `stockflow_db`, then expand **Tables**. If it is not listed, run `USE stockflow_db;` in a SQL tab and refresh the schema panel.
3. Right-click a table such as `products` and choose **Select Rows - Limit 1000** to view its records. To see related data together, open a SQL tab, paste a query below, and click the lightning-bolt execute button (or press Ctrl+Enter).

See products and current stock:

```sql
USE stockflow_db;

SELECT p.id, p.sku, p.name, p.price, p.is_active,
       i.quantity_on_hand, i.reorder_level
FROM products AS p
JOIN inventory AS i ON i.product_id = p.id
ORDER BY p.id;
```

See orders, their customers, and items:

```sql
SELECT o.order_number, o.status, c.name AS customer,
       p.name AS product, oi.quantity, oi.unit_price, oi.line_total,
       o.total_amount, o.created_at
FROM orders AS o
JOIN customers AS c ON c.id = o.customer_id
JOIN order_items AS oi ON oi.order_id = o.id
JOIN products AS p ON p.id = oi.product_id
ORDER BY o.created_at DESC, o.id, oi.id;
```

See the stock movement audit trail:

```sql
SELECT t.created_at, p.sku, p.name, t.change_qty,
       t.reason, t.order_id, t.note
FROM inventory_transactions AS t
JOIN products AS p ON p.id = t.product_id
ORDER BY t.created_at DESC, t.id DESC;
```

Verify every inventory balance reconciles with its movement history (this query should return no rows):

```sql
SELECT p.id, p.sku, i.quantity_on_hand,
       COALESCE(SUM(t.change_qty), 0) AS movement_total
FROM products AS p
JOIN inventory AS i ON i.product_id = p.id
LEFT JOIN inventory_transactions AS t ON t.product_id = p.id
GROUP BY p.id, p.sku, i.quantity_on_hand
HAVING i.quantity_on_hand <> COALESCE(SUM(t.change_qty), 0);
```

Changes made through the app are sent to the Express API and written to MySQL. For example, placing an order inserts an `orders` row and its `order_items`, reduces `inventory.quantity_on_hand`, and records the deduction in `inventory_transactions`, all in a database transaction. Refresh or rerun the Workbench query to see the latest committed data.

## Default backend URL

- `http://localhost:5000`

## Health check

- `GET /health`

The health endpoint will report `database: connected` once MySQL is available. If MySQL is unavailable, the health endpoint returns a degraded status. The backend still requires a valid `JWT_SECRET` in `backend/.env` to start.

## Notes

- Schema and seed files live in `backend/db/`.
- Business rules are implemented in the backend service layer, particularly around stock validation and order lifecycle transitions.
- The application is designed as a demo-ready workflow for stock safety and operational visibility.
