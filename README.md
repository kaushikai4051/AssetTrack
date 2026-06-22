# AssetTrack — Personal Finance & Asset Management

A full-stack personal finance platform built for Indian investors. Track, analyze, and optimize your entire financial portfolio across 11 asset classes with real-time net worth tracking, return calculations (XIRR, CAGR), tax insights, and goal-based planning.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Roadmap](#roadmap)

---

## Features

### Asset Classes Supported (11 Categories, 26+ Types)

| Category | Types |
|----------|-------|
| **Bank Accounts** | Fixed Deposits (FD), Recurring Deposits (RD), Savings/Current |
| **Mutual Funds** | SIP, Lumpsum — Equity, Debt, Hybrid, ELSS, Index, Liquid, Gold, International |
| **Stocks** | NSE, BSE, NYSE, NASDAQ — with lot tracking and corporate actions |
| **Gold** | Physical, Gold ETF, Sovereign Gold Bonds (SGB), Digital Gold |
| **Government Schemes** | PPF, NPS, EPF, NSC, SSY, SCSS, KVP, Post Office schemes |
| **Bonds** | Corporate bonds, G-Sec, Tax-free bonds |
| **Insurance** | Term, ULIP, Endowment, Health, Vehicle, Critical Illness |
| **Real Estate** | Residential, Commercial, Agricultural — with rent tracking |
| **Loans** | Home, Car, Personal, Education, LAP, Gold, Credit Card |
| **Alternatives** | Crypto, Chit Funds, P2P Lending, Angel/Unlisted Shares |

### Core Capabilities

- **Net worth dashboard** — real-time tracking with historical chart
- **Return calculations** — Absolute Return, XIRR (Newton-Raphson), CAGR
- **Tax module** — LTCG/STCG with indexation, 80C basket, 80D, Section 24b
- **Market data integration** — MF NAV (MFAPI.in), stock prices (NSE/BSE), gold rates
- **Alert system** — maturity dates, EMI due, premium due, SIP milestones
- **Goals tracking** — link assets to goals with projection
- **Family profiles** — multi-member support with asset assignment
- **Document storage** — policy bonds, passbooks, deeds, statements
- **Capital gains reports** — trade-wise with acquisition history and grandfathering

---

## Tech Stack

### Frontend (`client/`)

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3.1 + Vite 5.4.8 |
| Routing | React Router v6.26.2 |
| UI Components | shadcn/ui + Tailwind CSS 3.4.13 |
| Charts | Recharts 2.12.7 |
| Icons | Lucide React 0.447.0 |
| Client State | Zustand 4.5.5 |
| Server State | TanStack React Query 5.59.0 |
| Forms | React Hook Form 7.53.0 |
| HTTP | Axios 1.7.7 (with token refresh interceptor) |
| Date Utilities | date-fns 4.1.0 |
| Testing | Vitest 4.1.9, @testing-library/react 16.3.2, jsdom 29.1.1 |

### Backend (`server/`)

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Fastify 4.28.1 |
| Database | MySQL 8 (raw SQL via mysql2 3.11.3, no ORM) |
| Cache / Sessions | Redis 7 via ioredis 5.4.1 |
| Authentication | JWT (@fastify/jwt 8.0.1) + httpOnly refresh cookies |
| Password Hashing | bcrypt 5.1.1 |
| File Uploads | @fastify/multipart 8.3.0 |
| Rate Limiting | @fastify/rate-limit 9.1.0 |
| Background Jobs | node-cron 3.0.3 (price sync, alert checks) |
| Testing | Jest 30.4.2 + Supertest 7.2.2 |

### Infrastructure

- **Monorepo** — npm workspaces (`client/`, `server/`)
- **Dev runner** — concurrently 8.2.2

---

## Project Structure

```
asset-management/
├── client/                          # React + Vite SPA
│   ├── src/
│   │   ├── __tests__/               # Vitest test suites
│   │   │   ├── mocks/               # API + query client mocks
│   │   │   ├── pages/               # Page component tests
│   │   │   └── utils/               # Utility unit tests
│   │   ├── components/
│   │   │   ├── layout/              # AppShell, Sidebar, Header
│   │   │   ├── shared/              # ProtectedRoute, Modal, AssetCard
│   │   │   └── ui/                  # shadcn/ui primitives
│   │   ├── pages/
│   │   │   ├── Auth/                # Login, Register, ForgotPassword
│   │   │   ├── Dashboard/
│   │   │   ├── BankAccounts/        # FD, RD, Savings — CRUD + forms
│   │   │   ├── MutualFunds/
│   │   │   ├── Stocks/
│   │   │   ├── Gold/
│   │   │   └── GovtSchemes/         # PPF, NPS, EPF, NSC, SSY, SCSS, KVP
│   │   ├── services/
│   │   │   └── api.js               # Axios instance with silent token refresh
│   │   ├── store/
│   │   │   ├── authStore.js         # Zustand: user, token, login/logout
│   │   │   ├── uiStore.js           # Zustand: sidebar, modals, theme
│   │   │   └── filterStore.js       # Zustand: active member, FY filter
│   │   └── utils/
│   │       ├── currency.js          # formatINR, formatCompact, formatReturn
│   │       ├── date.js              # FY helpers, daysUntil, formatDate
│   │       └── finance.js           # Absolute return, EMI, FD maturity
│   └── vite.config.js               # Port 5173, /api proxy → :4000
│
├── server/                          # Node.js + Fastify REST API
│   └── src/
│       ├── routes/assets/           # bankAccounts, mutualFunds, stocks, gold, govtSchemes
│       ├── controllers/assets/      # Request handlers
│       ├── services/                # Business logic
│       ├── finance/                 # Calculation engines
│       │   ├── xirr.js              # XIRR via Newton-Raphson iteration
│       │   ├── fd.js                # FD / RD maturity calculations
│       │   └── capitalGains.js      # LTCG / STCG with CII indexation
│       ├── market/                  # Price feed integrations
│       │   ├── mfNav.js             # MFAPI.in
│       │   ├── stockPrice.js        # NSE / BSE
│       │   └── goldPrice.js
│       ├── jobs/                    # node-cron background tasks
│       │   ├── priceSync.job.js
│       │   └── alertCheck.job.js
│       └── middleware/              # authenticate, errorHandler, validate
│
├── server/__tests__/                # Jest test suites (122 tests)
│   ├── auth.test.js
│   ├── dashboard.test.js
│   ├── market.test.js
│   ├── assets/                      # bankAccounts, gold, govtSchemes, mutualFunds, stocks
│   └── finance/                     # fd, xirr
│
├── db/
│   ├── migrations/                  # SQL files (run in order)
│   └── seeds/                       # Sample data
│
├── ARCHITECTURE.md
├── DB_SCHEMA.md
├── SPEC.md
└── package.json                     # npm workspaces root
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8
- Redis 7

### 1. Clone & Install

```bash
git clone https://github.com/kaushikai4051/AssetTrack.git
cd AssetTrack
npm install          # installs client/ and server/ via workspaces
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database, Redis, and JWT values (see section below)
```

### 3. Set Up the Database

```bash
mysql -u root -p < db/migrations/001_create_users.sql
mysql -u root -p < db/migrations/002_create_assets_base.sql
mysql -u root -p < db/migrations/003_create_refresh_tokens.sql
mysql -u root -p < db/migrations/005_create_bank_accounts.sql
mysql -u root -p < db/migrations/006_create_mutual_funds.sql
mysql -u root -p < db/migrations/007_create_stocks.sql
mysql -u root -p < db/migrations/008_create_gold.sql
mysql -u root -p < db/migrations/009_create_govt_schemes.sql
```

### 4. Start Development Servers

```bash
npm run dev            # Runs both client and server concurrently
```

Or separately:

```bash
npm run dev:client     # Vite dev server  → http://localhost:5173
npm run dev:server     # Fastify API      → http://localhost:4000
```

**Health check:** `GET http://localhost:4000/api/health`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server |
| `npm run dev:client` | Start Vite (frontend only) |
| `npm run dev:server` | Start Fastify with nodemon |
| `npm run build` | Production build of the client |
| `npm run test` | Run all tests (client + server) |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# App
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
CLIENT_URL=http://localhost:5173
LOG_LEVEL=info

# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=assetmgmt
DB_USER=root
DB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT — generate strong secrets for production:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=dev-access-secret-change-in-prod
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-prod
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10

# External APIs (free tiers — no key needed for MF NAV and gold)
MFAPI_URL=https://api.mfapi.in/mf
COINGECKO_API_URL=https://api.coingecko.com/api/v3
GOLD_API_KEY=

# Email (optional — for alerts and password reset)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@assettrack.local
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Authentication uses Bearer tokens (access token in header + httpOnly refresh cookie).

### Auth

```
POST   /auth/register          Register a new user
POST   /auth/login             Login → returns accessToken
POST   /auth/refresh           Silent refresh of accessToken
POST   /auth/logout            Revoke refresh token
GET    /auth/me                Current user profile  [auth required]
```

### Dashboard

```
GET    /dashboard/summary              Net worth, allocation, quick stats
GET    /dashboard/net-worth-history    Historical net worth data
GET    /dashboard/upcoming-events      Maturity dates, due dates, SIP
GET    /dashboard/top-holdings         Top 10 holdings by value
GET    /dashboard/allocation           Asset allocation breakdown
```

### Bank Accounts

```
GET    /assets/bank-accounts           List all FD / RD / Savings
POST   /assets/fixed-deposits          Create FD
GET    /assets/fixed-deposits/:id
PUT    /assets/fixed-deposits/:id
DELETE /assets/fixed-deposits/:id
POST   /assets/recurring-deposits
...
POST   /assets/savings-accounts
...
```

### Mutual Funds

```
GET    /assets/mutual-funds
POST   /assets/mutual-funds
GET    /assets/mutual-funds/:id
PUT    /assets/mutual-funds/:id
DELETE /assets/mutual-funds/:id
GET    /assets/mutual-funds/:id/transactions
POST   /assets/mutual-funds/:id/transactions   Buy / sell / switch / dividend
```

### Stocks

```
GET    /assets/stocks
POST   /assets/stocks
GET    /assets/stocks/:id
PUT    /assets/stocks/:id
DELETE /assets/stocks/:id
GET    /assets/stocks/:id/transactions
POST   /assets/stocks/:id/transactions   Buy / sell / bonus / split / dividend
```

### Gold

```
GET    /assets/gold
POST   /assets/gold
GET    /assets/gold/:id
PUT    /assets/gold/:id
DELETE /assets/gold/:id
```

### Government Schemes

```
GET    /assets/govt-schemes
POST   /assets/govt-schemes            Create PPF / NPS / EPF / NSC / SSY / SCSS / KVP
GET    /assets/govt-schemes/:id
PUT    /assets/govt-schemes/:id
POST   /assets/govt-schemes/:id/transactions
```

### Market Data

```
GET    /market/mf-nav/:isin
GET    /market/stock-price/:ticker?exchange=NSE
GET    /market/gold-price
```

> **Coming soon:** `/assets/bonds`, `/assets/insurance`, `/assets/real-estate`, `/assets/loans`, `/assets/alternatives`, `/goals`, `/tax`, `/reports`, `/alerts`, `/documents`

---

## Database Schema

The database uses a **polymorphic base table** pattern — a central `assets` table holds common fields (user, type, value) with type-specific child tables.

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth credentials, email, mobile, 2FA |
| `user_profiles` | Full name, PAN, DOB, risk profile |
| `family_members` | Multi-profile with relation type |
| `refresh_tokens` | Token hash + expiry (also cached in Redis) |

### Asset Tables

| Table | Purpose |
|-------|---------|
| `assets` | Base table — user_id, asset_type, currency, invested/current values |
| `fixed_deposits` | Principal, rate, start/maturity dates, auto-renew flag |
| `recurring_deposits` | Monthly installment, tenure |
| `savings_accounts` | Balance, interest rate |
| `mutual_funds` | ISIN, folio, SIP details, units, avg NAV |
| `mutual_fund_transactions` | Buy / sell / switch / dividend history |
| `stock_holdings` | Ticker, exchange, units, avg price |
| `stock_transactions` | Lot-based buy / sell / bonus / split / dividend |
| `gold_holdings` | Type (physical/ETF/SGB/digital), weight, purity, making charges |
| `ppf_accounts` | Account number, bank/PO, contributions |
| `nps_accounts` | PRAN, tier (I/II), fund manager |
| `epf_accounts` | UAN, employee/employer shares, EPS balance |
| `govt_scheme_holdings` | NSC, SSY, SCSS, KVP — maturity date, interest rate |
| `loans` | Lender, outstanding principal, EMI, tenure |
| `insurance_policies` | Sum assured, premium, next due date, coverage type |
| `properties` | Address, purchase price, current value, rent, co-ownership |

### Supporting Tables

`goals`, `goal_assets`, `nominees`, `documents`, `alert_configs`, `notifications`, `market_prices`, `tax_records`

See [`DB_SCHEMA.md`](DB_SCHEMA.md) for complete column definitions, indexes, and relationships.

---

## Testing

### Frontend Tests (Vitest)

**~134 tests** covering utilities, page components, and form interactions.

```bash
cd client
npm run test             # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

| Area | Files |
|------|-------|
| Utilities | `currency.test.js`, `date.test.js`, `finance.test.js` |
| Auth | `Login.test.jsx`, `Register.test.jsx` |
| Dashboard | `index.test.jsx` |
| Bank Accounts | `FDForm.test.jsx`, `index.test.jsx` |
| Mutual Funds | `MutualFundForm.test.jsx`, `index.test.jsx` |
| Stocks | `StockForm.test.jsx`, `index.test.jsx` |
| Gold | `GoldForm.test.jsx`, `index.test.jsx` |
| Govt Schemes | `GovtSchemeForm.test.jsx`, `index.test.jsx` |

### Backend Tests (Jest)

**122 tests** covering all API endpoints with an in-memory mock database.

```bash
cd server
npm run test             # Run once
npm run test:coverage    # With coverage report
```

| Area | File |
|------|------|
| Authentication | `auth.test.js` |
| Dashboard | `dashboard.test.js` |
| Market data | `market.test.js` |
| Bank accounts | `assets/bankAccounts.test.js` |
| Mutual funds | `assets/mutualFunds.test.js` |
| Stocks | `assets/stocks.test.js` |
| Gold | `assets/gold.test.js` |
| Govt schemes | `assets/govtSchemes.test.js` |
| FD calculations | `finance/fd.test.js` |
| XIRR calculations | `finance/xirr.test.js` |

---

## Roadmap

### Phase 1 — Core Foundation ✅
- User authentication (register / login / JWT refresh)
- Dashboard with net worth summary
- Bank accounts — FD, RD, Savings CRUD

### Phase 2 — Investments ✅
- Mutual funds with NAV fetch and transaction history
- Stocks with lot tracking and corporate actions
- Gold (physical, ETF, SGB, digital)
- Government schemes (PPF, NPS, EPF, NSC, SSY, SCSS, KVP)

### Phase 3 — Liabilities & Protection 🔜
- Loans with amortization schedule and prepayment simulator
- Insurance policies with premium tracking
- Real estate with rent and maintenance tracking

### Phase 4 — Intelligence Layer 🔜
- Tax module (80C basket, LTCG/STCG, capital gains report)
- Goals with target tracking and asset linking
- Alerts and notifications system
- Document storage

### Phase 5 — Polish 🔜
- PDF report export
- Family / multi-profile support
- Data import (CAS statement, broker P&L)
- Mobile-responsive UI enhancements

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run tests before committing: `npm run test`
4. Open a pull request

---

## License

MIT
