# StockFlow technical guide

This guide describes how the current StockFlow application is assembled, how a request travels through it, what users can do, how the database records business activity, and how to run and verify the system.

## 1. What StockFlow does

StockFlow is a browser-based order and inventory management application. Its main workflows are:

- View operational metrics, recent orders, stock alerts, and charts on the dashboard.
- Create products, view their price and stock, and activate or deactivate products.
- Search and filter products, customers, orders, and inventory, with server-side pagination.
- Create and search customer records.
- Restock products, make explained positive or negative stock adjustments, and review stock movement history.
- Create customer orders, progress an order through its fulfillment statuses, and cancel eligible orders.
- Sign in with an application account and control account access using Admin and Staff roles.
- Let Admins create accounts, change roles, and deactivate or reactivate accounts in **Team & access**.

The application uses one MySQL database, `stockflow_db`, configured for the backend. The browser does not connect to MySQL directly.

## 2. Architecture: from browser to database

```text
User
  │
  ▼
React + Vite frontend (browser, normally http://localhost:5173)
  │  HTTP/JSON requests; Bearer JWT on protected requests
  ▼
Express API (normally http://localhost:5000/api/v1)
  ├─ authentication and role checks
  ├─ request validation
  ├─ controllers → services → repositories
  ▼
MySQL database: stockflow_db
```

### Responsibilities by layer

1. **Frontend (`frontend/src`)** renders the login and application screens, collects form input, calls API helpers, and displays results and errors.
2. **API client (`frontend/src/api/client.js`)** adds the saved access token to requests. If a protected request receives HTTP 401, it removes the saved token and asks the frontend to return to the sign-in screen.
3. **Express application (`backend/src/app.js`)** parses JSON, exposes the health check, mounts the public sign-in route, and requires authentication for the rest of `/api/v1`.
4. **Middleware** checks JWTs and roles and validates list query parameters and route IDs.
5. **Controllers** map an HTTP request to a service call and format the HTTP response.
6. **Services** implement workflow rules, such as order status transitions, sufficient stock, password hashing, and last-Admin protections.
7. **Repositories** issue parameterized SQL queries and return records or paginated results.
8. **MySQL** stores business records, user account hashes, and the inventory transaction history. Multi-record inventory and order changes use database transactions.

### API response envelope

Successful API calls use an envelope similar to:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

Errors use a stable error object:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  }
}
```

List endpoints put the page of rows and its metadata inside `data`:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "totalPages": 0
    }
  },
  "message": "Records retrieved successfully"
}
```

## 3. Accounts, sign-in, and permissions

### Application roles

These roles are StockFlow application roles stored in `app_users`; they are **not** MySQL server accounts.

| Capability | Admin | Staff |
|---|---:|---:|
| Use dashboard, products, inventory, customers, and orders | Yes | Yes |
| Create and manage team accounts | Yes | No |
| Assign Admin or Staff role; activate or deactivate accounts | Yes | No |

An Admin must create the initial account through the backend's interactive setup command. Once signed in, an Admin can create additional accounts from the StockFlow website at **profile menu → Team & access**. Give each person their own StockFlow login; do not share database credentials with them.

### Authentication flow

1. The user submits an email and password to `POST /api/v1/auth/login`.
2. The backend validates the input, finds the account, and compares the submitted password with its bcrypt hash.
3. If the account is active and the password is correct, the backend returns a signed JWT and a safe public user record. It never returns the stored password hash.
4. The frontend saves the access token in browser local storage and sends it as `Authorization: Bearer <token>` on later API requests.
5. For each protected request, the backend verifies the JWT and loads the current account. A disabled account or changed token version invalidates the token.
6. The default token lifetime is eight hours; `JWT_EXPIRES_IN` can configure the lifetime.
7. `POST /api/v1/auth/logout` increments the account's token version, revoking its existing tokens. Password changes also increment the version.
8. Login attempts are limited in memory by client IP: after ten attempts in a 15-minute window, login requests receive HTTP 429 with a `Retry-After` header. A successful sign-in clears that IP's counter.

The login limiter is process-local, so its counters reset when the backend restarts and are not shared between multiple backend instances. Two-factor authentication is not implemented.

### Account protections

- Passwords are hashed with bcrypt (cost factor 12).
- New accounts require passwords of at least 12 characters.
- Email addresses are normalized to lowercase for account creation and sign-in.
- The last active Admin cannot be deactivated or demoted.
- An Admin cannot deactivate or demote their own account from the account-management screen.
- Updating an account password revokes tokens already issued to that account.

### Create the first Admin

From PowerShell, in the project:

```powershell
Set-Location 'C:\Users\Arpita\OneDrive\Desktop\order_inventory\order-inventory-system\backend'
npm run create-admin
```

Enter the Admin email and display name, then enter a password when prompted. Password characters are masked. This command requires an interactive terminal and only succeeds if no active Admin exists.

### Add another person

1. Sign in to the StockFlow site with an Admin account.
2. Open the profile menu and select **Team & access**.
3. Enter the person's name, email, temporary password, and role; select **Create account**.
4. Send the person's sign-in email and temporary password privately. Do not put credentials in source code, share them in public, or give the person the backend `.env` or MySQL credentials.

The current UI supports account creation, role changes, activation/deactivation, and account search/filter/pagination. Password update is supported by the Admin API, but there is no password-change form in the current Team & access screen.

## 4. Features and business workflows

### Dashboard

The dashboard obtains its data from `GET /api/v1/dashboard/summary` and displays:

- Product catalog count.
- Count of active products at or below their reorder level.
- Orders placed since midnight according to the MySQL server's current date.
- Revenue to date, excluding cancelled orders.
- A seven-day daily revenue/order-count chart (cancelled orders excluded).
- An all-time order-status breakdown.
- Recent orders and a low-stock restock watch.

### Products

- Create a product with SKU, name, description, price, and active state.
- View catalog records with current quantity, reorder point, low-stock state, and active state.
- Activate or deactivate a product.
- Search by name or SKU; filter by active/inactive; paginate results.
- The API also supports updating a product record by ID.
- Creating a product also creates an inventory row with zero stock and a zero-quantity opening movement.

### Customers

- Create and list customer records with name, email, phone, and address.
- Search by name, email, or phone and paginate results.
- The API supports retrieving a customer by ID and updating the customer. Customer deletion is not exposed.

### Inventory

- View inventory for active and inactive products.
- Search by product name or SKU; filter to all, low, healthy, or inactive; paginate results.
- Review low-stock items in a dedicated endpoint and on the dashboard.
- Restock by a positive quantity, with an optional note.
- Adjust stock by a positive or negative quantity, with a required explanation. An adjustment that would make stock negative is rejected.
- Open a product's chronological movement history.
- Every stock change is recorded with a reason such as `ORDER`, `CANCEL`, `RESTOCK`, or `ADJUSTMENT`.

### Orders

- Create an order for a customer with one or more product/quantity lines.
- Repeated product lines in one request are merged before stock is checked.
- The backend locks the relevant product/inventory rows, checks product activity and available stock, calculates prices and totals on the server, creates order and item rows, deducts inventory, and inserts movement records in a single transaction.
- An order begins in `PENDING`.
- Valid forward transitions are `PENDING → CONFIRMED → SHIPPED → DELIVERED`.
- Orders in `PENDING` or `CONFIRMED` can be cancelled. Cancellation restores stock and records `CANCEL` movements transactionally. Delivered and already-cancelled orders cannot be cancelled.
- Search by order number or customer; filter by status; paginate results.

### Search, filtering, and pagination

List filters and pagination are applied by the API/database, not just to the currently visible page in the browser.

- `page`: starts at 1; defaults to 1.
- `limit`: defaults to 10 and is capped at 100.
- `search`: optional text search.
- `status`: resource-specific supported values listed in the API reference below.

The frontend list screens let users change page size (10, 25, or 50) and move to previous/next pages. The order-entry screen requests available pages in batches so its dropdowns can include all customers and active products.

## 5. API reference

Base URL for local development: `http://localhost:5000/api/v1`.

All routes below require a Bearer JWT **except** `GET /health` and `POST /api/v1/auth/login`. User-management routes require the `ADMIN` role. Admin and Staff both have access to the operational routes.

### Health

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Check API and database connectivity. Returns HTTP 200 when connected or HTTP 503 when the database is unavailable. |

### Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public (rate-limited) | Validate credentials; return `{ user, accessToken }`. |
| `GET` | `/auth/me` | Signed-in user | Return the current user's safe profile. |
| `POST` | `/auth/logout` | Signed-in user | Revoke existing tokens for that account. |

Example login request:

```json
{
  "email": "person@example.com",
  "password": "the-person's-password"
}
```

### Products

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/products?search=&status=all&page=1&limit=10` | Search/list products. `status`: `all`, `active`, `inactive`. Paginated. |
| `GET` | `/products/:id` | Retrieve product and inventory details. |
| `POST` | `/products` | Create product plus zero-stock inventory/opening history. |
| `PUT` | `/products/:id` | Update product fields accepted by the product service. |
| `PATCH` | `/products/:id/status` | Set `{ "isActive": true }` or `false`. |

### Customers

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/customers?search=&page=1&limit=10` | Search by name, email, or phone. Paginated. |
| `GET` | `/customers/:id` | Retrieve customer record. |
| `POST` | `/customers` | Create a customer. |
| `PUT` | `/customers/:id` | Update customer fields. |

### Inventory

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/inventory?search=&status=all&page=1&limit=10` | Search/filter inventory. `status`: `all`, `low`, `healthy`, `inactive`. Paginated. |
| `GET` | `/inventory/low-stock` | Retrieve active products at/below their reorder point. |
| `GET` | `/inventory/:productId/history` | Retrieve stock movements for one product. |
| `POST` | `/inventory/:productId/restock` | Add positive `{ "quantity": 10, "note": "..." }`. |
| `POST` | `/inventory/:productId/adjust` | Apply signed `{ "quantity": -1, "note": "Reason required" }`. |

### Orders

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/orders?search=&status=all&page=1&limit=10` | Search by order number/customer; filter status; paginated. |
| `GET` | `/orders/:id` | Retrieve order, customer, and line items. |
| `POST` | `/orders` | Create order: `{ "customerId": 1, "items": [{ "productId": 1, "quantity": 2 }] }`. |
| `PATCH` | `/orders/:id/status` | Move to a valid next status: `{ "status": "CONFIRMED" }`. |
| `POST` | `/orders/:id/cancel` | Cancel an eligible order and return stock. |

Order `status` filters: `all`, `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`.

### Dashboard

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/dashboard/summary` | Return dashboard KPIs, low-stock products, recent orders, seven-day sales trend, and status breakdown. |

### User accounts (Admin only)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/users?search=&role=all&status=all&page=1&limit=10` | Search/filter accounts. `role`: `all`, `ADMIN`, `STAFF`; `status`: `all`, `active`, `inactive`. Paginated. |
| `POST` | `/users` | Create an account: `{ "email": "...", "displayName": "...", "password": "...", "role": "STAFF" }`. |
| `PATCH` | `/users/:id` | Update one or more of `role`, `isActive`, `password`. Password must be at least 12 characters. |

## 6. Database design

The database is `stockflow_db`, with InnoDB tables and foreign keys defined in `backend/db/schema.sql`.

| Table | Purpose and relationships |
|---|---|
| `products` | Product catalog; unique SKU, name, description, price, active flag. Referenced by inventory, order items, and stock movements. |
| `inventory` | One row per product; `product_id` is both primary key and foreign key. Holds `quantity_on_hand` and `reorder_level`; both cannot be negative. |
| `customers` | Customer contact data. A customer's email is unique. Customers can have multiple orders. |
| `orders` | Order header: unique order number, customer, status, total, timestamps. |
| `order_items` | Product lines belonging to orders. Records quantity and the unit/line price at the time of the order. |
| `inventory_transactions` | Append-style movement history: product, signed quantity change, reason, optional related order, note, timestamp. |
| `app_users` | StockFlow identities: unique email, display name, bcrypt password hash, Admin/Staff role, active flag, token version, timestamps. |
| `auth_setup_lock` | Singleton row locked while creating the initial Admin or changing Admin access, preventing conflicting concurrent changes. |

### Important relationships and invariants

- A product has one inventory record. Product deletion is constrained while related records exist; the app uses active/inactive state rather than deleting product history.
- An order belongs to one customer and contains one or more order items.
- Order items preserve the price charged at the time of purchase; changing a catalog price later does not rewrite past order lines.
- An inventory transaction can refer to an order. It is nullable for non-order changes.
- A product's current on-hand quantity should reconcile with the sum of its `inventory_transactions.change_qty`.
- Placing or cancelling an order changes inventory and appends the corresponding movements in the same database transaction. A transaction rollback prevents a partial write.

The existing ER diagram is in [`database-erd.md`](./database-erd.md).

### Database initialization and migrations

- `backend/db/schema.sql` creates the `stockflow_db` schema and all current tables if they do not exist.
- `backend/db/seed.sql` adds demo products, customers, orders, order items, inventory, and movement history. Its inserts are designed to avoid overwriting existing sample/business data.
- `backend/db/migrations/001_reconcile_inventory_transactions.sql` records any difference between current inventory balances and their recorded movements as an opening-balance adjustment; it does not change stock quantities.
- `backend/db/migrations/002_add_auth_users.sql` creates the application account and setup-lock tables.

For an existing installation, back up the database before schema changes. Confirm each SQL script selects `stockflow_db` before running it; do not run these scripts against a different schema by accident. The initial Admin is created with the application CLI, not a SQL insert.

### View data in MySQL Workbench

Connect Workbench to the same MySQL server used by the backend, refresh the **SCHEMAS** list, expand `stockflow_db → Tables`, then right-click a table and choose **Select Rows - Limit 1000**. For related information, use a SQL tab. Example:

```sql
USE stockflow_db;

SELECT p.sku, p.name, i.quantity_on_hand, i.reorder_level
FROM products AS p
JOIN inventory AS i ON i.product_id = p.id
ORDER BY p.name;
```

Check movement reconciliation; a healthy result returns no rows:

```sql
SELECT p.id, p.sku, i.quantity_on_hand,
       COALESCE(SUM(t.change_qty), 0) AS movement_total
FROM products AS p
JOIN inventory AS i ON i.product_id = p.id
LEFT JOIN inventory_transactions AS t ON t.product_id = p.id
GROUP BY p.id, p.sku, i.quantity_on_hand
HAVING i.quantity_on_hand <> COALESCE(SUM(t.change_qty), 0);
```

## 7. Project structure

```text
order-inventory-system/
├─ backend/
│  ├─ db/
│  │  ├─ schema.sql                    # Current database schema
│  │  ├─ seed.sql                      # Safe-to-rerun demo data
│  │  └─ migrations/                   # Inventory history and auth changes
│  ├─ scripts/
│  │  └─ create-admin.js               # Secure interactive first-Admin setup
│  ├─ src/
│  │  ├─ app.js                        # Express setup, health, auth mounting
│  │  ├─ config/                       # Environment and MySQL pool/transactions
│  │  ├─ controllers/                  # HTTP handlers
│  │  ├─ middlewares/                  # JWT auth, roles, input validation
│  │  ├─ repositories/                 # Parameterized SQL/data access
│  │  ├─ routes/                       # REST route declarations
│  │  ├─ services/                     # Business logic and workflow rules
│  │  └─ utils/                        # Validators, response and pagination helpers
│  ├─ test/                            # Node.js test suite
│  ├─ .env.example                     # Safe config template (no real credentials)
│  ├─ package.json
│  └─ server.js                        # Starts the API listener
├─ frontend/
│  ├─ public/                          # Static icons/assets
│  ├─ src/
│  │  ├─ api/                          # Axios client and resource API helpers
│  │  ├─ App.jsx                       # Auth, app shell, pages, UI workflows
│  │  ├─ App.css
│  │  ├─ index.css                     # Global theme and component styles
│  │  └─ main.jsx                      # React entry point
│  ├─ index.html
│  └─ package.json
├─ docs/
│  ├─ database-erd.md                  # Entity relationship diagram
│  ├─ StockFlow-technical-guide.md     # This guide
│  └─ StockFlow.postman_collection.json
└─ README.md                           # Quick setup and project notes
```

## 8. Run the application locally

### Prerequisites

- Node.js and npm.
- A running MySQL server.
- The project dependencies installed in both `backend` and `frontend`.

### Configure the backend

1. Copy `backend/.env.example` to `backend/.env`.
2. Set the MySQL host, port, username, password, and database name. The default database name is `stockflow_db`.
3. Set `JWT_SECRET` to a unique secret containing at least 32 bytes. Keep `.env` private and out of version control. Never put the JWT secret or MySQL password in frontend files.
4. Configure `JWT_EXPIRES_IN` if the eight-hour default is unsuitable.

### Prepare MySQL

For a new database, use MySQL Workbench or a terminal to execute, in order:

```text
backend/db/schema.sql
backend/db/seed.sql
backend/db/migrations/001_reconcile_inventory_transactions.sql
backend/db/migrations/002_add_auth_users.sql
```

The SQL files select/create `stockflow_db`. On an existing installation, take a backup and apply only the appropriate schema/migration steps; do not replace data with unrelated schemas. The auth migration is safe to reapply because it uses `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`.

### Install, bootstrap Admin, and start

Open one PowerShell terminal:

```powershell
Set-Location 'C:\Users\Arpita\OneDrive\Desktop\order_inventory\order-inventory-system\backend'
npm install
npm run create-admin
node server.js
```

Open another PowerShell terminal:

```powershell
Set-Location 'C:\Users\Arpita\OneDrive\Desktop\order_inventory\order-inventory-system\frontend'
npm install
npm run dev
```

Open the local Vite address printed in the frontend terminal (usually `http://localhost:5173`). Sign in with the Admin credentials created by `npm run create-admin`. The frontend defaults to the API at `http://localhost:5000/api/v1`; `VITE_API_BASE_URL` can override that URL.

### Verify

From `backend`:

```powershell
npm test
```

From `frontend`:

```powershell
npm run lint
npm run build
```

Check API/database health at `http://localhost:5000/health`. Import [`StockFlow.postman_collection.json`](./StockFlow.postman_collection.json) into Postman to try the endpoints. Run **Login** first; its test script stores the returned token in the collection's `accessToken` variable for protected requests. Replace the sample login email and password with the Admin account you created.

## 9. Security and deployment notes

- `.env` contains database credentials and the JWT signing secret; never commit it or share it with Staff.
- The browser must use HTTPS in a deployed environment to protect login credentials and Bearer tokens in transit.
- Configure CORS to allow only the deployed frontend origin; the current development API enables CORS broadly.
- The current access token is held in browser local storage. Keep browsers and devices trusted, sign out on shared devices, and do not paste tokens into public reports.
- The login attempt counter is in-memory and per backend process. A production, multi-instance installation should use a shared rate-limit store.
- Do not expose MySQL directly to end-user devices or the public internet. Only the backend should have database connectivity.
- Use regular database backups and test restoring them.
- Two-factor authentication, automated password reset, and a self-service password-change screen are not part of the current implementation.

## 10. Related project references

- [Quick setup and Workbench walkthrough](../README.md)
- [Database ER diagram](./database-erd.md)
- [Postman API collection](./StockFlow.postman_collection.json)
