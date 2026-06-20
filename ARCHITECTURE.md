# Asset Management App — System Architecture

## Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite (SPA) |
| UI | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| State | Zustand (client state) + TanStack Query (server state) |
| Routing | React Router v6 |
| Forms | React Hook Form |
| Backend | Node.js + Fastify |
| ORM / DB Access | mysql2 (raw queries + query builder) |
| Database | MySQL 8 |
| Cache / Sessions | Redis 7 |
| Auth | JWT (access + refresh token, stored in httpOnly cookie) |
| File Storage | Local disk (dev) → S3-compatible (prod) |
| Background Jobs | node-cron (price sync, alert checks) |
| Language | JavaScript (ES2022, CommonJS modules) |

---

## 1. Project Folder Structure

```
asset-management/
│
├── client/                          # React + Vite SPA
│   ├── public/
│   ├── src/
│   │   ├── assets/                  # Static assets (icons, images)
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui generated components
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.jsx     # Sidebar + header wrapper
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── PageWrapper.jsx
│   │   │   ├── charts/
│   │   │   │   ├── AllocationPie.jsx
│   │   │   │   ├── NetWorthLine.jsx
│   │   │   │   └── ReturnsBar.jsx
│   │   │   ├── forms/               # Asset-specific add/edit forms
│   │   │   │   ├── FDForm.jsx
│   │   │   │   ├── MutualFundForm.jsx
│   │   │   │   ├── StockForm.jsx
│   │   │   │   ├── GoldForm.jsx
│   │   │   │   ├── LoanForm.jsx
│   │   │   │   └── ... (one per asset type)
│   │   │   └── shared/
│   │   │       ├── AssetCard.jsx
│   │   │       ├── ReturnsBadge.jsx
│   │   │       ├── CurrencyDisplay.jsx
│   │   │       ├── DatePicker.jsx
│   │   │       └── ConfirmDialog.jsx
│   │   ├── pages/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── Register.jsx
│   │   │   │   └── ForgotPassword.jsx
│   │   │   ├── Dashboard/
│   │   │   │   └── index.jsx        # Net worth, allocation, events
│   │   │   ├── Assets/
│   │   │   │   ├── index.jsx        # All assets overview
│   │   │   │   ├── BankAccounts/
│   │   │   │   │   ├── index.jsx    # FD + RD + Savings list
│   │   │   │   │   ├── FDDetail.jsx
│   │   │   │   │   └── RDDetail.jsx
│   │   │   │   ├── MutualFunds/
│   │   │   │   ├── Stocks/
│   │   │   │   ├── Gold/
│   │   │   │   ├── Bonds/
│   │   │   │   ├── GovtSchemes/     # PPF, NPS, EPF, SSY, NSC, etc.
│   │   │   │   ├── Insurance/
│   │   │   │   ├── RealEstate/
│   │   │   │   ├── Loans/
│   │   │   │   └── Alternatives/
│   │   │   ├── Goals/
│   │   │   │   ├── index.jsx
│   │   │   │   └── GoalDetail.jsx
│   │   │   ├── Tax/
│   │   │   │   ├── index.jsx        # Tax summary dashboard
│   │   │   │   ├── CapitalGains.jsx
│   │   │   │   └── Deductions.jsx
│   │   │   ├── Reports/
│   │   │   │   └── index.jsx
│   │   │   ├── Family/
│   │   │   │   └── index.jsx
│   │   │   ├── Alerts/
│   │   │   │   └── index.jsx
│   │   │   └── Settings/
│   │   │       └── index.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useNetWorth.js
│   │   │   ├── useAssets.js
│   │   │   └── useMarketPrice.js
│   │   ├── store/
│   │   │   ├── authStore.js         # Zustand: user session
│   │   │   ├── uiStore.js           # Zustand: sidebar, modals, theme
│   │   │   └── filterStore.js       # Zustand: active family member, FY
│   │   ├── services/
│   │   │   ├── api.js               # Axios instance with interceptors
│   │   │   ├── auth.service.js
│   │   │   ├── assets.service.js
│   │   │   ├── dashboard.service.js
│   │   │   ├── goals.service.js
│   │   │   ├── tax.service.js
│   │   │   └── reports.service.js
│   │   ├── utils/
│   │   │   ├── finance.js           # XIRR, CAGR, EMI, compounding helpers
│   │   │   ├── currency.js          # Format INR, USD
│   │   │   ├── date.js              # FY helpers, date formatting
│   │   │   └── constants.js         # Asset types, risk categories, etc.
│   │   ├── lib/
│   │   │   └── utils.js             # shadcn cn() helper
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── router.jsx               # React Router route definitions
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                          # Node.js + Fastify backend
│   ├── src/
│   │   ├── app.js                   # Fastify instance, plugin registration
│   │   ├── plugins/
│   │   │   ├── db.js                # mysql2 pool plugin
│   │   │   ├── redis.js             # ioredis plugin
│   │   │   ├── auth.js              # JWT plugin (@fastify/jwt)
│   │   │   ├── cors.js
│   │   │   ├── multipart.js         # File uploads (@fastify/multipart)
│   │   │   └── rateLimit.js
│   │   ├── routes/
│   │   │   ├── index.js             # Register all route modules
│   │   │   ├── auth.routes.js
│   │   │   ├── user.routes.js
│   │   │   ├── dashboard.routes.js
│   │   │   ├── goals.routes.js
│   │   │   ├── tax.routes.js
│   │   │   ├── reports.routes.js
│   │   │   ├── alerts.routes.js
│   │   │   ├── documents.routes.js
│   │   │   ├── market.routes.js
│   │   │   └── assets/
│   │   │       ├── bankAccounts.routes.js
│   │   │       ├── mutualFunds.routes.js
│   │   │       ├── stocks.routes.js
│   │   │       ├── gold.routes.js
│   │   │       ├── bonds.routes.js
│   │   │       ├── govtSchemes.routes.js
│   │   │       ├── insurance.routes.js
│   │   │       ├── realEstate.routes.js
│   │   │       ├── loans.routes.js
│   │   │       └── alternatives.routes.js
│   │   ├── controllers/             # Request handlers (thin, call services)
│   │   │   ├── auth.controller.js
│   │   │   ├── dashboard.controller.js
│   │   │   └── assets/
│   │   │       └── ... (mirrors routes/)
│   │   ├── services/                # Business logic (fat layer)
│   │   │   ├── auth.service.js
│   │   │   ├── netWorth.service.js
│   │   │   ├── assets/
│   │   │   │   └── ... (one per asset type)
│   │   │   ├── finance/
│   │   │   │   ├── xirr.js          # XIRR Newton-Raphson implementation
│   │   │   │   ├── cagr.js
│   │   │   │   ├── emi.js           # EMI + amortization schedule
│   │   │   │   └── capitalGains.js  # LTCG/STCG with indexation
│   │   │   ├── tax/
│   │   │   │   ├── deductions.js    # 80C basket, 80D, 24b calculations
│   │   │   │   └── capitalGainsTax.js
│   │   │   ├── market/
│   │   │   │   ├── mfNav.js         # Fetch NAV from MFAPI / AMFI
│   │   │   │   ├── stockPrice.js    # NSE/BSE price fetch
│   │   │   │   └── goldPrice.js     # Gold price feed
│   │   │   └── notifications/
│   │   │       └── alertEngine.js
│   │   ├── models/                  # DB query functions (no ORM)
│   │   │   ├── db.js                # Pool wrapper, query helper
│   │   │   ├── user.model.js
│   │   │   ├── asset.model.js       # Base asset CRUD
│   │   │   └── assets/
│   │   │       └── ... (one per asset type)
│   │   ├── middleware/
│   │   │   ├── authenticate.js      # JWT verify hook
│   │   │   ├── errorHandler.js      # Fastify error handler
│   │   │   └── validate.js          # Request schema validation
│   │   ├── jobs/
│   │   │   ├── priceSync.job.js     # Daily NAV + price refresh
│   │   │   ├── alertCheck.job.js    # Check maturity/due dates
│   │   │   └── scheduler.js         # node-cron setup
│   │   └── config/
│   │       ├── index.js             # App config from env
│   │       ├── db.config.js
│   │       └── redis.config.js
│   └── server.js                    # Entry point
│
├── db/
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_assets_base.sql
│   │   ├── 003_create_bank_accounts.sql
│   │   ├── 004_create_mutual_funds.sql
│   │   ├── 005_create_stocks.sql
│   │   ├── 006_create_gold.sql
│   │   ├── 007_create_bonds.sql
│   │   ├── 008_create_govt_schemes.sql
│   │   ├── 009_create_insurance.sql
│   │   ├── 010_create_real_estate.sql
│   │   ├── 011_create_loans.sql
│   │   ├── 012_create_alternatives.sql
│   │   ├── 013_create_goals.sql
│   │   ├── 014_create_documents.sql
│   │   ├── 015_create_alerts.sql
│   │   ├── 016_create_market_prices.sql
│   │   └── 017_create_tax_records.sql
│   └── seeds/
│       └── 001_sample_user.sql
│
├── SPEC.md
├── ARCHITECTURE.md
├── DB_SCHEMA.md
├── .env.example
├── .gitignore
└── package.json                     # npm workspaces root
```

---

## 2. API Route Design

All routes prefixed with `/api/v1`. Auth required on all except `/auth/*`.

### Authentication
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password/:token
GET    /auth/me
```

### User & Family
```
GET    /users/profile
PUT    /users/profile
GET    /users/family
POST   /users/family
PUT    /users/family/:memberId
DELETE /users/family/:memberId
```

### Dashboard
```
GET    /dashboard/summary               # net worth, allocation, quick stats
GET    /dashboard/net-worth-history     # ?period=1y|3y|5y|all
GET    /dashboard/upcoming-events       # maturity, due dates, SIP dates
GET    /dashboard/top-holdings          # top 10 by value
GET    /dashboard/allocation            # breakdown by category
```

### Assets — All follow same CRUD pattern
```
# Bank Accounts
GET    /assets/bank-accounts            # list FDs + RDs + Savings
POST   /assets/fixed-deposits
GET    /assets/fixed-deposits/:id
PUT    /assets/fixed-deposits/:id
DELETE /assets/fixed-deposits/:id

POST   /assets/recurring-deposits
GET    /assets/recurring-deposits/:id
PUT    /assets/recurring-deposits/:id
DELETE /assets/recurring-deposits/:id

POST   /assets/savings-accounts
GET    /assets/savings-accounts/:id
PUT    /assets/savings-accounts/:id

# Mutual Funds
GET    /assets/mutual-funds
POST   /assets/mutual-funds
GET    /assets/mutual-funds/:id
PUT    /assets/mutual-funds/:id
DELETE /assets/mutual-funds/:id
GET    /assets/mutual-funds/:id/transactions
POST   /assets/mutual-funds/:id/transactions  # add buy/sell/switch

# Stocks
GET    /assets/stocks
POST   /assets/stocks
GET    /assets/stocks/:id
PUT    /assets/stocks/:id
DELETE /assets/stocks/:id
GET    /assets/stocks/:id/transactions
POST   /assets/stocks/:id/transactions

# Gold
GET    /assets/gold
POST   /assets/gold
GET    /assets/gold/:id
PUT    /assets/gold/:id
DELETE /assets/gold/:id

# Bonds
GET    /assets/bonds
POST   /assets/bonds
GET    /assets/bonds/:id
PUT    /assets/bonds/:id
DELETE /assets/bonds/:id
POST   /assets/bonds/:id/coupon-payments

# Government Schemes
GET    /assets/govt-schemes             # all types
POST   /assets/ppf
GET    /assets/ppf/:id
PUT    /assets/ppf/:id
POST   /assets/ppf/:id/transactions

POST   /assets/nps
GET    /assets/nps/:id
PUT    /assets/nps/:id

POST   /assets/epf
GET    /assets/epf/:id
PUT    /assets/epf/:id

POST   /assets/govt-schemes/:schemeType # NSC, SSY, SCSS, KVP, post-office
GET    /assets/govt-schemes/:id
PUT    /assets/govt-schemes/:id

# Insurance
GET    /assets/insurance
POST   /assets/insurance
GET    /assets/insurance/:id
PUT    /assets/insurance/:id
DELETE /assets/insurance/:id
POST   /assets/insurance/:id/premium-payments
GET    /assets/insurance/:id/nominees

# Real Estate
GET    /assets/real-estate
POST   /assets/real-estate
GET    /assets/real-estate/:id
PUT    /assets/real-estate/:id
DELETE /assets/real-estate/:id

# Loans
GET    /assets/loans
POST   /assets/loans
GET    /assets/loans/:id
PUT    /assets/loans/:id
DELETE /assets/loans/:id
GET    /assets/loans/:id/amortization   # full EMI schedule
POST   /assets/loans/:id/prepayment     # record prepayment
GET    /assets/loans/:id/prepayment-simulator?amount=50000

# Alternatives (Crypto, Chit, P2P, Angel)
GET    /assets/alternatives
POST   /assets/alternatives
GET    /assets/alternatives/:id
PUT    /assets/alternatives/:id
DELETE /assets/alternatives/:id
```

### Goals
```
GET    /goals
POST   /goals
GET    /goals/:id
PUT    /goals/:id
DELETE /goals/:id
POST   /goals/:id/assets                # link asset to goal
DELETE /goals/:id/assets/:assetId
GET    /goals/:id/projection            # SIP required, timeline estimate
```

### Tax
```
GET    /tax/summary?fy=2024-25
GET    /tax/capital-gains?fy=2024-25
GET    /tax/deductions?fy=2024-25       # 80C basket, 80D, 24b, etc.
GET    /tax/harvesting-suggestions      # loss harvesting opportunities
GET    /tax/advance-tax-calendar?fy=2024-25
```

### Reports
```
GET    /reports/net-worth?period=annual&format=pdf|json
GET    /reports/capital-gains?fy=2024-25&format=pdf|csv
GET    /reports/income?fy=2024-25       # dividends + interest + rent
GET    /reports/insurance-coverage
GET    /reports/loan-statement/:loanId
```

### Alerts & Notifications
```
GET    /alerts                          # user alert config list
POST   /alerts
PUT    /alerts/:id
DELETE /alerts/:id
GET    /notifications                   # triggered notifications
PUT    /notifications/:id/read
PUT    /notifications/read-all
```

### Documents
```
GET    /documents?assetId=123
POST   /documents                       # multipart upload
GET    /documents/:id/download
DELETE /documents/:id
```

### Market Data
```
GET    /market/mf-nav/:isin
GET    /market/stock-price/:ticker?exchange=NSE
GET    /market/gold-price
GET    /market/crypto-price/:symbol
```

---

## 3. Authentication Flow

```
Client                          Server                        Redis / DB
  │                               │                               │
  │── POST /auth/login ──────────►│                               │
  │                               │── verify password ──────────►│
  │                               │◄── user record ──────────────│
  │                               │── generate accessToken (15m) │
  │                               │── generate refreshToken (7d) │
  │                               │── store refreshToken ───────►│ (Redis TTL 7d)
  │◄── Set-Cookie: refreshToken ──│                               │
  │◄── { accessToken } ───────────│                               │
  │                               │                               │
  │── GET /dashboard/summary ────►│                               │
  │   Authorization: Bearer <AT>  │── verify JWT ─────────────── │
  │◄── dashboard data ────────────│                               │
  │                               │                               │
  │── POST /auth/refresh ────────►│  (cookie: refreshToken)       │
  │                               │── lookup token ─────────────►│
  │                               │◄── valid ─────────────────── │
  │◄── { new accessToken } ───────│                               │
```

- **Access token**: short-lived JWT (15 min), sent in `Authorization` header
- **Refresh token**: long-lived (7 days), stored in httpOnly cookie + Redis
- **Logout**: delete refresh token from Redis, clear cookie
- **TOTP 2FA**: optional, verified before issuing tokens

---

## 4. Database Architecture

See `DB_SCHEMA.md` for full table definitions.

### Design Principles
- **Polymorphic base table**: `assets` table holds common fields (user, type, name, currency). Each asset type has its own child table linked by `asset_id`.
- **Transaction tables**: separate tables for transactional assets (mutual funds, stocks, loans, PPF) to support historical P&L calculation.
- **No soft-delete everywhere**: only assets use `is_active` flag. Supporting tables use hard delete.
- **Denormalized current values**: `current_value` stored in asset table and refreshed by background jobs. Raw transactions remain source of truth.

### Table Relationships (simplified)
```
users (1) ──────────────────────── (many) assets
                                              │
                                    ┌─────────┼──────────┐
                                    │         │          │
                               fixed_deposits  mutual_funds  stocks ...
                                              │
                                    mutual_fund_transactions

assets (many) ──── (many) goals   [via goal_assets join table]
assets (1) ────── (many) documents
assets (1) ────── (many) nominees
loans (1) ─────── (many) loan_transactions
```

---

## 5. Redis Usage

| Key Pattern | Purpose | TTL |
|---|---|---|
| `session:refresh:{token}` | Refresh token validation | 7 days |
| `cache:nav:{isin}` | MF NAV (fetched daily) | 24 hours |
| `cache:stock:{ticker}` | Stock price | 5 minutes |
| `cache:gold:price` | Gold price (INR/gram) | 1 hour |
| `cache:dashboard:{userId}` | Dashboard summary | 5 minutes |
| `cache:networth:{userId}` | Net worth calculation | 10 minutes |
| `ratelimit:{ip}` | API rate limiting | 1 minute |
| `otp:{mobile}` | OTP for mobile login | 10 minutes |

---

## 6. Background Jobs (node-cron)

| Job | Schedule | Purpose |
|---|---|---|
| `priceSync` | Daily 6:00 AM | Fetch MF NAVs, stock prices, gold price; update `market_prices` table |
| `currentValueRefresh` | Daily 6:30 AM | Recalculate `current_value` for all active assets using latest prices |
| `alertCheck` | Daily 8:00 AM | Check maturity dates, due dates; insert into `notifications` |
| `taxHarvestingScan` | Weekly (Mon) | Identify LTCG/STCG harvest opportunities |
| `sessionCleanup` | Daily 2:00 AM | Remove expired refresh tokens from Redis |

---

## 7. Finance Calculation Engine

### XIRR (Extended Internal Rate of Return)
- Newton-Raphson iteration on cash flows
- Used for: MF portfolio, stocks, FDs, bonds
- Inputs: array of `{ date, amount }` (negative = investment, positive = redemption/current value)

### Capital Gains Logic
```
Equity (Stocks + Equity MF):
  holding > 1 year  → LTCG @ 10% (above ₹1L exemption)
  holding ≤ 1 year  → STCG @ 15%
  Pre-2018 cost     → grandfathering at Jan 31, 2018 price

Debt (Debt MF, Bonds, FD):
  Post April 2023 MF rules → slab rate regardless of holding
  Pre April 2023 MF lots   → LTCG @ 20% with indexation (>3 years)

Gold:
  holding > 3 years → LTCG @ 20% with indexation
  holding ≤ 3 years → slab rate

Real Estate:
  holding > 2 years → LTCG @ 20% with indexation
  holding ≤ 2 years → slab rate

SGB:
  maturity after 8 years → tax free
```

### EMI & Amortization
- Standard reducing-balance EMI formula
- Full amortization schedule (principal + interest split per month)
- Prepayment impact: recalculate remaining schedule post-prepayment

---

## 8. Frontend State Architecture

```
Zustand Stores (client-only state)
├── authStore        { user, isLoggedIn, logout() }
├── uiStore          { sidebarOpen, activeModal, theme }
└── filterStore      { activeMemberId, activeFY }

TanStack Query (server state + caching)
├── useQuery('dashboard-summary')
├── useQuery(['assets', type])
├── useQuery(['asset-detail', id])
├── useQuery(['goals'])
├── useQuery(['tax-summary', fy])
└── useMutation (create/update/delete assets)
```

---

## 9. Key Third-Party APIs (Free Tiers)

| Data | Source | API / Method |
|---|---|---|
| MF NAV | MFAPI.in | `GET https://api.mfapi.in/mf/{schemeCode}` |
| Stock Price | NSE India (unofficial) or Yahoo Finance | REST |
| Gold Price | GoldAPI.io or MCX feed | REST |
| Crypto Price | CoinGecko API | REST (free tier) |
| PIN → Bank | RazorpayX IFSC API | `ifsc.razorpay.com` |

---

## 10. Environment Variables

```env
# App
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=assetmgmt
DB_USER=root
DB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10

# External APIs
GOLD_API_KEY=
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# Email (alerts / OTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@assetmgmt.local
```

---

## 11. Development Setup (Local)

```bash
# Prerequisites: Node 20+, MySQL 8, Redis 7

# 1. Clone and install
npm install          # installs both client/ and server/ via workspaces

# 2. Database setup
mysql -u root -p < db/migrations/001_create_users.sql
# ... run all migrations in order

# 3. Environment
cp .env.example server/.env

# 4. Start
npm run dev:server   # Fastify on :4000
npm run dev:client   # Vite on :5173
```

---

## 12. Phased Build Plan

### Phase 1 — Core Foundation
- [ ] Project scaffold (Vite + Fastify + MySQL)
- [ ] Auth (register, login, JWT, refresh)
- [ ] Dashboard shell (layout, sidebar, routing)
- [ ] Net worth summary (manual asset entry)
- [ ] FD / RD / Savings account CRUD
- [ ] Basic dashboard chart

### Phase 2 — Investments
- [ ] Mutual Funds (SIP + Lumpsum) with NAV fetch
- [ ] Stocks with lot tracking and P&L
- [ ] Gold (all types)
- [ ] PPF / EPF / NPS (govt schemes)

### Phase 3 — Liabilities & Protection
- [ ] All loan types with amortization
- [ ] Insurance (all types)
- [ ] Real Estate

### Phase 4 — Intelligence Layer
- [ ] Tax module (80C basket, capital gains report)
- [ ] Goals with projection
- [ ] Alerts & notifications
- [ ] Document storage

### Phase 5 — Polish
- [ ] Reports (PDF export)
- [ ] Family / multi-profile
- [ ] Data import (CAS, broker P&L)
- [ ] Mobile responsive tuning
