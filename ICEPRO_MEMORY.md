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

```
icepro-new_version/
├── package.json              ← React frontend scripts (npm start, npm build)
├── .prettierrc               ← Prettier formatting config (whole repo)
├── .eslintrc.js              ← ESLint config (frontend / React)
├── .gitignore                ← Root gitignore (covers .env and backend/.env)
├── src/                      ← React frontend source
│   ├── App.js                ← Root: auth guard, screen routing
│   ├── api.js                ← Centralized Axios instance (JWT injection + silent refresh)
│   ├── constants.js          ← UI constants (colors, CSS, item catalog)
│   ├── helpers.js            ← Financial helpers, print/WhatsApp logic
│   └── components/
│       ├── Auth.js           ← Sign in & Sign up screens
│       ├── Dashboard.js      ← Main app shell: sidebar, all pages, modals
│       ├── AgencyModal.js    ← Add/Edit agency modal
│       ├── BillModal.js      ← Create bill modal (GST/Non-GST)
│       ├── PaymentModal.js   ← Record payment modal
│       ├── ProductsPage.js   ← Products CRUD page
│       ├── Settings.js       ← Business & bank settings page (owner only)
│       ├── Vehicles.js       ← ⚠️ UI placeholder — dummy data, no API yet
│       ├── ReportsPage.js    ← 📊 Analytics dashboard (KPIs + breakdown tables + print)
│       └── UI.js             ← Shared UI components (Logo, Tag, SC, etc.)
│
├── backend/                  ← Node.js + Express backend
│   ├── src/
│   │   └── app.js            ← Express server entry point (bootstrap)
│   ├── package.json          ← Backend dependencies (npm run dev in backend/)
│   ├── .eslintrc.js          ← ESLint config (Node.js / backend)
│   ├── .env                  ← Environment variables — NOT committed to git
│   ├── .env.example          ← Template with all required variable names
│   ├── config/
│   │   ├── database.js       ← Mongoose connection logic
│   │   └── cloudinary.js     ← ⚠️ Scaffolded (Phase 5) — no-op currently
│   ├── constants/
│   │   └── index.js          ← Shared enums (ROLES, BILL_TYPES, ORDER_STATUS, etc.)
│   ├── models/               ← Mongoose schemas
│   │   ├── User.js
│   │   ├── Agency.js
│   │   ├── Bill.js
│   │   ├── Payment.js
│   │   ├── Transaction.js
│   │   ├── Product.js
│   │   ├── Order.js          ← ⚠️ Schema only — no controller/service yet
│   │   ├── Counter.js        ← Auto-incrementing invoice number
│   │   └── Settings.js
│   ├── routes/               ← Express Router files
│   │   ├── auth.routes.js
│   │   ├── agency.routes.js
│   │   ├── bill.routes.js
│   │   ├── payment.routes.js
│   │   ├── product.routes.js
│   │   ├── order.routes.js   ← ⚠️ Stub — health-check only, no controller yet
│   │   ├── dashboard.routes.js
│   │   ├── settings.routes.js
│   │   └── reports.routes.js  ← 📊 Analytics aggregation endpoint (owner/manager)
│   ├── controllers/          ← HTTP layer (req → service → res)
│   │   ├── auth.controller.js
│   │   ├── agency.controller.js
│   │   ├── bill.controller.js
│   │   ├── payment.controller.js
│   │   ├── product.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── settings.controller.js
│   │   └── reports.controller.js
│   ├── services/             ← Business logic layer
│   │   ├── auth.service.js
│   │   ├── agency.service.js
│   │   ├── bill.service.js   ← Atomic bill creation (Mongoose session/transaction)
│   │   ├── payment.service.js ← Atomic payment creation (Mongoose session)
│   │   ├── product.service.js
│   │   ├── settings.service.js
│   │   ├── dashboard.service.js
│   │   └── reports.service.js   ← $match + $facet aggregation (KPIs + breakdowns)
│   ├── middleware/
│   │   ├── auth.middleware.js       ← JWT verification (protect)
│   │   ├── role.middleware.js       ← RBAC (requireRole)
│   │   ├── rateLimiter.middleware.js ← Global + strict rate limiters
│   │   └── error.middleware.js      ← Global error handler (must be last)
│   ├── validators/           ← express-validator rule sets
│   │   ├── auth.validator.js
│   │   ├── agency.validator.js
│   │   ├── bill.validator.js
│   │   ├── payment.validator.js
│   │   ├── product.validator.js
│   │   ├── settings.validator.js
│   │   └── reports.validator.js
│   ├── utils/
│   │   ├── ApiResponse.js    ← Standard success response class
│   │   ├── ApiError.js       ← Custom error class
│   │   └── logger.js         ← Console logger
│   └── uploads/              ← Multer upload directory (future use)
│
├── ICEPRO_MEMORY.md          ← THIS FILE
├── TDD.md                    ← Original Technical Design Document
└── project_overview.md       ← High-level project overview
```

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

### Invoice Number Format
- **GST Bills**: `VMP/25-26/0001` (prefix `VMP`, financial year, 4-digit serial)
- **Non-GST Bills**: `GB/25-26/0001` (prefix `GB`)
- Counter stored in `Counter` collection, keyed by `{ type, fiscalYear }`.

---

## 5. DATA MODELS (MongoDB Collections)

### `users`
Fields: `firstName`, `lastName`, `username`, `email`, `password` (hashed, `select:false`), `mobile`, `role` (`owner|manager`, default `manager`), `status` (`active|inactive`), `authProvider` (`local|google`), `googleId`, `isEmailVerified`, `emailVerificationToken`, `emailVerificationExpires`, `failedLoginAttempts`, `lockUntil`

### `agencies`
Fields: `name`, `ownerName`, `mobile`, `city`, `address`, `totalShops`, `gstNo`, `status` (`active|inactive`), `notes`

### `bills`
Fields: `billNo`, `billType` (`gst|nongst`), `agencyId`, `agencyName`, `items[]` (`name, qty, rate, disc, amount`), `total`, `prevBalance`, `advanceUsed`, `createdByName`, `createdAt`

### `payments`
Fields: `agencyId`, `agencyName`, `amount`, `cashAmt`, `bankAmt`, `notes`, `recordedBy`, `createdAt`

### `transactions`
Ledger entries — one created for every bill and payment. Fields: `agencyId`, `type` (`bill|payment`), `amount`, `billId`/`paymentId`, `billNo`, `billType`, `prevBalance`, `advanceUsed`, `cashAmt`, `bankAmt`, `notes`, `recordedBy`/`createdByName`, `createdAt`

### `products`
Fields: `name`, `category`, `unit`, `rate`, `discount`, `isActive`, `createdByName`

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
| Deactivate agencies | ❌ | ❌ | ✅ |
| Delete products | ❌ | ❌ | ✅ |
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
cd /path/to/icepro-new_version
npm start
# Starts React on http://localhost:3000
# All /api/* requests are proxied to http://localhost:8000 automatically
```

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

> ⚠️ Do NOT commit `.env` to git. It is listed in `backend/.gitignore`.

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

---

## 11. KNOWN ISSUES & NOTES

- **No Admin Panel for Role Management**: Changing a user's role must be done directly in MongoDB Compass or via a one-off Node script. A future `/api/users` admin route should be added.
- **Orders Feature is Stubbed**: The `Order` model and routes exist but the UI only shows a placeholder. The backend `order.routes.js` exists but `order.controller.js` / `order.service.js` need full implementation.
- **No Token Refresh**: The refresh token helpers are scaffolded in `utils/tokens.js` but the `/api/auth/refresh` endpoint does not yet exist. JWT access tokens expire in 15 min (or `ACCESS_TOKEN_EXPIRY`). The `api.js` client already implements the silent refresh queue — only the server endpoint is missing.
- **Vehicles Page is Placeholder**: `Vehicles.js` renders a UI stub with dummy vehicle data. A `Vehicle` model + routes need to be built.
- **No Image Upload Yet**: Cloudinary env vars are scaffolded but Multer/Cloudinary integration is not implemented (`config/cloudinary.js` is a no-op).
- **Firebase migration complete** *(2026-07-10)*: `firebase-admin`, `migrateFirebase.js`, `peek.js/2/3`, and the Firebase service account JSON have been removed. The migration is permanently done.

---

## 12. NEXT STEPS / ROADMAP

### Immediate (To Complete the MERN Portfolio)
- [ ] **User Management Page** (owner only): List all users, change roles, deactivate accounts → `GET/PATCH /api/users`
- [ ] **Orders Implementation**: Full backend CRUD + frontend UI for the Orders module
- [ ] **Vehicles Module**: Model, routes, and UI for managing delivery vehicles

### Resume/Portfolio Enhancements
- [ ] **API Documentation with Swagger/OpenAPI**: Auto-generate docs from route comments
- [ ] **Unit Tests with Jest + Supertest**: At minimum, test auth and bill creation services
- [ ] **Deployment**: Deploy backend on Railway/Render, frontend on Vercel, point to same MongoDB Atlas cluster

### Future Production Features
- [ ] **PDF Invoice Generation (server-side)**: Use `pdfkit` or `puppeteer` to generate real PDF invoices
- [ ] **WhatsApp Integration**: Use Twilio or WhatsApp Cloud API to send invoices
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

*Last Updated: 2026-07-10 | Project: ICEPRO ERP v2.0 | Author: Utsav Tala*
*Cleanup pass: 2026-07-10 — removed Firebase remnants, dead scripts, unused packages; added Prettier/ESLint; updated repo structure docs.*
*Reports module: 2026-07-10 — added `GET /api/reports` (`$facet` aggregation) + `📊 Reports` analytics page; replaced Bill's standalone `{agencyId}` index with compound `{agencyId, createdAt}`. Also fixed two pre-existing build blockers in the working tree: a trailing comma in root `package.json` and a missing `React` import in `src/index.js`.*
