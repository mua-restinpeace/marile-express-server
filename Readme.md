# 🐟 Marile API

A RESTful backend API for a Marile UMKM — handling inventory management, cashier POS, and an admin dashboard.

Built with **Express.js**, **Prisma ORM**, and **MySQL**.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles & Permissions](#roles--permissions)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
  - [Public](#public)
  - [Auth](#auth)
  - [Users](#users)
  - [Products](#products)
  - [Inventory](#inventory)
  - [Transactions](#transactions)
  - [Dashboard](#dashboard)
- [Authentication Flow](#authentication-flow)
- [Error Handling](#error-handling)
- [Default Accounts](#default-accounts)

---

## Tech Stack

| Layer            | Technology                            |
| ---------------- | ------------------------------------- |
| Framework        | Express.js                            |
| ORM              | Prisma v6                             |
| Database         | MySQL (via Laragon)                   |
| Authentication   | JWT (access + refresh token rotation) |
| Password Hashing | bcryptjs (cost factor 12)             |
| Runtime          | Node.js v18+                          |

---

## Project Structure

```
marile-api/
├── prisma/
│   └── schema.prisma           # Database schema — all models and enums
├── src/
│   ├── config/
│   │   └── prisma.js           # Prisma client singleton
│   ├── controllers/
│   │   ├── authController.js   # Login, logout, token refresh
│   │   ├── userController.js   # Staff account management
│   │   ├── productController.js
│   │   ├── inventoryController.js
│   │   ├── transactionController.js
│   │   ├── dashboardController.js
│   │   └── publicController.js # Public landing page - no auth required
│   ├── middleware/
│   │   ├── auth.js             # authenticate + authorize() middleware
│   │   └── errorHandler.js     # Global error and 404 handler
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── products.js
│   │   ├── inventory.js
│   │   ├── transactions.js
│   │   ├── dashboard.js
│   │   └── public.js           # No auth middleware applied
│   ├── utils/
│   │   ├── jwt.js              # Token generation and verification helpers
│   │   └── response.js         # Standardized success/error response helpers
│   └── seeder.js               # Seeds default users and sample products
├── index.js                    # App entry point and server bootstrap
├── .env                        # Environment variables
└── package.json
```

---

## Roles & Permissions

The system has two authenticated roles. Public (unauthenticated) users can only access the `/api/public` endpoints.

| Feature                          | Public | Admin | Cashier |
| -------------------------------- | :----: | :---: | :-----: |
| Browse menu & best sellers       |   ✅   |  ✅   |   ✅    |
| Login / Logout                   |   ❌   |  ✅   |   ✅    |
| View own profile                 |   ❌   |  ✅   |   ✅    |
| Update own name & username       |   ❌   |  ✅   |   ✅    |
| Change own password              |   ❌   |  ✅   |   ✅    |
| Manage staff accounts (CRUD)     |   ❌   |  ✅   |   ❌    |
| Update any user's role or status |   ❌   |  ✅   |   ❌    |
| View products                    |   ❌   |  ✅   |   ✅    |
| Create / Edit / Delete products  |   ❌   |  ✅   |   ❌    |
| Restock & adjust inventory       |   ❌   |  ✅   |   ❌    |
| View inventory logs              |   ❌   |  ✅   |   ❌    |
| Create transactions              |   ❌   |  ✅   |   ✅    |
| View own transactions            |   ❌   |  ✅   |   ✅    |
| View all transactions            |   ❌   |  ✅   |   ❌    |
| Void own transactions            |   ❌   |  ✅   |   ✅    |
| Void any transaction             |   ❌   |  ✅   |   ❌    |
| Dashboard & reports              |   ❌   |  ✅   |   ❌    |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Laragon](https://laragon.org) running with MySQL on port `3306`

### 1. Clone and install

```bash
git clone https://github.com/mua-restinpeace/marile-express-server.git
cd marile-api
npm install
```

### 2. Create the database

Open phpMyAdmin at `http://localhost/phpmyadmin` and run:

```sql
CREATE DATABASE marile_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 3. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Laragon's default MySQL has no password, so the default `DATABASE_URL` works out of the box. If you set a password, update it accordingly.

### 4. Run database migration

```bash
npm run db:migrate
```

```bash
npm run db:generate
```

This reads `prisma/schema.prisma`, generates the SQL, and creates all tables in MySQL.

### 5. Start the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:3000`. On first boot it auto-seeds the database with default accounts and sample products.

---

## Environment Variables

| Variable                 | Description                                | Default                                  |
| ------------------------ | ------------------------------------------ | ---------------------------------------- |
| `PORT`                   | Server port                                | `3000`                                   |
| `NODE_ENV`               | Environment (`development` / `production`) | `development`                            |
| `DATABASE_URL`           | MySQL connection string                    | `mysql://root:@localhost:3306/marile_db` |
| `JWT_ACCESS_SECRET`      | Secret key for access tokens               | ⚠️ Change this                           |
| `JWT_REFRESH_SECRET`     | Secret key for refresh tokens              | ⚠️ Change this                           |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifetime                      | `15m`                                    |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime                     | `7d`                                     |

---

## Database Schema

### Models

**`User`** — Staff accounts (admin and cashier only)

| Field        | Type            | Notes                |
| ------------ | --------------- | -------------------- |
| `id`         | `String` (UUID) | Primary key          |
| `name`       | `String`        | Display name         |
| `username`   | `String`        | Unique, lowercase    |
| `password`   | `String`        | bcrypt hashed        |
| `role`       | `Enum`          | `admin` or `cashier` |
| `is_active`  | `Boolean`       | Soft-delete flag     |
| `created_at` | `DateTime`      |                      |
| `updated_at` | `DateTime`      | Auto-updated         |

**`RefreshToken`** — Active sessions per user

| Field        | Type            | Notes                                              |
| ------------ | --------------- | -------------------------------------------------- |
| `id`         | `String` (UUID) | Primary key                                        |
| `userId`     | `String`        | FK → User (not unique — supports multiple devices) |
| `token`      | `String`        | Unique, max 512 chars                              |
| `expired_at` | `DateTime`      |                                                    |

**`Product`** — Fish and related products

| Field         | Type            | Notes                                     |
| ------------- | --------------- | ----------------------------------------- |
| `id`          | `String` (UUID) | Primary key                               |
| `name`        | `String`        | Must be unique                            |
| `description` | `String?`       | Optional                                  |
| `category`    | `Enum`          | `protein`, `sayur`, `buah`, `lainnya`     |
| `price`       | `Decimal(12,2)` | Per unit                                  |
| `stock`       | `Decimal(10,3)` | Supports fractional weights (e.g. 0.5 kg) |
| `unit`        | `Enum`          | `kg`, `pcs`, `ekor`                       |
| `image_url`   | `String?`       | URL string only                           |
| `is_active`   | `Boolean`       | Soft-delete flag                          |
| `created_at`  | `DateTime`      |                                           |
| `updated_at`  | `DateTime`      | Auto-updated                              |

**`Transaction`** — Sales records

| Field            | Type             | Notes                               |
| ---------------- | ---------------- | ----------------------------------- |
| `id`             | `String` (UUID)  | Primary key                         |
| `invoice_no`     | `String`         | Auto-generated: `INV-YYYYMMDD-XXXX` |
| `cashierId`      | `String`         | FK → User                           |
| `payment_method` | `Enum`           | `Cash`, `Qris`, `BankTransfer`      |
| `total`          | `Decimal(12,2)`  | Calculated from items               |
| `amount_paid`    | `Decimal(12,2)?` | Required for Cash                   |
| `change`         | `Decimal(12,2)?` | Calculated for Cash                 |
| `status`         | `Enum`           | `completed`, `canceled`             |

**`TransactionItem`** — Line items within a transaction

| Field            | Type            | Notes                             |
| ---------------- | --------------- | --------------------------------- |
| `id`             | `String` (UUID) | Primary key                       |
| `transactionsId` | `String`        | FK → Transaction                  |
| `product_name`   | `String`        | Snapshot of name at time of sale  |
| `quantity`       | `Decimal(10,3)` |                                   |
| `unit_price`     | `Decimal(12,2)` | Snapshot of price at time of sale |
| `sub_total`      | `Decimal(12,2)` | `quantity × unit_price`           |

**`InventoryLog`** — Every stock movement, ever

| Field        | Type            | Notes                                   |
| ------------ | --------------- | --------------------------------------- |
| `id`         | `String` (UUID) | Primary key                             |
| `productsId` | `String`        | FK → Product                            |
| `type`       | `Enum`          | `restock`, `sale`, `adjustment`, `void` |
| `quantity`   | `Decimal(10,3)` | Negative for outgoing stock (sales)     |
| `note`       | `String?`       | Required for `adjustment` type          |
| `created_by` | `String?`       | FK → User                               |

---

## API Reference

All responses follow a consistent envelope:

```json
// Success
{ "success": true, "message": "...", "data": { ... } }

// Error
{ "success": false, "message": "..." }
```

### Public

> No authentication required. These endpoints are intentionally open — they serve the public-facing landing page of the storefront.

#### `GET /api/public/menu`

Returns the product menu and best seller list for a given category. This is the primary data source for the landing page.

**Best seller ranking** is calculated from actual completed transaction history — products that have sold the most quantity come first. If no transactions exist yet (e.g. a brand new store), the endpoint falls back to returning the newest active products instead so the landing page is never empty.

**Query parameters:**

| Param      | Type     | Default   | Description                                             |
| ---------- | -------- | --------- | ------------------------------------------------------- |
| `category` | `string` | `protein` | Filter by product category. Must be a valid enum value. |
| `take`     | `number` | `8`       | Max number of items to return. Capped at `100`.         |

**Valid category values:** `ikan_segar`, `ikan_asin`, `protein`, `olahan_ikan`, `lainnya`

**Example request:**

```
GET /api/public/menu?category=protein&take=8
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "best_seller": [
      {
        "product_id": "uuid-here",
        "product_name": "Ikan Bandeng Presto Bumbu Bali",
        "price": 45000,
        "image_url": "https://example.com/bandeng.jpg",
        "total_qty_sold": 12.5
      },
      {
        "product_id": "uuid-here",
        "product_name": "Ikan Kembung Bumbu Kuning",
        "price": 38000,
        "image_url": "https://example.com/kembung.jpg",
        "total_qty_sold": 8.0
      }
    ],
    "menu": [
      {
        "id": "uuid-here",
        "name": "Ikan Bandeng Presto Bumbu Bali",
        "image_url": "https://example.com/bandeng.jpg",
        "price": "45000.00"
      },
      {
        "id": "uuid-here",
        "name": "Ikan Kembung Bumbu Kuning",
        "image_url": "https://example.com/kembung.jpg",
        "price": "38000.00"
      }
    ]
  }
}
```

**Response fields:**

| Field                          | Description                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `best_seller`                  | Products ranked by total quantity sold (descending). Uses current price, not historical sale price.        |
| `best_seller[].total_qty_sold` | Cumulative quantity sold across all completed transactions. `0` means it's a fallback item (no sales yet). |
| `menu`                         | Full active product catalog for the given category, ordered by newest first.                               |

**Error responses:**

| Status | Reason                   |
| ------ | ------------------------ |
| `400`  | Invalid `category` value |
| `500`  | Server error             |

---

### Auth

#### `POST /api/auth/login`

Authenticate a staff member and receive tokens.

**Request body:**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "name": "Administrator",
      "username": "admin",
      "role": "admin"
    },
    "access_token": "eyJ..."
  }
}
```

Tokens are also set as `httpOnly` cookies (`access_token`, `refresh_token`).

---

#### `POST /api/auth/refresh`

Exchange a valid refresh token for a new access token. Old refresh token is deleted (rotation).

Reads from cookie automatically, or pass in body:

```json
{ "refresh_token": "eyJ..." }
```

**Response `200`:**

```json
{ "data": { "access_token": "eyJ..." } }
```

---

#### `POST /api/auth/logout`

Revoke the current refresh token and clear cookies.

---

#### `POST /api/auth/logout-all` 🔒

Revoke all refresh tokens for the current user (logs out all devices).

---

#### `GET /api/auth/me` 🔒

Return the currently authenticated user's profile.

**Response `200`:**

```json
{
  "data": {
    "user": {
      "id": "...",
      "name": "Administrator",
      "username": "admin",
      "role": "admin",
      "created_at": "..."
    }
  }
}
```

---

### Users

> All endpoints require `admin` role, except `PUT /:id/password`.

#### `GET /api/users` 🔒 Admin

List all staff accounts.

#### `POST /api/users` 🔒 Admin

Create a new staff account.

```json
{
  "name": "Kasir Dua",
  "username": "kasir2",
  "password": "kasir456",
  "role": "cashier"
}
```

#### `PUT /api/users/:id` 🔒 Admin or Cashier (own)

Update user information. Behavior differs by role:

**Admin** can update any user's `name`, `username`, `role`, and `is_active`. Cannot deactivate their own account.

**Cashier** can only update their own `name` and `username`. Attempting to update another user's record or change `role` is rejected.

```json
{ "name": "Kasir Dua Updated", "username": "kasir2baru" }
```

**Rules enforced:**

| Field       | Admin               | Cashier        |
| ----------- | ------------------- | -------------- |
| `name`      | Any user            | Own only       |
| `username`  | Any user            | Own only       |
| `role`      | Any user            | ❌ Not allowed |
| `is_active` | Any user (not self) | ❌ Not allowed |

**Error responses:**

| Status | Reason                                       |
| ------ | -------------------------------------------- |
| `400`  | Cashier trying to update another user        |
| `400`  | Cashier trying to update their own role      |
| `400`  | Admin trying to deactivate their own account |
| `400`  | Username already taken                       |
| `404`  | User not found                               |

#### `DELETE /api/users/:id` 🔒 Admin

Soft-delete (deactivate) a user. Also revokes all their active sessions.

#### `PUT /api/users/:id/password` 🔒 Admin or Cashier (own)

Admin can reset anyone's password without needing the current password. Cashier must provide `current_password` and can only change their own. Password change revokes all active sessions for that user, forcing a re-login on all devices.

**Admin request body:**

```json
{
  "new_password": "newsecurepassword"
}
```

**Cashier request body:**

```json
{
  "current_password": "kasir123",
  "new_password": "newpassword456"
}
```

---

### Products

#### `GET /api/products` 🔒 Admin, Cashier

List products with optional filters.

**Query parameters:**

| Param       | Type      | Description                |
| ----------- | --------- | -------------------------- |
| `search`    | `string`  | Search name or description |
| `category`  | `string`  | Filter by category         |
| `unit`      | `string`  | Filter by unit             |
| `is_active` | `boolean` | `true` or `false`          |
| `page`      | `number`  | Default `1`                |
| `limit`     | `number`  | Default `20`, max `100`    |

**Response `200`:**

```json
{
  "data": {
    "products": [ { "id": "...", "name": "Ikan Bandeng Presto", "price": "45000.00", "stock": "50.000", ... } ],
    "pagination": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

#### `GET /api/products/:id` 🔒 Admin, Cashier

Get a single product by ID.

#### `POST /api/products` 🔒 Admin

Create a new product.

```json
{
  "name": "Ikan Bandeng Presto Bumbu Bali",
  "description": "Bandeng presto dengan bumbu Bali khas",
  "category": "ikan_bumbu",
  "price": 45000,
  "stock": 50,
  "unit": "ekor",
  "image_url": "https://example.com/bandeng.jpg"
}
```

> **Note:** `stock` set here is the initial stock. All subsequent stock changes must go through the inventory endpoints.

#### `PUT /api/products/:id` 🔒 Admin

Partial update — only include fields you want to change. **`stock` cannot be changed here** — use `/api/inventory/restock` or `/api/inventory/adjust` instead.

#### `DELETE /api/products/:id` 🔒 Admin

Smart delete:

- If the product has no transaction history → **permanently deleted**
- If the product has transaction history → **soft-deleted** (`is_active = false`)

---

### Inventory

> All endpoints require `admin` role.

#### `POST /api/inventory/restock` 🔒 Admin

Add stock to a product. Always creates an inventory log entry.

```json
{
  "productsId": "uuid-here",
  "quantity": 20,
  "note": "Restok dari supplier Pak Budi"
}
```

**Response `201`:**

```json
{
  "data": {
    "product": { "id": "...", "name": "Ikan Bandeng Presto", "stock": "70.000", "unit": "ekor" },
    "log": { "id": "...", "type": "restock", "quantity": "20.000", ... }
  }
}
```

#### `POST /api/inventory/adjust` 🔒 Admin

Manually correct stock — can be positive (add) or negative (subtract). `note` is **required** for accountability. Blocked if adjustment would result in negative stock.

```json
{
  "productsId": "uuid-here",
  "quantity": -3,
  "note": "Koreksi stok setelah stock opname"
}
```

#### `GET /api/inventory/logs` 🔒 Admin

Paginated log of all stock movements.

**Query parameters:**

| Param        | Type     | Description                             |
| ------------ | -------- | --------------------------------------- |
| `productsId` | `string` | Filter by product                       |
| `type`       | `string` | `restock`, `sale`, `adjustment`, `void` |
| `page`       | `number` | Default `1`                             |
| `limit`      | `number` | Default `20`                            |

#### `GET /api/inventory/low-stock` 🔒 Admin

Products at or below the stock threshold.

**Query parameters:**

| Param       | Type     | Default |
| ----------- | -------- | ------- |
| `threshold` | `number` | `5`     |

---

### Transactions

#### `POST /api/transactions` 🔒 Admin, Cashier

Create a new transaction. This is the core POS action.

- Validates stock availability for all items before writing anything
- Decrements stock atomically across all items
- Writes an inventory log entry per item
- Auto-generates invoice number in format `INV-YYYYMMDD-XXXX`

```json
{
  "payment_method": "Cash",
  "amount_paid": 100000,
  "items": [
    { "productsId": "uuid-here", "quantity": 2 },
    { "productsId": "uuid-here", "quantity": 0.5 }
  ]
}
```

> `amount_paid` is required for `Cash` payments. Optional for `Qris` and `BankTransfer`.

**Response `201`:**

```json
{
  "data": {
    "transaction": {
      "id": "...",
      "invoice_no": "INV-20250509-0001",
      "total": "90000.00",
      "amount_paid": "100000.00",
      "change": "10000.00",
      "status": "completed",
      "cashier": { "id": "...", "name": "Kasir Satu" },
      "transactionItems": [ ... ]
    }
  }
}
```

#### `GET /api/transactions` 🔒 Admin, Cashier

List transactions with filters.

- **Admin** sees all transactions
- **Cashier** sees only their own

**Query parameters:**

| Param            | Type     | Description                    |
| ---------------- | -------- | ------------------------------ |
| `status`         | `string` | `completed` or `canceled`      |
| `payment_method` | `string` | `Cash`, `Qris`, `BankTransfer` |
| `date`           | `string` | Format: `YYYY-MM-DD`           |
| `page`           | `number` | Default `1`                    |
| `limit`          | `number` | Default `20`                   |

#### `GET /api/transactions/:id` 🔒 Admin, Cashier

Get a single transaction. Cashier can only view their own — returns `404` (not `403`) if they try to access another cashier's transaction.

#### `POST /api/transactions/:id/void` 🔒 Admin, Cashier

Void a transaction. **Stock is restored for all items** and a `void` log entry is written per item.

- Admin can void any transaction
- Cashier can only void their own

```json
{ "reason": "Pesanan dibatalkan oleh pelanggan" }
```

---

### Dashboard

> All endpoints require `admin` role.

The frontend is designed to call all 4 endpoints in parallel on page load.

#### `GET /api/dashboard/summary` 🔒 Admin

Key business metrics for a given period.

**Query parameters:**

| Param    | Values                   | Default |
| -------- | ------------------------ | ------- |
| `period` | `today`, `week`, `month` | `today` |

**Response `200`:**

```json
{
  "data": {
    "period": "today",
    "date_range": {
      "from": "2025-05-09T00:00:00.000Z",
      "to": "2025-05-09T14:30:00.000Z"
    },
    "total_revenue": 190000,
    "total_transactions": 3,
    "total_items_sold": 8.5,
    "average_order_value": 63333.33,
    "voided_count": 0
  }
}
```

#### `GET /api/dashboard/revenue-chart` 🔒 Admin

Day-by-day or month-by-month revenue trend. All dates are filled in — no gaps — ready to feed directly into a chart library.

**Query parameters:**

| Param   | Values       | Default |
| ------- | ------------ | ------- |
| `range` | `30d`, `12m` | `30d`   |

**Response `200` (30d):**

```json
{
  "data": {
    "range": "30d",
    "data": [
      { "date": "2025-04-10", "revenue": 0, "transactions": 0 },
      { "date": "2025-04-11", "revenue": 125000, "transactions": 2 },
      ...
      { "date": "2025-05-09", "revenue": 190000, "transactions": 3 }
    ]
  }
}
```

#### `GET /api/dashboard/top-products` 🔒 Admin

Top 5 products ranked by quantity sold and by revenue. Returns both lists.

**Query parameters:**

| Param    | Values                          | Default |
| -------- | ------------------------------- | ------- |
| `period` | `today`, `week`, `month`, `all` | `today` |

**Response `200`:**

```json
{
  "data": {
    "period": "today",
    "top_by_quantity": [
      { "product_name": "Ikan Bandeng Presto", "total_qty_sold": 4.5, "total_revenue": 202500, "current_stock": 45.5 },
      ...
    ],
    "top_by_revenue": [ ... ]
  }
}
```

#### `GET /api/dashboard/snapshot` 🔒 Admin

Operational pulse — no query params, always reflects right now.

**Response `200`:**

```json
{
  "data": {
    "low_stock": {
      "threshold": 5,
      "count": 1,
      "products": [
        { "name": "Otak-Otak Ikan Tenggiri", "stock": "3.000", "unit": "pcs" }
      ]
    },
    "cashier_activity": [
      { "cashier_name": "Kasir Satu", "transactions_today": 3, "revenue_today": 190000 }
    ],
    "recent_transactions": [
      { "invoice_no": "INV-20250509-0003", "total": "90000.00", "status": "completed", "cashier": { "name": "Kasir Satu" }, ... }
    ]
  }
}
```

---

## Authentication Flow

```
1. User submits credentials to POST /api/auth/login
        │
        ▼
2. Server returns access_token (15 min) + refresh_token (7 days)
   Both set as httpOnly cookies. access_token also in response body.
        │
        ▼
3. Client uses access_token in Authorization header for every request:
   Authorization: Bearer <access_token>
        │
        ├── Token valid → request proceeds normally
        │
        └── Token expired (401) → client silently calls POST /api/auth/refresh
                │
                ├── Refresh valid → new access_token issued, original request retried
                │
                └── Refresh expired → redirect user to login page
```

**Multi-device support:** One user can have multiple active refresh tokens simultaneously (one per device/session). `POST /api/auth/logout-all` revokes all of them at once.

**Token rotation:** Every call to `/refresh` deletes the old refresh token and issues a new one.

---

## Error Handling

All errors return a consistent JSON structure:

```json
{ "success": false, "message": "Description of what went wrong" }
```

| Status | Meaning                                            |
| ------ | -------------------------------------------------- |
| `400`  | Validation error — missing or invalid fields       |
| `401`  | Not authenticated or token expired                 |
| `403`  | Authenticated but not authorized (wrong role)      |
| `404`  | Resource not found                                 |
| `409`  | Conflict — e.g. duplicate username or product name |
| `500`  | Internal server error                              |

---

## Default Accounts

These accounts are automatically created on first server start.

| Role    | Username | Password   |
| ------- | -------- | ---------- |
| Admin   | `admin`  | `admin123` |
| Cashier | `kasir1` | `kasir123` |

> ⚠️ Change these passwords immediately after first login, especially in a production environment.

---

## Useful Commands

```bash
# Start in development mode (auto-restart)
npm run dev

# Start in production mode
npm start

# Run database migration (after schema changes)
npm run db:migrate

# Open Prisma Studio — visual database browser
npm run db:studio

# Regenerate Prisma client (after manual schema edits)
npm run db:generate

# Reset database and re-run all migrations (⚠️ deletes all data)
npm run db:reset
```
