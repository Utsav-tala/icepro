# ICEPRO_MEMORY.md
# Single Source of Truth — ICEPRO ERP Project

> **HOW TO USE THIS FILE**: This is the persistent project memory file for ICEPRO ERP. Any human or AI agent reading this file should be able to fully understand the project's history, current state, architecture, and next steps WITHOUT needing to read any other file. Keep this file updated whenever significant changes are made.

---

## 1. PROJECT OVERVIEW

### What Is ICEPRO ERP?
ICEPRO ERP is a **full-stack Ice Cream Distribution & Billing Management System** built for **Vrundavan Ice Cream / Vrundavan Milk Products**, a real-world ice cream manufacturing and distribution business located in Kalavad, Gujarat, India.

It is a web-based ERP (Enterprise Resource Planning) portal designed for the business **owner and staff** to manage:
- Agency (distributor/retailer) accounts
- Product catalog and pricing
- GST and Non-GST billing & invoice generation
- Payment collection and balance tracking
- Transaction history and audit trails
- Business settings (firm name, bank details, GST number, etc.)

### Primary Motivation
This project is a **placement/resume-focused full-stack portfolio project**. The key goal is to demonstrate **backend engineering skills** (REST API design, JWT authentication, MVC + service-layer architecture, input validation, RBAC, MongoDB transactions) in a real-world, feature-rich application context.

### Target User
- **Utsav Tala** (developer) — for portfolio/placement
- **Vrundavan Ice Cream staff** — potential real-world deployment

---

## 2. TECH STACK

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 (Create React App) |
| Styling | Vanilla CSS (no Tailwind) |
| HTTP Client | Axios (`src/api.js` — centralized instance) |
| Auth | JWT stored in `localStorage` |
| State | React `useState` + `useEffect` (no Redux) |
| Build Tool | react-scripts 5.0.1 |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB (Atlas cloud cluster: `IceproCluster`) |
| ODM | Mongoose 8 |
| Auth | JSON Web Tokens (JWT) + bcryptjs |
| Validation | express-validator |
| PDF Engine | Puppeteer (headless Chrome) — server-side HTML→PDF |
| Dev Server | nodemon |
| Environment | dotenv |

### Database
- **Provider**: MongoDB Atlas (Free tier)
- **Cluster**: `IceproCluster` (`.zdmhyfg.mongodb.net`)
- **DB Name**: `icepro`
- **Connection**: Via `MONGO_URI` env var using `mongoose.connect()`

### Hosting / Ports (Local Development)
- **Backend**: `http://localhost:8000` (configured via `backend/.env` `PORT=8000`)
- **Frontend**: `http://localhost:3000` (CRA default)
- **Proxy**: `"proxy": "http://localhost:8000"` in root `package.json` — all `/api/*` calls from React are proxied to the backend automatically in development.

### What Was INTENTIONALLY NOT Used
TypeScript, NestJS, PostgreSQL, GraphQL, Microservices, TailwindCSS, Redux, Firebase (migrated away from).

---

## 3. REPOSITORY STRUCTURE

> **Restructured 2026-07-10** from a root-level frontend (`src/`, `package.json` at repo root,
> sitting next to `backend/`) into a standard two-folder `frontend/` + `backend/` layout.
> Pure directory move — no component logic, imports, or business logic changed.
> See the Structural pass entry at the bottom of this file for details.

```
icepro-new_version/                (repo root)
├── package.json               ← Convenience scripts only (install:all, dev, build) — no real deps
├── vercel.json                ← Tells Vercel to build from frontend/ (installCommand/buildCommand/outputDirectory)
├── .prettierrc                ← Prettier formatting config (whole repo — frontend + backend)
├── .gitignore                 ← Single root gitignore — covers frontend/, backend/, and both .env files
├── ICEPRO_MEMORY.md           ← THIS FILE
├── TDD.md                     ← Original Technical Design Document
├── project_overview.md        ← High-level project overview
│
├── frontend/                  ← React app (Create React App)
│   ├── package.json           ← Frontend deps + scripts (npm start, npm run build); "proxy": "http://localhost:8000"
│   ├── package-lock.json
│   ├── .eslintrc.js           ← ESLint config (frontend / React) — extends react-app, must live beside react-scripts
│   ├── .env                   ← Environment variables — NOT committed to git
│   ├── .env.example           ← Template (REACT_APP_GOOGLE_CLIENT_ID)
│   ├── public/
│   │   ├── index.html
│   │   └── logo.png
│   └── src/
│       ├── App.js             ← Root: auth guard, screen routing
│       ├── api.js             ← Centralized Axios instance (JWT injection + silent refresh)
│       ├── constants.js       ← UI constants (colors, CSS, item catalog)
│       ├── helpers.js         ← Financial helpers, print/WhatsApp logic
│       ├── index.js
│       └── components/
│           ├── Auth.js           ← Sign in & Sign up screens
│           ├── Dashboard.js      ← Main app shell: sidebar, all pages, modals
│           ├── AgencyModal.js    ← Add/Edit agency modal
│           ├── BillModal.js      ← Create bill modal (GST/Non-GST)
│           ├── PaymentModal.js   ← Record payment modal
│           ├── ProductsPage.js   ← Products CRUD page
│           ├── InventoryPage.js  ← 🧊 Stock levels, production-shortfall alert, movement ledger
│           ├── Settings.js       ← Business & bank settings page (owner only)
│           ├── Vehicles.js       ← ⚠️ UI placeholder — dummy data, no API yet
│           ├── ReportsPage.js    ← 📊 Analytics dashboard (KPIs + breakdown tables + print)
│           └── UI.js             ← Shared UI components (Logo, Tag, SC, etc.)
│
└── backend/                   ← Node.js + Express backend (unmoved — already its own top-level folder)
    ├── src/
    │   └── app.js             ← Express server entry point (bootstrap)
    ├── package.json           ← Backend dependencies (npm run dev in backend/)
    ├── .eslintrc.js           ← ESLint config (Node.js / backend)
    ├── .env                   ← Environment variables — NOT committed to git
    ├── .env.example           ← Template with all required variable names
    ├── config/
    │   ├── database.js        ← Mongoose connection logic
    │   └── cloudinary.js      ← ⚠️ Scaffolded (Phase 5) — no-op currently
    ├── constants/
    │   └── index.js           ← Shared enums (ROLES, BILL_TYPES, ORDER_STATUS, etc.)
    ├── models/                ← Mongoose schemas
    │   ├── User.js
    │   ├── Agency.js
    │   ├── Bill.js            ← + status / revision / items[].productId
    │   ├── Payment.js
    │   ├── Transaction.js     ← Financial ledger (bills + payments)
    │   ├── StockMovement.js   ← 📦 Inventory ledger (immutable, two signed delta columns)
    │   ├── Product.js         ← + onHand / committed / lowStockThreshold, virtual `available`
    │   ├── Order.js           ← ⚠️ Schema only — no controller/service yet
    │   ├── Counter.js         ← Auto-incrementing invoice number
    │   └── Settings.js
    ├── scripts/
    │   └── backfillProductIds.js  ← ⚠️ ONE-TIME migration — see Section 11. Dry-run by default.
    ├── routes/                ← Express Router files
    │   ├── auth.routes.js
    │   ├── agency.routes.js
    │   ├── bill.routes.js
    │   ├── payment.routes.js
    │   ├── product.routes.js
    │   ├── inventory.routes.js ← 📦 Stock, shortfalls, movement ledger, reconcile
    │   ├── order.routes.js    ← ⚠️ Stub — health-check only, no controller yet
    │   ├── dashboard.routes.js
    │   ├── settings.routes.js
    │   └── reports.routes.js   ← 📊 Analytics aggregation endpoint (owner/manager)
    ├── controllers/           ← HTTP layer (req → service → res)
    │   ├── auth.controller.js
    │   ├── agency.controller.js
    │   ├── bill.controller.js
    │   ├── payment.controller.js
    │   ├── product.controller.js
    │   ├── inventory.controller.js
    │   ├── dashboard.controller.js
    │   ├── settings.controller.js
    │   └── reports.controller.js
    ├── services/              ← Business logic layer
    │   ├── auth.service.js
    │   ├── agency.service.js
    │   ├── inventory.service.js ← 📦 applyBillStock diff engine + manual movements + reconcile
    │   ├── bill.service.js    ← Atomic bill creation (Mongoose session/transaction) + stock hook
    │   ├── payment.service.js ← Atomic payment creation (Mongoose session)
    │   ├── product.service.js
    │   ├── settings.service.js
    │   ├── dashboard.service.js
    │   ├── reports.service.js   ← $match + $facet aggregation (KPIs + breakdowns)
    │   └── pdf.service.js       ← Puppeteer browser singleton; generateInvoicePdf/generateReportPdf
    ├── templates/                ← HTML→PDF templates (self-contained, inlined assets)
    │   ├── assets.js             ← loads logo + fonts.css as base64 (cached at startup)
    │   ├── invoice.template.js   ← buildInvoiceHTML(bill, agency, settings)
    │   └── report.template.js    ← buildReportHTML(report, settings, labels)
    ├── assets/                   ← logo.png (75KB), fonts.css (Playfair+Nunito base64), fonts/build_fonts.js
    ├── middleware/
    │   ├── auth.middleware.js       ← JWT verification (protect)
    │   ├── role.middleware.js       ← RBAC (requireRole)
    │   ├── rateLimiter.middleware.js ← Global + strict rate limiters
    │   └── error.middleware.js      ← Global error handler (must be last)
    ├── validators/            ← express-validator rule sets
    │   ├── auth.validator.js
    │   ├── agency.validator.js
    │   ├── bill.validator.js
    │   ├── payment.validator.js
    │   ├── product.validator.js
    │   ├── inventory.validator.js
    │   ├── settings.validator.js
    │   └── reports.validator.js
    ├── utils/
    │   ├── ApiResponse.js     ← Standard success response class
    │   ├── ApiError.js        ← Custom error class
    │   └── logger.js          ← Console logger
    └── uploads/               ← Multer upload directory (future use); .gitkeep tracked, contents ignored
```

**Note on `.gitignore`**: there is intentionally only ONE `.gitignore` now, at repo root. `backend/.gitignore`
used to duplicate rules (and its blanket `uploads/` pattern would have silently defeated `uploads/.gitkeep` —
ignoring the whole directory ignores everything inside it, `.gitkeep` included). The root file now uses
`backend/uploads/*` + `!backend/uploads/.gitkeep` instead, so the empty folder still survives a fresh clone.

---

## 4. ARCHITECTURE & DATA FLOW

### Authentication Flow
**Registration (Deferred Password Setup):**
```
User submits details (NO password)
  → POST /api/auth/register
  → Creates account (password: null, isEmailVerified: false)
  → Nodemailer sends verification email with token link
User clicks email link → Frontend VerifyEmailScreen
  → User enters new password
  → POST /api/auth/verify-and-set-password/:token
  → Saves password hash, sets isEmailVerified: true
  → Returns JWT, Auto-logs user into Dashboard
```

**Login:**
```
User submits email+password
  → POST /api/auth/login
  → auth.controller → auth.service.loginUser()
  → Mongoose: findOne({ email }).select("+password")
  → Blocks if !user.isEmailVerified or user.isLocked
  → bcrypt.compare(password, hash)
  → jwt.sign({ _id: userId }, JWT_SECRET, { expiresIn: "7d" })
  → Response: { token, user }
  → Frontend: localStorage.setItem("token", token)
  → api.js interceptor: every request → Authorization: Bearer <token>
  → protect middleware: jwt.verify(token) → req.user = user
```

### Email Architecture
- Centralized via `backend/utils/email.js` using **Nodemailer**.
- Priority: Gmail OAuth2 → Gmail App Password → Free Ethereal Sandbox.
- If no credentials exist in `.env`, Ethereal is used and the test email link is logged to the terminal.

### Standard API Request/Response Pattern
All API responses follow a uniform `ApiResponse` shape:
```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "message": "Human-readable message"
}
```

The frontend `api.js` response interceptor **unwraps** `response.data` automatically, so components receive `{ success, data, message }` directly.

**Critical — Data Extraction**: The `data` field is an object containing the resource array:
- `GET /api/agencies` → `res.data.agencies` (not `res.data` directly)
- `GET /api/bills` → `res.data.bills`
- `GET /api/payments` → `res.data.payments`
- `GET /api/products` → `res.data.products`
- `GET /api/agencies/:id/transactions` → `res.data.transactions`

### Data Flow: Frontend → Backend
```
React Component (state change)
  → api.get/post/put/patch/delete('/resource')   [src/api.js Axios instance]
  → HTTP to http://localhost:8000/api/resource   [CRA proxy in dev]
  → protect middleware (JWT verify)
  → requireRole middleware (RBAC check, if applicable)
  → validator middleware (input validation)
  → controller (parse req, call service, send res)
  → service (business logic, DB calls via Mongoose)
  → MongoDB Atlas
```

### Billing — Atomic Transaction Logic
Bill creation uses **Mongoose sessions** for ACID guarantees:
1. `Counter.findOneAndUpdate()` → atomically increment and get next invoice number
2. `Bill.create([billDoc], { session })` → save bill
3. `Transaction.create([txnDoc], { session })` → save ledger entry
4. `session.commitTransaction()` → both succeed or both roll back

Same pattern applies to `payment.service.js`.

### Inventory — the `applyBillStock` diff engine  📦 *(added 2026-07-12)*

**`inventory.service.js:applyBillStock(prevBill, nextBill, user, session)` is the ONLY code that knows how a
bill affects stock.** It is a pure diff: it does not care *which* operation you are performing, only what the
bill looked like before and after. Every bill operation is therefore the same call:

```
Create   → applyBillStock(null,        bill)
Edit     → applyBillStock(oldBill,     newBill)
Deliver  → applyBillStock(pendingBill, deliveredBill)
Cancel   → applyBillStock(bill,        cancelledBill)
```

It works because `BILL_STOCK_EFFECTS` (in `constants/index.js`) declares what **one box holds** in each status:

| status | `onHand` | `committed` |
|---|---|---|
| `pending` | `0` | `+1` |
| `delivered` | `−1` | `0` |
| `cancelled` (and a non-existent bill) | `0` | `0` |

The entire engine is then two lines of arithmetic:

```js
onHandDelta    = effect(next).onHand    * qtyNext − effect(prev).onHand    * qtyPrev
committedDelta = effect(next).committed * qtyNext − effect(prev).committed * qtyPrev
```

Every transition — including ones nobody hand-coded, like *deliver with a changed quantity* or *cancel an
already-delivered bill* — falls out of that correctly. **This is why the future pending/delivered/editable-bill
feature is a UI job and not an inventory job: the engine already handles all four transitions today.**

Called **inside** `bill.service.js`'s existing `session.withTransaction()`, so the Bill, its `Transaction` row,
the `Product` counter `$inc`s and the `StockMovement` ledger rows all commit together or none of them do.

Two details worth remembering:
- **Line items are summed per product.** A bill may legitimately carry the same product on two lines
  (different rate or discount), so `buildQtyMap` accumulates rather than overwrites.
- **A missing product throws** rather than silently skipping the movement. Products are soft-deleted, so a
  genuinely missing one means the catalog was hard-deleted out from under a bill (e.g. `POST /products/reseed`,
  which does `deleteMany({})`).

### Invoice Number Format
- **GST Bills**: `VMP/25-26/0001` (prefix `VMP`, financial year, 4-digit serial)
- **Non-GST Bills**: `GB/25-26/0001` (prefix `GB`)
- Counter stored in `Counter` collection, keyed by `{ type, fiscalYear }`.
- ⚠️ The number is burned **only for a `delivered` bill**. A `pending` order has no invoice number, so
  cancelling one leaves no gap in the GST series.

---

## 5. DATA MODELS (MongoDB Collections)

### `users`
Fields: `firstName`, `lastName`, `username`, `email`, `password` (hashed, `select:false`), `mobile`, `role` (`owner|manager`, default `manager`), `status` (`active|inactive`), `authProvider` (`local|google`), `googleId`, `isEmailVerified`, `emailVerificationToken`, `emailVerificationExpires`, `failedLoginAttempts`, `lockUntil`

### `agencies`
Fields: `name`, `ownerName`, `mobile`, `city`, `address`, `totalShops`, `gstNo`, `status` (`active|inactive`), `notes`

### `bills`
Fields: `billNo`, `billType` (`gst|nongst`), `status`, `deliveredAt`, `revision`, `agencyId`, `agencyName`, `items[]` (**`productId`**, `name, qty, rate, disc, amount`), `subtotal`, `discountAmt`, `total`, `prevBalance`, `advanceUsed`, `grandTotal`, `notes`, `createdByName`, `createdById`, `createdAt`

> **Bill lifecycle (added 2026-07-12).** `status` ∈ `pending | delivered | cancelled`, **default `delivered`**.
> New bills default to `delivered`, so **today's billing behaviour is unchanged** — a bill is an invoice the
> moment it is written. The `pending` path is fully implemented and tested in the stock engine, but nothing
> sends `status: "pending"` until its UI is built.
>
> - **`pending`** — an **ORDER**. Reserves stock (`committed`) but books **NO money**: no invoice number,
>   no `Transaction` row, **not counted in the agency balance**. Freely editable.
> - **`delivered`** — a real **INVOICE**. Invoice number burned, `Transaction` written, physical stock out.
> - **`cancelled`** — releases whatever the bill was still holding.
>
> **Why pending books no money — this is the load-bearing decision.** Agency balance is derived by summing
> `Bill.total`, and each bill stores a `prevBalance` snapshot that gets printed on the invoice. If an editable
> bill counted as money, changing its items would corrupt the `prevBalance` printed on every bill created
> *after* it, and its `Transaction` row would become a lie. Excluding pending bills from the balance means
> editing one has **zero** financial consequence — there is nothing to corrupt. It also means cancelling an
> order no longer burns a GST invoice number (auditors object to gaps in the series), because the number is
> only assigned at delivery.
>
> **`balanceBearingBills()`** in `constants/index.js` is the single definition of "which bills are real money"
> (`{ $nin: ["pending", "cancelled"] }`). **Everything that sums `Bill.total` must use it** — `bill.service`
> (agency balance), `dashboard.service`, `reports.service` — or a pending order silently inflates revenue.
> It is written as `$nin` rather than `= "delivered"` on purpose: pre-migration bills have **no `status` field**,
> and Mongo treats a missing field as null, which `$nin` matches. An equality match would zero out every
> agency's balance on unmigrated data.
>
> **`revision`** is an optimistic-locking counter. Once bills are editable, two users editing the same pending
> bill would clobber each other — and worse, the second edit would compute its stock delta from a **stale
> baseline**, corrupting the ledger permanently. An edit must send the revision it read; a mismatch → 409.
>
> **`billNo`** is now optional with a **partial unique index** (`partialFilterExpression: { billNo: { $type: "string" } }`).
> A plain `unique: true` would reject the *second* pending bill, since every pending bill has `billNo` unset and
> Mongo treats two missing values as duplicates. ⚠️ Mongoose does **not** drop the old plain-unique index —
> `scripts/backfillProductIds.js` swaps it.
>
> **`items[].productId`** is the hard catalog link inventory needs. Optional, because legacy bills predate it;
> a line with no `productId` simply moves no stock.

> **Money model (authoritative — keep all surfaces consistent):**
> - `item.amount` = `qty × rate × (1 − disc/100)` → **NET** (per-item discount baked in)
> - `subtotal` = `Σ (qty × rate)` → **GROSS** (list value, pre-discount)
> - `discountAmt` = `subtotal − Σ item.amount` → total per-item discount (**derived** in `bill.service.js`; the client-sent value is ignored to avoid double-counting, since the discount is already in `amount`)
> - `total` = `subtotal − discountAmt` = `Σ item.amount` → **NET** billed amount
> - `grandTotal` = `max(0, total + prevBalance)` — `prevBalance` is **signed** (>0 owes, <0 advance credit), so advance naturally reduces the bill. **Never** also subtract `advanceUsed` (that double-counts the advance). `advanceUsed` = `max(0, −prevBalance)` is a display-only field ("Advance Deducted" line).
> - **Display rule:** the invoice PDF, WhatsApp share, and any total re-derive gross/net/disc% **from the line items** (gross vs net), NOT from the stored `disc` field — legacy/dummy bills have `disc=0` while the discount is baked into `amount`. See `backend/templates/invoice.template.js` and `helpers.js:shareWhatsApp`.

### `payments`
Fields: `agencyId`, `agencyName`, `amount`, `cashAmt`, `bankAmt`, `notes`, `recordedBy`, `createdAt`

### `transactions`
Ledger entries — one created for every bill and payment. Fields: `agencyId`, `type` (`bill|payment`), `amount`, `billId`/`paymentId`, `billNo`, `billType`, `prevBalance`, `advanceUsed`, `cashAmt`, `bankAmt`, `notes`, `recordedBy`/`createdByName`, `createdAt`

### `products`
Fields: `name`, `rate` (non-GST), `rateGst`, `discount`, `unitsPerBox`, `isActive`
**Inventory counters** (added 2026-07-12): `onHand`, `committed`, `lowStockThreshold`, plus a
virtual `available` = `onHand − committed` (derived, never stored; exposed via `toJSON: { virtuals: true }`).

### `stockmovements`  📦 *(added 2026-07-12)*
**Immutable inventory ledger — the source of truth for all stock.** Same philosophy as `transactions`:
append-only, never updated or deleted. `Product.onHand`/`committed` are a denormalized CACHE of this
ledger, written in the same Mongoose session. If they ever disagree, the ledger wins.

Fields: `productId`, `productName`, `type` (`opening|production|sale|return|damage|adjustment`),
`onHandDelta`, `committedDelta`, `onHandAfter`, `committedAfter`, `refType` (`bill|manual`), `refId`,
`billNo`, `notes`, `createdByName`, `createdById`, `createdAt`

> **Why TWO delta columns — this is the core idea of the module.**
> A single stock number cannot answer both questions the business asks:
> - *"How many boxes are physically in the freezer?"* → `onHand`
> - *"How many can I still promise a customer?"* → `available` = `onHand − committed`
>
> | Event | `onHandDelta` | `committedDelta` |
> |---|---|---|
> | Production +10 | `+10` | `0` |
> | Order taken (10 boxes, pending) | `0` | `+10` |
> | Order edited 10 → 15 | `0` | `+5` |
> | Order cancelled | `0` | `−10` |
> | **Delivered** | `−10` | `−10` |
> | Damage / melt | `−5` | `0` |
> | Return from agency | `+5` | `0` |
>
> Note the delivery row: `available` is **unchanged**. That is correct — physically shipping boxes you
> had *already promised* does not change what you can promise the next customer. A one-number model
> cannot express this.
>
> Summing `onHandDelta` rebuilds `onHand`; summing `committedDelta` rebuilds `committed`. The whole
> ledger is replayable from zero, which is what makes `POST /api/inventory/reconcile` possible.

> **Negative stock is a FEATURE, not an error.** Orders are accepted even with no stock; the resulting
> negative `available` **is** the production signal, surfaced by `GET /api/inventory/shortfalls` and
> pinned to the top of the Inventory page. Nothing in the billing path blocks on stock.

### `counters`
Fields: `type` (`gst|nongst`), `fiscalYear` (`25-26`), `seq` (auto-increments). Compound unique index on `{type, fiscalYear}`.

### `settings`
Singleton document (one per deployment). Fields: `business` (`{ name, address, mobile, email, gstNo, panNo, fssaiNo, logo }`), `bank` (`{ accountName, accountNo, ifscCode, bankName, branch }`), `updatedBy`, `updatedAt`

---

## 6. API ROUTES REFERENCE

### Auth — `/api/auth`
| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Create account (no password, sends email) |
| `POST` | `/login` | Public | Login, returns JWT |
| `POST` | `/google` | Public | Google Sign-In (login only) |
| `POST` | `/google-profile` | Public | Decodes Google token for signup autofill |
| `POST` | `/check-secret` | Public | Validates signup secret code |
| `GET` | `/check-email` | Public | Checks email availability |
| `GET` | `/check-username` | Public | Checks username availability |
| `POST` | `/verify-and-set-password/:token` | Public | Verifies email and sets initial password |
| `POST` | `/resend-verification` | Protected | Resends verification email |
| `POST` | `/logout` | Protected | Logout (client clears token, backend clears cookies) |
| `GET` | `/me` | Protected | Get current user profile |

### Agencies — `/api/agencies`
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Get all agencies |
| `POST` | `/` | owner, manager | Create agency |
| `GET` | `/:id` | Protected | Get single agency |
| `PUT` | `/:id` | owner, manager | Update agency |
| `PATCH` | `/:id/status` | owner only | Toggle active/inactive |
| `GET` | `/:id/transactions` | Protected | Get transaction history |

### Bills — `/api/bills`
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Get all bills |
| `POST` | `/` | owner, manager | Create bill (atomic) |
| `GET` | `/:id` | Protected | Get single bill |
| `GET` | `/:id/pdf` | Protected | Render invoice as PDF (Puppeteer). Served `Content-Disposition: inline` → opens in browser PDF viewer (print or save). |

### Payments — `/api/payments`
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Get all payments |
| `POST` | `/` | owner, manager | Record payment (atomic) |
| `GET` | `/:id` | Protected | Get single payment |

### Products — `/api/products`
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Get all products |
| `POST` | `/` | owner, manager | Create product |
| `PUT` | `/:id` | owner, manager | Update product |
| `DELETE` | `/:id` | owner only | Soft-delete (isActive=false) |
| `POST` | `/seed` | owner only | Seed from catalog (one-time) |
| `POST` | `/reseed` | owner only | Destructive reseed |

### Inventory — `/api/inventory`  📦 *(added 2026-07-12)*
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Stock for every product: `onHand`, `committed`, `available`, plus `isShortfall` / `isLowStock` flags. |
| `GET` | `/shortfalls` | Protected | **The production alert.** Products where `available < 0`, with the shortfall quantity and the pending bills waiting on each (oldest order first). |
| `GET` | `/movements` | Protected | The stock ledger, paginated. Filters: `productId`, `type`, `startDate`, `endDate`, `page`, `limit`. |
| `POST` | `/movements` | owner, manager | Record a **manual** movement: `production`, `return`, `damage`, `adjustment`, `opening`. Body: `{ productId, type, qty, notes? }`. |
| `GET` | `/summary` | Protected | KPIs: `totalOnHand`, `totalCommitted`, `totalAvailable`, `shortfallCount`, `shortfallBoxes`, `lowStockCount`, `producedThisMonth`, `wastedThisMonth`, `soldThisMonth`. |
| `POST` | `/reconcile` | **owner** | Replay the ledger, rebuild `onHand`/`committed`, report any drift repaired. `?dryRun=true` to report without repairing. |

> **The sign of a manual movement is derived from its TYPE, never from the client.** `production`/`return`/
> `opening` force positive, `damage` forces negative; only `adjustment` accepts a signed quantity (it is a
> correction, so it must go either way). This kills a whole class of bug where *"damage: +50 boxes"* would
> silently **add** stock. `sale` is **service-only** — it is derived from bill state and is rejected by both the
> validator and the service if posted by hand.

### Settings — `/api/settings`
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Get business settings |
| `PUT` | `/` | owner only | Update settings |

### Dashboard — `/api/dashboard`
| Method | Path | Description |
|---|---|---|
| `GET` | `/stats` | Summary stats (agencies, bills, payments) |

### Reports — `/api/reports`
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/` | owner, manager | Analytics — KPIs (revenue, boxes sold, discounts, invoices) + a dynamic breakdown that reshapes by filter. Query params: `startDate`, `endDate` (YYYY-MM-DD, default = current month), `agencyId`, `productName`. One `$match` + `$facet` aggregation; `meta.scenario` ∈ `products` \| `agencies-for-product` \| `products+agencies`. |
| `GET` | `/pdf` | owner, manager | Same filters as `/` — renders the report (logo + KPI cards + breakdown tables) as an `inline` PDF via Puppeteer. |

> **Reports response shape:** `{ kpis:{totalRevenue,totalBoxesSold,totalDiscounts,totalInvoices}, primaryTable:[…], secondaryTable:[…]|null, meta:{scenario,startDate,endDate,filters} }`. `totalDiscounts` = gross list value − net revenue (captures per-item `disc%` **and** bill-level `discountAmt`). Row `percentOfTotal` is computed vs. each table's own revenue sum (in Node, divide-by-zero guarded).

---

## 7. RBAC (Role-Based Access Control)

Three roles are enforced via the `requireRole()` middleware:

| Feature | `staff` | `manager` | `owner` |
|---|---|---|---|
| View dashboard, agencies, bills, payments | ✅ | ✅ | ✅ |
| Create/Edit agencies | ❌ | ✅ | ✅ |
| Create bills | ❌ | ✅ | ✅ |
| Record payments | ❌ | ✅ | ✅ |
| Create/Edit products | ❌ | ✅ | ✅ |
| View inventory / shortfalls / ledger | ✅ | ✅ | ✅ |
| Record stock movements (production, damage, return, adjustment) | ❌ | ✅ | ✅ |
| Deactivate agencies | ❌ | ❌ | ✅ |
| Delete products | ❌ | ❌ | ✅ |
| Reconcile inventory (rebuild counters from ledger) | ❌ | ❌ | ✅ |
| View/Edit settings | ❌ | ❌ | ✅ |

**Role assignment**: New accounts always default to `staff`. Role changes must be done directly in MongoDB (no admin panel yet).

---

## 8. MIGRATION HISTORY — Firebase → MERN

This project was originally built on **Firebase Authentication + Cloud Firestore**. It was migrated to a **custom Node.js + Express + MongoDB backend** across 6 phases.

### What Was Replaced
| Old (Firebase) | New (MERN) |
|---|---|
| `firebase/auth` (GoogleAuth, EmailAuth) | JWT + bcryptjs via `/api/auth` |
| Cloud Firestore collections | MongoDB Atlas collections |
| `onSnapshot()` real-time listeners | `useEffect` + `api.get()` polling/refresh |
| `addDoc()`, `updateDoc()`, `deleteDoc()` | `api.post/put/patch/delete()` |
| `Timestamp.toDate()` | `new Date(ISOString)` |
| Firestore atomic `runTransaction()` | Mongoose `startSession()` + `commitTransaction()` |
| `genInvNo()` client-side helper | `Counter` model server-side atomic increment |
| Firebase SDK in `package.json` | Removed entirely |

### Key Architectural Shift
- **Before**: Firebase client SDK handled all DB operations from the browser.
- **After**: Browser only communicates with the Express REST API via Axios. All DB access is server-side only.

---

## 9. HOW TO RUN LOCALLY

### Prerequisites
- Node.js v18+
- MongoDB Atlas cluster (already configured in `backend/.env`)

### Terminal 1 — Start Backend
```bash
cd /path/to/icepro-new_version/backend
npm run dev
# Starts nodemon on http://localhost:8000
# You should see: "ICEPRO Backend running on http://localhost:8000" + "MongoDB Connected"
```

### Terminal 2 — Start Frontend
```bash
cd /path/to/icepro-new_version/frontend
npm start
# Starts React on http://localhost:3000
# All /api/* requests are proxied to http://localhost:8000 automatically
```

> Or from the repo root: `npm run dev:backend` / `npm run dev:frontend` (or `npm run dev` for both),
> using the convenience root `package.json` — see Section 3.

### Environment Variables (`backend/.env`)
```
PORT=8000
SIGNUP_SECRET=vrundavan2024
MONGO_URI=mongodb+srv://icepro_admin:***@iceprocluster.zdmhyfg.mongodb.net/icepro
JWT_SECRET=<your_secret>
JWT_EXPIRY=7d
NODE_ENV=development
RESEND_API_KEY=<your_resend_api_key>
EMAIL_FROM=ICEPRO ERP <noreply@example.com>
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<your_google_client_id>
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME_MINUTES=15
```

> ⚠️ Do NOT commit `.env` to git. Both `frontend/.env` and `backend/.env` are covered by the single root `.gitignore`.

---

## 10. CURRENT STATUS — COMPLETED PHASES

| Phase | Description | Status |
|---|---|---|
| 1 | Backend Foundation (Express, MongoDB, folder structure) | ✅ Complete |
| 2 | JWT Authentication (register, login, protect middleware) | ✅ Complete |
| 2.1 | Auth Hardening (Google Auth, 3-step signup, Verification, Rate Limit) | ✅ Complete |
| 3 | Core Data Models (User, Agency, Bill, Payment, Transaction, Product, Counter, Settings) | ✅ Complete |
| 4 | REST API Routes + Controllers + Services | ✅ Complete |
| 5 | Validation + RBAC Middleware | ✅ Complete |
| 6 | Frontend Integration (React migrated from Firebase to Axios + JWT) | ✅ Complete |
| 7 | Documentation (this file) | ✅ Complete |
| 8 | Reports / Analytics Module (`$facet` aggregation endpoint + `📊 Reports` React page) | ✅ Complete |
| 9 | Repo restructure: root-level frontend → standard `frontend/` + `backend/` two-folder layout | ✅ Complete |
| 10 | Server-side PDF pipeline (Puppeteer): print-ready invoice + report PDFs, single "Print" button opens PDF in browser viewer (print or save) | ✅ Complete |
| 11 | **Inventory Module** — `StockMovement` ledger, `onHand`/`committed`/`available` model, `applyBillStock` diff engine, production-shortfall alert, `🧊 Inventory` React page. Also lays the full groundwork for the pending/delivered editable-bill feature. | ✅ Complete |

---

## 11. KNOWN ISSUES & NOTES

- **⚠️ RUN THE INVENTORY MIGRATION ONCE**: `cd backend && node scripts/backfillProductIds.js` (dry run — writes
  nothing) then `--commit`. It (1) swaps Bill's plain-unique `billNo_1` index for the **partial** unique index —
  Mongoose will NOT do this for you, and until it runs, a second `pending` bill would be rejected as a duplicate;
  (2) stamps `status: "delivered"` on existing bills; (3) backfills `items[].productId` by matching the line's
  free-text `name` against the catalog. It writes **no** `StockMovement` rows and touches **no** stock counters —
  historical bills do not retroactively drain inventory. Real stock starts from today, entered as `opening`
  movements on the Inventory page. Line items matching no product are left `productId: null` and reported.
- **Inventory starts at zero.** Every product begins with `onHand: 0`. Enter real counts via the Inventory page
  → *Record Movement* → **Opening Stock**, or stock will read as a shortfall the moment anything is billed.
- **Orders Feature is Stubbed**: The `Order` model and routes exist but the UI only shows a placeholder. The backend `order.routes.js` exists but `order.controller.js` / `order.service.js` need full implementation. (`Order.items[]` already carries `productId`, so it can drive inventory when built.)
- **No Admin Panel for Role Management**: Changing a user's role must be done directly in MongoDB Compass or via a one-off Node script. A future `/api/users` admin route should be added.
- **No Token Refresh**: The refresh token helpers are scaffolded in `utils/tokens.js` but the `/api/auth/refresh` endpoint does not yet exist. JWT access tokens expire in 15 min (or `ACCESS_TOKEN_EXPIRY`). The `api.js` client already implements the silent refresh queue — only the server endpoint is missing.
- **Vehicles Page is Placeholder**: `Vehicles.js` renders a UI stub with dummy vehicle data. A `Vehicle` model + routes need to be built.
- **No Image Upload Yet**: Cloudinary env vars are scaffolded but Multer/Cloudinary integration is not implemented (`config/cloudinary.js` is a no-op).
- **Firebase migration complete** *(2026-07-10)*: `firebase-admin`, `migrateFirebase.js`, `peek.js/2/3`, and the Firebase service account JSON have been removed. The migration is permanently done.

---

## 12. NEXT STEPS / ROADMAP

### Immediate (To Complete the MERN Portfolio)
- [ ] **Pending / Delivered Bills (editable orders)** — ⭐ *the inventory backend for this is ALREADY DONE.*
  `Bill.status`, `Bill.revision`, and the `applyBillStock(prev, next)` diff engine all exist and are tested;
  pending bills are already excluded from the agency balance and burn no invoice number. What remains is
  essentially UI + three thin endpoints:
  - `PATCH /api/bills/:id` — edit a `pending` bill. Load the old bill, build the new one, call
    `applyBillStock(oldBill, newBill, user, session)` inside a session. **Must check `revision`** and reject a
    mismatch with 409 (optimistic locking), or a concurrent edit computes its stock delta from a stale baseline
    and corrupts the ledger.
  - `POST /api/bills/:id/deliver` — assign `billNo` via `Counter.getNextInvoiceNumber()`, compute `prevBalance`,
    write the `Transaction` row, then `applyBillStock(pendingBill, deliveredBill, …)`.
  - `POST /api/bills/:id/cancel` — `applyBillStock(bill, cancelledBill, …)`.
  - Frontend: a status toggle in `BillModal`, an "Orders / Pending" list, and an edit view.
- [ ] **User Management Page** (owner only): List all users, change roles, deactivate accounts → `GET/PATCH /api/users`
- [ ] **Orders Implementation**: Full backend CRUD + frontend UI for the Orders module
- [ ] **Vehicles Module**: Model, routes, and UI for managing delivery vehicles

### Resume/Portfolio Enhancements
- [ ] **API Documentation with Swagger/OpenAPI**: Auto-generate docs from route comments
- [ ] **Unit Tests with Jest + Supertest**: At minimum, test auth and bill creation services
- [ ] **Deployment**: Deploy backend on Railway/Render, frontend on Vercel, point to same MongoDB Atlas cluster

### Future Production Features
- [x] **PDF Invoice + Report Generation (server-side)** *(done 2026-07-11)*: Puppeteer HTML→PDF pipeline. `pdf.service.js` owns a reused, self-healing browser singleton (launched lazily, closed on SIGTERM/SIGINT). Templates in `backend/templates/` (`invoice.template.js`, `report.template.js`) with inlined base64 logo (`assets/logo.png`, resized 609KB→75KB) + fonts (`assets/fonts.css` — Playfair Display + Nunito, latin subset, embedded so it renders offline). Routes served `inline`; frontend `PrintBillButton` / ReportsPage Print button fetch the PDF with the JWT auth header and open it in a new tab (native viewer = print **or** save). Retired the old client-side `printInvoice`/`printReport`.
- [ ] **WhatsApp Integration**: Use Twilio or WhatsApp Cloud API to send invoices (currently `helpers.js:shareWhatsApp` opens a pre-filled wa.me link)
- [x] **Reports & Analytics Module** *(done 2026-07-10)*: `GET /api/reports` (`$facet` aggregation) + `📊 Reports` React page — KPI cards, product/agency breakdown tables with `% of total` and `avg ₹/box`, date-preset + agency + product filters, and a print-to-PDF view. (Visual charts via Chart.js/Recharts remain an optional future enhancement.)
- [ ] **Offline Support**: PWA + IndexedDB for basic offline bill creation

---

## 13. HOW TO UPDATE THIS FILE

Update `ICEPRO_MEMORY.md` whenever:
- A new feature or module is implemented
- A bug of architectural significance is found and fixed
- A new route, model, or middleware is added
- A phase is completed
- The tech stack changes

**Update checklist**:
1. Update the relevant section(s) above
2. Add new routes to Section 6 (API Routes Reference)
3. Add new models to Section 5 (Data Models)
4. Update Section 10 (Phase status table)
5. Move completed items from Section 12 (Roadmap) and cross them off

---

*PDF pipeline: 2026-07-11 — added server-side Puppeteer PDF generation for invoices (`GET /api/bills/:id/pdf`) and reports (`GET /api/reports/pdf`), both `inline`; single "Print" button opens the PDF in the browser viewer. Fixed two money bugs surfaced during this work: (1) `bill.service.js` double-counted the discount (`total = Σnet − discountAmt`) — now `subtotal`=gross, `discountAmt`=derived, `total`=net; (2) `grandTotal` double-subtracted advance credit — now `max(0, total + signed prevBalance)`. Invoice/WhatsApp now derive per-item disc% from gross-vs-net so the DISC% column is correct even on `disc=0` legacy data. Retired client-side `printInvoice`/`printReport`.*

*Inventory module: 2026-07-12 — added the `StockMovement` ledger (immutable, append-only, with TWO signed delta
columns: `onHandDelta` + `committedDelta`), `Product.onHand`/`committed` as a session-consistent cache with a derived
`available` virtual, and `inventory.service.js:applyBillStock(prev, next)` — a single pure diff engine that handles
bill create / edit / deliver / cancel as the same call. Stock is deliberately allowed to go negative: a negative
`available` IS the production signal, surfaced by `GET /api/inventory/shortfalls` and pinned to the top of the new
`🧊 Inventory` page along with the pending orders waiting on each product. New API namespace `/api/inventory`
(stock, shortfalls, movements, summary, owner-only reconcile). The sign of a manual movement is derived from its
TYPE, never the client, so "damage: +50" can never add stock; `sale` is service-only.*

*Also laid the complete groundwork for the FUTURE pending/delivered editable-bill feature: `Bill.status`
(default `delivered` → today's behaviour is unchanged), `Bill.revision` for optimistic locking, `items[].productId`,
and a partial unique index on `billNo` so pending bills can coexist without one. The key decision: a pending bill is
an ORDER, not an invoice — it reserves stock but books NO money (no invoice number, no `Transaction` row, excluded
from the agency balance via `balanceBearingBills()`), which is exactly what makes editing it safe and what stops a
cancelled order from leaving a gap in the GST series. `dashboard.service` and `reports.service` were both updated to
exclude pending/cancelled bills, or a pending order would have silently inflated revenue. Verified end-to-end against
a throwaway database: 20/20 checks incl. the invariant that delivering a pending order leaves `available` unchanged.*

*Last Updated: 2026-07-12 | Project: ICEPRO ERP v2.0 | Author: Utsav Tala*
*Cleanup pass: 2026-07-10 — removed Firebase remnants, dead scripts, unused packages; added Prettier/ESLint; updated repo structure docs.*
*Reports module: 2026-07-10 — added `GET /api/reports` (`$facet` aggregation) + `📊 Reports` analytics page; replaced Bill's standalone `{agencyId}` index with compound `{agencyId, createdAt}`. Also fixed two pre-existing build blockers in the working tree: a trailing comma in root `package.json` and a missing `React` import in `src/index.js`.*
*Structural pass: 2026-07-10 — moved the root-level React app into `frontend/` (git history preserved via `git mv`); `backend/` was already its own top-level folder and did not move. Consolidated `backend/.gitignore` into one root `.gitignore` (also fixed a latent bug where its blanket `uploads/` rule would have defeated `uploads/.gitkeep`). Added a root convenience `package.json` (scripts only, no new deps) and a root `vercel.json` pointing the build at `frontend/`. Zero component logic, imports, API routes, env var names, or business logic changed.*
