# BusinessHub

A production-ready **multi-tenant SaaS web application** for Indian small businesses — kirana stores, clothing shops, hardware stores, electronics retailers, general retail, wholesalers and small distributors.

One deployment serves many businesses. Every business owns its own products, customers, suppliers, stock, invoices, payments, expenses, team members and reports. Tenant data is strictly isolated.

---

## Features

| Module | Highlights |
| --- | --- |
| **Auth** | Register, login, JWT sessions, bcrypt hashing, forgot/reset password, change password, profile |
| **Multi-tenancy** | Every record carries `businessId`; all queries are tenant-scoped; cross-tenant access returns 404 |
| **Onboarding** | Guided 2-step business setup (name, GSTIN, state, invoice prefix, business type…) |
| **Dashboard** | Real-time today's sales/purchases/expenses/profit, receivables/payables, low-stock alerts, 14-day sales & profit chart, recent transactions — all computed from live data |
| **Products** | CRUD, search, filters, pagination, categories, SKU/barcode, GST rates, units, min-stock alerts, opening stock |
| **Inventory** | Auto stock in/out from purchases/sales, manual adjustments, transfers, full audit trail (`InventoryTransaction`), stock valuation |
| **Customers / Suppliers** | CRUD, ledgers with running balance, credit limits, payment history |
| **Sales** | Multi-line invoicing with per-line discount & GST, bill-level discount, CGST/SGST vs IGST by state, partial/credit payments, auto invoice numbering, atomic DB transaction |
| **Purchases** | Same engine as sales; increases stock and supplier dues atomically |
| **Payments** | Customer receipts & supplier payments, auto outstanding updates, ledger entries |
| **Expenses** | Categories, CRUD, methods, references/receipt URL architecture |
| **Invoices** | Professional print-ready tax invoice, share via WhatsApp/Web-Share API, PDF via browser print-to-PDF |
| **GST** | Rate-wise summary, output tax (CGST/SGST/IGST), input credit from purchases, net payable — informational only, **no GSTN filing integration** |
| **Reports** | Sales, purchases, profit & loss, expenses, inventory valuation, customer/supplier outstanding, payments — with Today/Yesterday/Week/Month/custom ranges |
| **Team & RBAC** | OWNER / ADMIN / MANAGER / EMPLOYEE / ACCOUNTANT with server-enforced permission matrix |
| **Notifications** | Low stock, customer credit-limit breach, supplier dues — generated on demand, read/unread |
| **Search** | Global search across products, customers, suppliers, invoices |

## Tech stack

- **Frontend:** React 18, Vite, React Router, Axios, Tailwind CSS, Lucide icons, Recharts
- **Backend:** Node.js, Express, Zod validation, JWT, bcryptjs, Helmet, CORS, Morgan
- **Database:** MySQL 8+ via Prisma ORM (Decimal money types, FK constraints, indexes)
- **Tooling:** Nodemon, ESLint, Concurrently
- **Production:** PM2, Nginx, HTTPS (see `docs/DEPLOYMENT.md`)

## Project structure

```
small-bussiness-portal/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # All models, enums, indexes
│   │   ├── seed.js              # Demo data seeder
│   │   └── migrations/
│   ├── src/
│   │   ├── config/              # env, Prisma client, permission matrix
│   │   ├── controllers/         # HTTP handlers
│   │   ├── middleware/          # auth, RBAC authorize, zod validate, errors
│   │   ├── routes/              # /api router
│   │   ├── services/            # Business logic (tenant-scoped)
│   │   ├── utils/               # jwt, money math, pagination, responses
│   │   ├── validations/         # Zod schemas
│   │   ├── app.js
│   │   └── server.js
│   └── .env                     # secrets — not committed (.env.example provided)
├── frontend/
│   └── src/
│       ├── components/          # UI building blocks
│       ├── context/             # Auth, Toast providers
│       ├── hooks/
│       ├── layouts/             # Sidebar/topbar shell
│       ├── pages/               # One file per route
│       ├── services/api.js      # Axios instance + interceptors
│       └── utils/
└── docs/DEPLOYMENT.md           # Ubuntu VPS + Nginx + PM2 + SSL guide
```

## Requirements

- Node.js ≥ 20
- MySQL 8+
- npm

## Quick start (development)

```bash
# 1) Install all dependencies
npm run install-all

# 2) Configure backend environment
cp backend/.env.example backend/.env
# edit DATABASE_URL, JWT_SECRET

# 3) Create database schema (Prisma migration)
cd backend
npx prisma migrate dev --name init

# 4) Seed demo data
npm run db:seed

# 5) Run both servers (from repo root)
cd ..
npm run dev
# API  → http://localhost:5000  (health: /api/health)
# Web  → http://localhost:5173
```

### Demo credentials (created by seed)

| Role | Email | Password |
| --- | --- | --- |
| Owner | `demo@businesshub.in` | `Demo@1234` |
| Manager | `manager@businesshub.in` | `Demo@1234` |
| Employee | `employee@businesshub.in` | `Demo@1234` |
| Accountant | `accountant@businesshub.in` | `Demo@1234` |

The seed creates "Sharma Kirana & General Store" with categories, products, customers, suppliers, 14 days of sales history, a purchase with due amount and expenses so every dashboard/report has real data.

## MySQL setup

```sql
CREATE DATABASE businesshub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'businesshub'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON businesshub.* TO 'businesshub'@'localhost';
-- Prisma migrate dev also needs shadow-database rights in development:
GRANT ALL PRIVILEGES ON *.* TO 'businesshub'@'localhost';
FLUSH PRIVILEGES;
```

Set `DATABASE_URL="mysql://businesshub:strong-password@localhost:3306/businesshub"`.

## Environment variables

**backend/.env**

```ini
DATABASE_URL="mysql://user:pass@host:3306/businesshub"
PORT=5000
NODE_ENV=production
JWT_SECRET="long-random-secret-min-32-chars"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="https://your-domain.com"
```

**frontend/.env**

```ini
VITE_API_URL=http://localhost:5000     # dev; empty in prod when served behind same domain
```

> Never commit `.env`. Both folders ship `.env.example`.

## Prisma commands (in `backend/`)

```bash
npx prisma generate      # generate client after schema changes
npx prisma migrate dev   # create/apply migration (dev)
npm run db:deploy        # apply migrations (production)
npm run db:studio        # visual DB browser
npm run db:seed          # seed demo data
```

## Development commands

| Root | Purpose |
| --- | --- |
| `npm run install-all` | install root + backend + frontend deps |
| `npm run dev` | run API (nodemon) + web (vite) together |
| `npm run build` | production frontend build → `frontend/dist` |
| `npm run db:migrate` / `db:seed` / `db:studio` | database helpers |

## API overview

Base URL `/api`. Consistent envelope:

```json
{ "success": true, "message": "...", "data": { ... } }
{ "success": false, "message": "Validation failed", "errors": [{ "field": "...", "message": "..." }] }
```

Route groups: `/auth`, `/business`, `/users`, `/categories`, `/products`, `/inventory`, `/customers`, `/suppliers`, `/sales`, `/purchases`, `/payments/customer`, `/payments/supplier`, `/expenses`, `/invoices/:saleId`, `/reports/*`, `/gst/summary`, `/notifications`, `/search`, `/health`.

Authentication: `Authorization: Bearer <token>` header.

### Email integration (forgot password)

Forgot-password generates a single-use hashed token valid for 1 hour. In development the token is returned in the response for testing. To deliver it by email in production, plug an SMTP provider into `src/services/auth.service.js → forgotPassword()` (e.g. Nodemailer + SMTP creds or SendGrid/SES API key stored in env). No provider is configured by default — no fake sending.

### Payment gateway integration

No payment gateway is bundled. Payment *recording* is fully implemented; to collect online, add a gateway (Razorpay/PayU) server SDK, store keys in env, and create an order/webhook endpoint that calls `POST /api/payments/customer` on confirmation.

## Production build & deploy

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full Ubuntu VPS guide: Node + MySQL install, PM2 process management, Nginx reverse proxy, domain DNS, Certbot SSL, migration strategy, backups and update procedure. In production Express serves the built frontend and the API from one port.

## Database backup

```bash
mysqldump -u businesshub -p --single-transaction businesshub | gzip > bh_$(date +%F).sql.gz
# restore
gunzip < bh_2026-01-01.sql.gz | mysql -u businesshub -p businesshub
```
Schedule with cron (daily example): `0 2 * * * mysqldump ... >/var/backups/bh_$(date +\%F).sql.gz`

## Security notes

- Passwords hashed with bcryptjs (12 rounds)
- JWT signed with HS256; secret required ≥ 16 chars
- Helmet security headers, strict CORS allow-list, auth rate limiting
- Zod validation on every request body/query/params
- SQL-injection safe via Prisma parameterized queries
- Tenant isolation enforced in services + verified in tests
- Money stored as `DECIMAL(14,2)` / quantities as `DECIMAL(14,3)` — never floats
- Sales/purchases run inside interactive Prisma transactions with row locks (`SELECT ... FOR UPDATE`) to prevent overselling

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `P1001 can't reach database` | MySQL not running / wrong `DATABASE_URL` |
| `P1010 denied access … shadow db` | Dev-only: grant the DB user privileges on `*.*` (shadow DBs) |
| `EADDRINUSE :5000` | Another process on port 5000 — change `PORT` |
| Login loops back to /login | Backend unreachable — check `VITE_API_URL`/proxy and that API health responds |
| Empty dashboard | No transactions yet for your tenant — make a sale/purchase |
| Seed says "already seeded" | Demo user exists; drop the database to re-seed |
