# ICEPRO ERP

**Full-stack Ice Cream Distribution & Billing Management System** for _Vrundavan Ice Cream / Vrundavan Milk Products_ — agency ledgers, GST / Non-GST invoicing, inventory, payment tracking, and analytics in one place.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-8-880000?logo=mongoose&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)
![Puppeteer](https://img.shields.io/badge/PDF-Puppeteer-40B5A4?logo=puppeteer&logoColor=white)
![Live](https://img.shields.io/badge/Live-Vercel%20%2B%20Render-black?logo=vercel)

---

## 🔗 Live Demo

**[https://icepro-eight.vercel.app/](https://icepro-eight.vercel.app/)**

Frontend on Vercel · API on Render · MongoDB Atlas.

> ⏱️ The API sleeps after 15 minutes idle on Render's free tier — the **first** request can take 30–60s to wake it. Everything after that is fast.
>
> Signup is gated by a shared secret code, so the demo is not open-registration. A preview login can be provided on request.

---

## 📌 Overview

ICEPRO ERP replaces a spreadsheet-and-memory workflow for a regional ice-cream distributor with a real web application: create agencies, take orders, generate GST and Non-GST invoices with auto-incrementing invoice numbers, track stock down to the box, record payments against outstanding balances, and read the whole business from a dashboard and analytics reports.

It is used by the business **owner** and **managers**. It deliberately demonstrates production backend patterns — layered controller → service architecture, JWT auth with refresh-token rotation, RBAC, request validation, rate limiting, atomic MongoDB transactions, and an event-sourced inventory ledger — rather than a toy CRUD app. It began life on Firebase and was migrated to a self-owned MERN backend.

**Scale:** ~13,700 LOC · 52 REST endpoints across 10 route groups (plus a `/health` check per group).

---

## ✨ Features

### Authentication & Security
- **JWT access + refresh tokens** — short-lived access token in the `Authorization` header; long-lived refresh token in an `httpOnly` cookie, **hashed in the database and rotated on every use**, so logout revokes a session for real.
- **Password hashing** — `bcryptjs` (salted, pre-save hook; passwords never returned in queries).
- **Google Sign-In** — verified server-side via `google-auth-library`, with a separate Google-registration path and profile-autofill endpoint.
- **Signup gate** — a shared secret code exchanged for a short-lived signup *ticket*, plus live email/username availability checks.
- **Email verification & self-service password reset** — token-based flows, both delivered over Brevo's HTTP API.
- **Enumeration resistance** — timing-safe comparison and a dummy bcrypt hash on the login path, so a wrong email and a wrong password cost the same.
- **Account lockout** — configurable max login attempts + lock window.
- **HTTP hardening** — `helmet`, CORS allow-list, `express-mongo-sanitize` (NoSQL-injection protection), and tiered `express-rate-limit` (global, strict, sensitive, lookup, and refresh limiters).

### Role-Based Access Control
Two enforced roles — **`owner`** and **`manager`** — via a `requireRole()` middleware layered on top of JWT auth. New accounts default to `manager`. See [User Roles](#-user-roles).

### Core Modules
- **Agency Management** — create, edit, list agencies, per-agency transaction ledger, owner-only activate/deactivate.
- **Product Management** — full CRUD, plus owner-only catalog seed / re-seed.
- **Order-first Billing (GST / Non-GST)** — bills move through a `pending → delivered → cancelled` lifecycle. A **pending order reserves stock but books no money** (no invoice number, no ledger row, not in the agency balance), which is exactly what makes it safely editable. Delivery assigns the invoice number and books the revenue. Two invoice series: `VMP/YY-YY/####` (GST tax invoice) and `GB/YY-YY/####` (Non-GST).
- **Inventory** — an **immutable `StockMovement` ledger** is the source of truth; `onHand` / `committed` counters on `Product` are a cache kept in step inside the same transaction. `available = onHand − committed` is **derived, never stored**, and a negative value is the production-shortfall signal. Manual movement types (opening, production, return, damage, adjustment) carry a server-derived sign, so "damage: +50" can never silently *add* stock.
- **Payment Tracking** — record payments against agencies, atomically updating balances.
- **Dashboard** — aggregated business metrics.
- **Reports & Analytics** — a single MongoDB `$facet` aggregation returning KPIs plus filter-dependent product/agency breakdowns.
- **Server-side PDF** — invoices and reports rendered to A4 PDFs by headless Chrome (Puppeteer).
- **Settings & Profile** — business/bank details (owner-only), plus self-service profile and password change.

---

## 🧠 Design Notes

The three decisions worth reading the code for:

**1. Correctness under concurrency is enforced at the database, not in the service layer.**
Invoice numbers come from an atomic `findOneAndUpdate` + `$inc` counter. A bill and its ledger `Transaction` are written inside one Mongoose **session (ACID transaction)**, so a failed ledger write rolls the bill back. And the "one open order per agency" rule is a **partial unique index** — a service-level `findOne`-then-`insert` check is a race two concurrent requests both win, and no amount of application code closes it.

**2. The inventory engine is a pure diff.**
`applyBillStock(prevBill, nextBill)` is the only code that knows how a bill affects stock. It doesn't care which operation you're performing — only what the bill looked like before and after:

```
Create   → applyBillStock(null,        bill)
Edit     → applyBillStock(oldBill,     newBill)
Deliver  → applyBillStock(pendingBill, deliveredBill)
Cancel   → applyBillStock(bill,        cancelledBill)
```

A bill that doesn't exist holds nothing, which is why create and delete fall out of the same arithmetic as every other transition.

**3. Money is priced on the server, never trusted from the client.**
`item.amount = qty × rate × (1 − disc/100)` is computed backend-side, and the total discount is *derived* rather than accepted from the request — taking it from the client would double-count a discount already baked into each line.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Create React App), Axios |
| **Backend** | Node.js 20, Express 4 |
| **Database** | MongoDB (Atlas), Mongoose 8 (ODM) |
| **Auth** | `jsonwebtoken`, `bcryptjs`, `google-auth-library`, `cookie-parser` |
| **Security** | `helmet`, `cors`, `express-mongo-sanitize`, `express-rate-limit`, `express-validator` |
| **PDF** | `puppeteer` (headless Chrome) |
| **Email** | Brevo HTTP API (`nodemailer` retained only for the Ethereal dev sandbox) |
| **Hosting** | Vercel (frontend) · Render (API) · MongoDB Atlas (database) |

> Styling is vanilla CSS (no Tailwind); state is React `useState` / `useEffect` (no Redux).

---

## 🏛️ Architecture

```
  Browser (React SPA, frontend/)
        │
        │  Axios  ·  JWT Bearer header  ·  httpOnly refresh cookie
        ▼
  Express REST API (backend/)
        │   route → validator → auth/RBAC middleware → controller → service
        ▼
  Mongoose ODM  (sessions/transactions for multi-document writes)
        ▼
  MongoDB Atlas
```

**Standard API response format** — every endpoint returns a consistent envelope:

```jsonc
// success
{ "success": true,  "message": "…", "data":   { /* payload */ } }
// error
{ "success": false, "message": "…", "errors": [ /* details */ ] }
```

---

## 📁 Folder Structure

```
icepro/
├── package.json              # Root: convenience scripts only (no runtime deps)
├── vercel.json               # Vercel build config (builds from frontend/)
├── DEPLOYMENT.md             # Step-by-step deploy guide + free-tier tradeoffs
├── ICEPRO_MEMORY.md          # Project single-source-of-truth doc
├── TDD.md                    # Technical design document
│
├── frontend/                 # React app (Create React App)
│   ├── .env.example
│   └── src/
│       ├── App.js            # Auth guard + screen routing
│       ├── api.js            # Central Axios instance (JWT + silent-refresh queue)
│       └── components/
│           ├── Auth.js         Dashboard.js     AgencyModal.js
│           ├── BillModal.js    PaymentModal.js  ProductsPage.js
│           ├── InventoryPage.js ReportsPage.js  ProfilePage.js
│           └── Settings.js     UI.js
│
└── backend/                  # Node.js + Express REST API
    ├── .env.example          # Also the deployment checklist ([PROD] markers)
    ├── .puppeteerrc.cjs      # Keeps Chrome inside the project (build → runtime)
    ├── src/app.js            # Server bootstrap (middleware order is intentional)
    ├── config/               # database.js, cloudinary.js (no-op scaffold)
    ├── constants/            # ROLES, BILL_TYPES, BILL_STATUS, STOCK_MOVEMENT_TYPES, …
    ├── models/               # User, Agency, Bill, Payment, Transaction, Product,
    │                         #   StockMovement, Counter, Settings
    ├── routes/               # auth, users, products, agencies, bills, payments,
    │                         #   dashboard, settings, reports, inventory
    ├── controllers/          # HTTP layer (req → service → res)
    ├── services/             # Business logic (bill, inventory, reports, pdf, …)
    ├── middleware/           # auth (protect), role (requireRole), rateLimiter, errors
    ├── validators/           # express-validator rule sets
    ├── templates/            # invoice + report HTML for the PDF engine
    ├── scripts/              # backfillProductIds.js, seedOpeningStock.js
    └── utils/                # ApiResponse, ApiError, logger, tokens, email
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20** (the project pins `>=20 <21`)
- **MongoDB** — an Atlas cluster (recommended; transactions require a replica set) or a local `mongod` running as a replica set

### 1. Clone
```bash
git clone https://github.com/Utsav-tala/icepro.git
cd icepro
```

### 2. Install & run
```bash
npm run install:all     # installs root, backend, and frontend
npm run dev             # starts BOTH apps (API on :8000, React on :3000)
```

Or run them separately:

```bash
cd backend  && npm install && cp .env.example .env && npm run dev
cd frontend && npm install && cp .env.example .env && npm start
```

The frontend proxies `/api/*` to `http://localhost:8000` in development.

> `npm install` in `backend/` also downloads Chrome for Puppeteer (~150MB) via a `postinstall` hook. That is expected, and `.puppeteerrc.cjs` keeps it inside the project.

### 3. Environment Variables

**`backend/.env.example` and `frontend/.env.example` are the authoritative, fully-commented checklists** — each variable explains what breaks if it's missing. The ones that fail *silently* in production:

| Variable | Why it matters |
|---|---|
| `NODE_ENV=production` | Switches the refresh cookie to `Secure` + `SameSite=None`. Without it, login works and then users are logged out on refresh. |
| `FRONTEND_ORIGIN` | The CORS allow-list origin. Without it, every API call is blocked by the browser. |
| `FRONTEND_URL` | Base URL for links inside emails. Without it, every new user gets a `localhost` link. |
| `MONGO_URI` · `JWT_SECRET` · `REFRESH_TOKEN_SECRET` | Required — the app cannot run without them. |
| `BREVO_API_KEY` + `EMAIL_FROM` | Email delivery. `EMAIL_FROM` must be a **verified sender** in Brevo. |
| `REACT_APP_API_URL` (frontend) | The API origin. Without it, the deployed SPA asks Vercel for `/api` and 404s on every request. |

Never commit a real `.env`.

---

## 🔌 API Overview

Base path: **`/api`**. Every route except the public auth endpoints requires a valid JWT. Counts below exclude the `/health` check each group exposes.

| Route group | Endpoints | Purpose |
|---|:--:|---|
| `/api/auth` | 15 | Register, login, refresh, logout, Google sign-in/register, email verification, forgot/reset password, availability checks, `me` |
| `/api/bills` | 8 | List/create bills, fetch open order, edit pending, deliver, cancel, invoice PDF |
| `/api/agencies` | 6 | Agency CRUD, per-agency transaction ledger, owner-only status toggle |
| `/api/products` | 6 | Product CRUD, owner-only delete + catalog seed |
| `/api/inventory` | 6 | Stock levels, summary, shortfalls, movement history, manual movements, owner-only reconcile |
| `/api/users` | 3 | Own profile read/update, password change |
| `/api/payments` | 3 | List & record payments (atomic) |
| `/api/reports` | 2 | `$facet` analytics aggregation + report PDF |
| `/api/settings` | 2 | Business & bank settings (owner-only edit) |
| `/api/dashboard` | 1 | Aggregated business metrics |

---

## 👥 User Roles

Enforced by `requireRole()` at the route level. New accounts default to **`manager`**.

| Capability | Manager | Owner |
|---|:---:|:---:|
| View dashboard, agencies, bills, payments, products, inventory | ✅ | ✅ |
| Create / edit agencies | ✅ | ✅ |
| Create, edit, deliver, cancel bills | ✅ | ✅ |
| Record payments | ✅ | ✅ |
| Create / edit products | ✅ | ✅ |
| Record manual stock movements | ✅ | ✅ |
| View reports & analytics | ✅ | ✅ |
| Activate / deactivate agencies | ❌ | ✅ |
| Delete products / seed catalog | ❌ | ✅ |
| Reconcile inventory | ❌ | ✅ |
| View / edit business & bank settings | ❌ | ✅ |

> Role changes are made directly in the database — there is no admin UI yet. `/api/users` is self-service only (`GET/PATCH /me`, `POST /me/password`).

---

## 🌐 Deployment

Full walkthrough in **[DEPLOYMENT.md](./DEPLOYMENT.md)**, including the free-tier tradeoffs that were accepted deliberately and the failures that are easy to misdiagnose:

- **Render blocks outbound SMTP**, so email moved from Gmail to Brevo's HTTP API on port 443.
- **Node resolved Gmail's IPv6 address first** on a container with no IPv6 route (`ENETUNREACH`); fixed process-wide with `dns.setDefaultResultOrder("ipv4first")`.
- **Splitting the origins broke auth** — a cross-site cookie is dropped unless it is `SameSite=None; Secure`.
- **Headless Chrome vs. 512MB** — the PDF engine keeps a browser *singleton* and shuts it down after idle, trading a ~1–2s relaunch for bounded memory, because an OOM kill takes down the whole service and not just the PDF request.

---

## 👤 Author

**Utsav Tala** — B.Tech, Mathematics & Computing, Dhirubhai Ambani University

- GitHub: [@Utsav-tala](https://github.com/Utsav-tala)
- LinkedIn: [utsav-tala](https://www.linkedin.com/in/utsav-tala-aa073b2b4/)
- Email: [202303018@dau.ac.in](mailto:202303018@dau.ac.in)

---

## 📄 License

No `LICENSE` file has been added yet — `backend/package.json` currently declares `ISC`. Pick one and commit the matching license file before treating this repo as open source.
