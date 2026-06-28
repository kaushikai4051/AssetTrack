# Task Tracker — Asset Management App

## Status Legend
- `[ ]` Not started
- `[>]` In progress
- `[x]` Done
- `[~]` Blocked
- `[-]` Skipped / deferred

## Progress Summary
> Last updated: 2026-06-28
> Phase 1: 32/34 | Phase 2: 32/32 | Phase 3: 19/19 | Phase 4: 14/20 | Phase 5: 4/20 | Phase 6: 8/8
> Phase 7: 7/7 | Phase 8: 9/9 | Phase 9: 9/9 | Phase 10+11: 6/6 | Phase 12: 6/6
> **Total: 146 / 179 tasks done**

---

## Phase 1 — Core Foundation

### P1.1 · Project Scaffold
- [x] `T-001` Initialize npm workspaces root (`package.json` with `client/` and `server/` workspaces)
- [x] `T-002` Scaffold React + Vite SPA in `client/` with Tailwind CSS
- [x] `T-003` Install and configure shadcn/ui in `client/` (manual — button, card, input, label, badge)
- [x] `T-004` Scaffold Fastify server in `server/` with folder structure from ARCHITECTURE.md
- [x] `T-005` Create `.env.example` with all required environment variables
- [x] `T-006` Create `.gitignore` for Node, React, and env files
- [x] `T-007` Configure Vite proxy to forward `/api/*` to Fastify during development
- [x] `T-008` Write npm scripts: `dev:client`, `dev:server`, `dev` (both in parallel)

### P1.2 · Database Setup
- [x] `T-009` Write migration `001_create_users.sql` — `users`, `user_profiles`, `subscriptions`, `family_members`
- [-] `T-010` Write migration `002_create_family_members.sql` — merged into 001
- [x] `T-011` Write migration `002_create_assets_base.sql` — `assets` base table
- [-] `T-012` Write migration `004_create_refresh_tokens.sql` — using Redis only (no DB table needed for v1)
- [x] `T-013` Create `db.js` mysql2 pool plugin for Fastify with query helper
- [x] `T-014` Create Redis plugin (`ioredis`) for Fastify — fail-safe, no log spam when unavailable

### P1.3 · Authentication
- [x] `T-015` `POST /api/v1/auth/register` — hash password (bcrypt), insert user + profile
- [x] `T-016` `POST /api/v1/auth/login` — verify password, issue access + refresh token
- [x] `T-017` `POST /api/v1/auth/logout` — delete refresh token (Redis or DB), clear cookie
- [x] `T-018` `POST /api/v1/auth/refresh` — rotate refresh token, issue new access token
- [x] `T-019` `GET  /api/v1/auth/me` — return current user from JWT
- [-] `T-020` `POST /api/v1/auth/forgot-password` — deferred to Phase 5 (needs SMTP)
- [-] `T-021` `POST /api/v1/auth/reset-password/:token` — deferred to Phase 5 (needs SMTP)
- [x] `T-022` Fastify `authenticate` hook — verify JWT, returns 401 on invalid/expired token

### P1.4 · Frontend Auth Shell
- [x] `T-023` Login page (`/login`) with React Hook Form
- [x] `T-024` Register page (`/register`)
- [-] `T-025` Forgot password page — deferred to Phase 5 (needs SMTP)
- [x] `T-026` `authStore` (Zustand) — user/isLoggedIn persisted, accessToken in-memory only
- [x] `T-027` Axios instance (`services/api.js`) with JWT interceptor + auto-refresh on 401
- [x] `T-028` Protected route wrapper — redirects to `/login` if not authenticated

### P1.5 · App Shell & Dashboard Skeleton
- [x] `T-029` App layout: Sidebar + Header + main content area (`AppShell.jsx`)
- [x] `T-030` Sidebar with navigation links for all asset categories (collapsible)
- [x] `T-031` React Router v6 route definitions (`router.jsx`) — all routes wired
- [x] `T-032` Dashboard page skeleton — net worth cards, upcoming events, error state
- [x] `T-033` `GET /api/v1/dashboard/summary` — net worth, asset count, returns
- [x] `T-034` `GET /api/v1/dashboard/upcoming-events` — FD maturities within 60 days

---

## Phase 2 — Investment Assets

### P2.1 · Bank Accounts (FD / RD / Savings)
- [x] `T-035` Migration `005_create_bank_accounts.sql` — `fixed_deposits`, `recurring_deposits`, `savings_accounts`
- [x] `T-036` CRUD API for Fixed Deposits (`/assets/fixed-deposits`)
- [x] `T-037` CRUD API for Recurring Deposits (`/assets/recurring-deposits`)
- [x] `T-038` CRUD API for Savings Accounts (`/assets/savings-accounts`)
- [x] `T-039` FD maturity amount auto-calculation on save (compound/simple interest)
- [x] `T-040` Frontend: Bank Accounts list page (FD + RD + Savings tabs)
- [x] `T-041` Frontend: `FDForm.jsx` — add / edit Fixed Deposit
- [x] `T-042` Frontend: `RDForm.jsx` — add / edit Recurring Deposit

### P2.2 · Mutual Funds
- [x] `T-043` Migration `006_create_mutual_funds.sql` — `mutual_funds`, `mutual_fund_transactions`
- [x] `T-044` CRUD API for Mutual Funds + transaction endpoints
- [x] `T-045` `market/mfNav.js` service — fetch NAV from MFAPI.in by scheme code
- [x] `T-046` `GET /api/v1/market/mf-nav/:schemeCode` — proxy NAV fetch, cache in Redis (24h)
- [x] `T-047` XIRR calculation service (`finance/xirr.js`) — Newton-Raphson implementation
- [x] `T-048` Returns calculation per fund: XIRR, absolute return, units × NAV
- [x] `T-049` Frontend: Mutual Funds list with current value, returns badge, XIRR
- [x] `T-050` Frontend: `MutualFundForm.jsx` — SIP and lumpsum entry with NAV auto-fill

### P2.3 · Stocks
- [x] `T-051` Migration `007_create_stocks.sql` — `stock_holdings`, `stock_transactions`
- [x] `T-052` CRUD API for Stocks + transaction endpoints (buy/sell/bonus/split)
- [x] `T-053` Stock price fetch service (`market/stockPrice.js`) — Yahoo Finance v8/chart
- [x] `T-054` `GET /api/v1/market/stock-price/:ticker` — cache in Redis (5 min)
- [x] `T-055` Capital gains calculation per lot — FIFO LTCG/STCG split (Jan 31 2018 grandfathering deferred to Phase 4 tax module)
- [x] `T-056` Frontend: Stocks list with sector filter tabs, P&L + LTCG/STCG per holding
- [x] `T-057` Frontend: `StockForm.jsx` + `StockTransactionForm.jsx` (buy/sell/bonus/split)

### P2.4 · Gold
- [x] `T-058` Migration `008_create_gold.sql` — `gold_holdings` (physical/digital/etf/sgb)
- [x] `T-059` CRUD API for Gold (all 4 types: physical, digital, ETF, SGB)
- [x] `T-060` Gold price fetch service (`market/goldPrice.js`) — Yahoo Finance GC=F + USDINR=X → INR/gram, 1h Redis cache
- [x] `T-061` Frontend: Gold list with type filter tabs, purity badges, SGB maturity/coupon, Refresh Price

### P2.5 · Government Schemes (PPF / NPS / EPF / Others)
- [x] `T-062` Migration `009_create_govt_schemes.sql` — single `govt_scheme_holdings` + `govt_scheme_transactions` tables covering all 10 scheme types
- [x] `T-063` CRUD + transaction API for PPF and EPF (deposit/withdrawal/interest/employer_contribution); recalcScheme helper keeps assets in sync
- [x] `T-064` CRUD API for NPS, EPF (PRAN, UAN, Tier1/Tier2, fund manager, employee/employer split)
- [x] `T-065` CRUD API for NSC / SSY / SCSS / KVP / PO-TD / PO-MIS / PO-RD — maturity auto-calculated (NSC half-yearly, KVP 2×, PO-TD annually)
- [x] `T-066` Frontend: Govt Schemes page with PPF / NPS / EPF / Others tabs, maturity badges, transaction modal for PPF+EPF

---

## Phase 3 — Liabilities & Protection

### P3.1 · Bonds
- [x] `T-067` Migration `010_create_bonds.sql` — `bond_holdings`, `bond_coupon_payments`
- [x] `T-068` CRUD API for Bonds (corporate, G-Sec, tax-free, NCD)
- [x] `T-069` YTM calculation service
- [x] `T-070` Frontend: Bonds list with YTM, coupon schedule

### P3.2 · Insurance
- [x] `T-071` Migration `011_create_insurance.sql` — `insurance_policies`, `insurance_premium_payments`
- [x] `T-072` CRUD API for Insurance (all types) + premium payment log
- [x] `T-073` Nominees sub-resource: `GET/POST /assets/insurance/:id/nominees`
- [x] `T-074` Frontend: Insurance list with coverage summary cards
- [x] `T-075` Frontend: `InsuranceForm.jsx` — conditional fields per insurance type

### P3.3 · Real Estate
- [x] `T-076` Migration `012_create_real_estate.sql` — `properties`
- [x] `T-077` CRUD API for Properties (with rental income tracking)
- [x] `T-078` Frontend: Real Estate list with rental yield calculation

### P3.4 · Loans
- [x] `T-079` Migration `013_create_loans.sql` — `loans`, `loan_transactions`
- [x] `T-080` CRUD API for all loan types
- [x] `T-081` EMI amortization schedule generator (`finance/emi.js`)
- [x] `T-082` `GET /api/v1/assets/loans/:id/amortization` — full schedule
- [x] `T-083` `GET /api/v1/assets/loans/:id/prepayment-simulator?amount=X` — savings calc
- [x] `T-084` Frontend: Loans list with outstanding, EMI calendar
- [x] `T-085` Frontend: `LoanForm.jsx` + prepayment simulator modal

---

## Phase 4 — Intelligence Layer

### P4.1 · Tax Module
- [x] `T-086` Capital gains tax service (`tax/capitalGainsTax.js`) — all asset types, indexation
- [x] `T-087` Deductions aggregator (`tax/deductions.js`) — 80C basket running total
- [x] `T-088` `GET /api/v1/tax/summary?fy=` — combined tax dashboard data
- [x] `T-089` `GET /api/v1/tax/capital-gains?fy=` — per-asset LTCG/STCG breakdown
- [x] `T-090` `GET /api/v1/tax/deductions?fy=` — 80C, 80D, 24b, 80CCD(1B) status
- [x] `T-091` `GET /api/v1/tax/harvesting-suggestions` — unrealized losses > unrealized gains
- [x] `T-092` Frontend: Tax page — deductions tracker, capital gains table, harvest alerts

### P4.2 · Goals
- [x] `T-093` Migration `014_create_goals.sql` — `goals`, `goal_assets`
- [x] `T-094` CRUD API for Goals + link/unlink assets
- [x] `T-095` Goal projection service — SIP required, timeline, achievement probability
- [x] `T-096` Frontend: Goals page with progress cards and projection chart

### P4.3 · Alerts & Notifications (superseded by Phase 8)
- [-] `T-097` Migration `015_create_alerts.sql` — not needed; alerts computed on-the-fly in Phase 8
- [x] `T-098` Alert engine service — implemented as `alerts.controller.js` in Phase 8
- [-] `T-099` Daily cron job for alert push — deferred; Phase 8 uses pull model
- [x] `T-100` `GET /api/v1/alerts/all` — unread list for header bell icon
- [x] `T-101` Frontend: Alerts page — categorized alert list (maturity, renewal, EMI, tax)

### P4.4 · Documents
- [ ] `T-102` Migration `016_create_documents.sql` — `documents` table (asset_type, asset_id, file_path, file_name, mime_type, expires_at)
- [ ] `T-103` `POST /api/v1/documents` — multipart upload, store file, save metadata
- [ ] `T-104` `GET /api/v1/documents/:id/download` — serve file with auth check
- [ ] `T-105` Frontend: Document attachment UI on each asset detail page

---

## Phase 5 — Polish & Power Features

### P5.1 · Reports (superseded by Phase 9)
- [x] `T-106` Net worth snapshot report — implemented as `GET /api/v1/reports/net-worth`
- [ ] `T-107` Capital gains report (PDF / CSV) — ITR-ready format (still pending)
- [x] `T-108` Income report: dividends + interest aggregated — `GET /api/v1/reports/interest-income`
- [x] `T-109` Insurance coverage summary report — `GET /api/v1/reports/insurance`
- [x] `T-110` Frontend: Reports page with net worth, income, insurance, loan sections + CSV/print

### P5.2 · Family / Multi-Profile
- [ ] `T-111` Family member CRUD API + frontend management page
- [ ] `T-112` `filterStore` (Zustand) — active family member selector in header
- [ ] `T-113` All asset APIs filter by `family_member_id` when set

### P5.3 · Background Price Sync
- [ ] `T-114` Daily price sync job (`jobs/priceSync.job.js`) — MF NAV, stocks, gold
- [ ] `T-115` `jobs/scheduler.js` — register all cron jobs on server start
- [ ] `T-116` Net worth recalculation job after price sync completes

### P5.4 · Data Import
- [ ] `T-117` CAS PDF parser — extract mutual fund transactions (CAMS / KFintech)
- [ ] `T-118` Broker P&L CSV importer — Zerodha, Groww, Upstox format mappings
- [ ] `T-119` EPF passbook CSV importer
- [ ] `T-120` Frontend: Import wizard with file upload + mapping preview

### P5.5 · Alternative Investments
- [ ] `T-121` Migration `017_create_alternatives.sql` — `crypto_holdings`, `crypto_transactions`, `alternative_investments`
- [ ] `T-122` CRUD + transaction API for Crypto
- [ ] `T-123` CRUD API for Chit Fund, P2P, Angel investments
- [ ] `T-124` Crypto price fetch service (CoinGecko)
- [ ] `T-125` Frontend: Alternatives page

---

## Phase 6 — CSV Data Import

> Allows users to migrate existing data from spreadsheets or other finance apps via downloadable CSV templates.
> Covers FD, PPF, and Mutual Funds in v1.

### P6.1 · Backend — Parser & Template Endpoints
- [x] `T-134` Install `csv-parse`; create `server/src/utils/csvParser.js` — streaming parser with header normalization, type coercion (dates → ISO, numbers → float), and row-level error collection
- [x] `T-135` Create `server/src/routes/imports.js` plugin; register as `/api/v1/imports`; add `GET /api/v1/imports/templates/:type` to serve downloadable CSV templates (`fd`, `ppf`, `mutual-fund`) with correct headers pre-filled

### P6.2 · Backend — Asset-Specific Import Handlers
- [x] `T-136` `POST /api/v1/imports/fd` — parse FD CSV, validate required fields, bulk insert into `assets` + `fixed_deposits`, return `{ imported, failed: [{ row, reason }] }`
- [x] `T-137` `POST /api/v1/imports/ppf` — parse PPF CSV, insert into `govt_scheme_holdings` + `govt_scheme_transactions`, recalculate current balance
- [x] `T-138` `POST /api/v1/imports/mutual-fund` — parse MF CSV, upsert `mutual_funds`, insert `mutual_fund_transactions`, trigger recalculation

### P6.3 · Frontend — Import Wizard
- [x] `T-139` `ImportWizard.jsx` — reusable 3-step wizard: Step 1 download template + upload; Step 2 confirm; Step 3 result summary with expandable failures
- [x] `T-140` Wire "Import CSV" into FD list, PPF tab, and Mutual Funds list pages
- [x] `T-141` Template reference accordion on Step 1 — column names, required/optional badges, accepted values

---

## Phase 7 — Portfolio Analytics

### P7.1 · Backend
- [x] `T-142` `analytics.controller.js` — aggregate all asset types: total invested, current value, absolute return, XIRR, allocation by category
- [x] `T-143` `GET /api/v1/analytics/overview` — single endpoint returning full analytics payload
- [x] `T-144` `analytics.routes.js` registered under `/api/v1/analytics`

### P7.2 · Frontend
- [x] `T-145` Analytics page — asset allocation donut/pie chart by category
- [x] `T-146` Analytics — returns table: category-wise invested, current value, return %, XIRR
- [x] `T-147` Analytics — liquidity breakdown (liquid / semi-liquid / illiquid)
- [x] `T-148` Analytics — top gainers / losers section

---

## Phase 8 — Alerts & Notifications

### P8.1 · Backend
- [x] `T-149` `alerts.controller.js` — compute alerts across all asset types without a DB table
- [x] `T-150` FD / RD / bond / govt scheme maturity alerts (configurable look-ahead window)
- [x] `T-151` Insurance premium renewal alerts (upcoming due dates)
- [x] `T-152` Loan EMI due date alerts
- [x] `T-153` PPF / SSY annual contribution deadline alerts (before March 31)
- [x] `T-154` SGB early exit window alerts (5th year anniversary)
- [x] `T-155` Tax-saving limit approaching alerts (80C, 80D)
- [x] `T-156` `GET /api/v1/alerts/all` — returns categorized alerts list
- [x] `T-157` `alerts.routes.js` registered under `/api/v1/alerts`

### P8.2 · Frontend
- [x] `T-158` Alerts page — categorized tabs (maturity, renewal, EMI, tax, goals)

> Note: T-158 renumbered from original Phase 9 slot — Alerts page counts as one task.

---

## Phase 9 — Reports

### P9.1 · Backend
- [x] `T-159` `reports.controller.js` — `netWorthSnapshot`: assets vs liabilities by category
- [x] `T-160` `reports.controller.js` — `interestIncome`: FD interest + MF dividends + bond coupons aggregated by FY
- [x] `T-161` `reports.controller.js` — `insuranceSummary`: all policies with premium, sum insured, renewal
- [x] `T-162` `reports.controller.js` — `loanStatement`: outstanding, EMI paid, interest paid per loan
- [x] `T-163` `reports.routes.js` — 4 GET endpoints registered under `/api/v1/reports`

### P9.2 · Frontend
- [x] `T-164` Reports page — net worth snapshot section with category breakdown table
- [x] `T-165` Reports page — interest & income section
- [x] `T-166` Reports page — insurance summary section
- [x] `T-167` Reports page — loan statement section
- [x] `T-168` Print / PDF export and CSV download for all report sections
- [x] `T-169` Report header with user info, generated date, and app logo (print + CSV)

---

## Phase 10 — Settings & Appearance

### P10.1 · Backend
- [x] `T-170` `GET /api/v1/auth/profile` — fetch user profile (name, PAN, DOB, risk profile)
- [x] `T-171` `PATCH /api/v1/auth/profile` — update profile fields
- [x] `T-172` `PATCH /api/v1/auth/change-password` — verify old password, set new (bcrypt)
- [x] `T-173` `GET/PATCH /api/v1/auth/appearance` — per-user theme preference (light / dark / system)

### P10.2 · Frontend
- [x] `T-174` Settings page — Profile tab: name, PAN, DOB, risk profile questionnaire
- [x] `T-175` Settings page — Security tab: change password form with show/hide toggle
- [x] `T-176` Settings page — Appearance tab: theme toggle (light / dark / system)
- [x] `T-177` `uiStore` (Zustand) — persist theme preference, apply `dark` class to `<html>` root
- [x] `T-178` Full-app theme coverage — all pages respect dark/light via Tailwind `dark:` classes

---

## Phase 11 — Nominees Management

### P11.1 · Backend
- [x] `T-179` Migration `015_create_nominees.sql` — `nominees` table (asset_type, asset_id, name, relationship, share_pct, contact)
- [x] `T-180` `GET /api/v1/nominees` — list all nominees grouped by asset with coverage %
- [x] `T-181` `POST /api/v1/nominees` — add nominee to an asset
- [x] `T-182` `PUT /api/v1/nominees/:id` — update nominee details
- [x] `T-183` `DELETE /api/v1/nominees/:id` — remove nominee

### P11.2 · Frontend
- [x] `T-184` Nominees page — coverage health check card (% of assets with nominees)
- [x] `T-185` Nominees page — asset-wise nominee list with expand/collapse
- [x] `T-186` Add / edit / delete nominee inline form per asset

---

## Phase 12 — Documents & Records *(next)*

### P12.1 · Backend
- [ ] `T-187` Migration `016_create_documents.sql` — `documents` (id, user_id, asset_type, asset_id, file_name, file_path, mime_type, size_bytes, expires_at, created_at)
- [ ] `T-188` Multer/fastify-multipart setup — store uploads in `uploads/` with UUID filename; enforce 10 MB limit and allowed MIME types (PDF, JPG, PNG)
- [ ] `T-189` `POST /api/v1/documents` — upload file, save metadata, return document record
- [ ] `T-190` `GET /api/v1/documents?asset_type=&asset_id=` — list documents for an asset
- [ ] `T-191` `GET /api/v1/documents/:id/download` — stream file with auth check (owner only)
- [ ] `T-192` `DELETE /api/v1/documents/:id` — delete file from disk + DB record
- [ ] `T-193` Document expiry alert — add to `alerts.controller.js` (insurance policy docs expiring within 30 days)

### P12.2 · Frontend
- [ ] `T-194` `DocumentsPanel.jsx` — reusable component: file list + upload button + delete; used on every asset detail/form
- [ ] `T-195` Wire `DocumentsPanel` into FD, Insurance, Real Estate, and Loan detail views
- [ ] `T-196` Documents page (`/documents`) — global view of all uploaded documents with filter by asset type + expiry date sort
- [ ] `T-197` Upload progress indicator + file type / size validation on the frontend

---

## Ongoing / Cross-cutting

- [ ] `T-126` Error handler middleware — consistent `{ error, message, statusCode }` response format
- [ ] `T-127` Request validation schemas for all Fastify routes (JSON Schema)
- [ ] `T-128` Rate limiting plugin — 100 req/min per IP on auth routes, 500 req/min elsewhere
- [ ] `T-129` Encrypt sensitive fields at app layer (PAN, account numbers) before DB write
- [ ] `T-130` Mobile responsive audit — test all pages at 375px, 768px, 1280px
- [ ] `T-131` `CurrencyDisplay.jsx` — consistent INR formatting (₹1,23,456.78) across app
- [ ] `T-132` Dark mode support via Tailwind `dark:` classes + theme toggle in settings
- [ ] `T-133` `nominees` API sub-resource wired to all applicable asset types
