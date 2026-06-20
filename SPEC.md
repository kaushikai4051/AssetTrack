# Asset Management Application — Product Specification

## Tech Stack Decision

| Layer | Choice |
|---|---|
| Frontend | React + Vite (SPA) |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend | Node.js + Fastify (REST API) |
| Database | MySQL (primary) + Redis (cache/sessions) |
| Language | JavaScript (no TypeScript) |
| Infra | Local dev first; cloud TBD |

---

## Overview

A personal finance and asset management platform tailored for Indian investors to track, analyze, and optimize their entire financial portfolio across all asset classes. The system provides real-time net worth tracking, return calculations, tax insights, and goal-based financial planning.

---

## 1. Asset Categories & Sub-features

### 1.1 Bank Accounts

#### Fixed Deposits (FD)
- Bank name, branch, account number (masked)
- Principal amount, interest rate (%), tenure (months/years)
- Start date, maturity date
- Interest payout type: cumulative / monthly / quarterly
- Auto-renewal flag
- TDS deduction tracking
- Maturity amount (calculated)
- Premature withdrawal penalty tracking

#### Recurring Deposits (RD)
- Monthly installment amount, tenure, interest rate
- Bank name, start date, maturity date
- Missed installments tracking
- Projected vs actual maturity value

#### Savings / Current Account
- Bank name, account number (masked), account type
- Current balance (manual entry or bank sync)
- Interest rate for savings account
- Average monthly balance tracking
- Linked assets (e.g., FD, RD funded from this account)

---

### 1.2 Mutual Funds

#### SIP (Systematic Investment Plan)
- Fund name, AMC, fund category (Equity/Debt/Hybrid/Index)
- SIP amount, frequency (monthly/weekly), start date
- Folio number, ISIN
- NAV tracking (latest NAV auto-fetch)
- Units accumulated over time
- Current value, invested amount, absolute returns, XIRR
- SIP pause/stop tracking
- SIP mandate bank account

#### Lumpsum / One-time Investment
- Fund name, AMC, ISIN, folio number
- Investment date, units purchased, NAV at purchase
- Current NAV, current value
- Absolute return, CAGR, XIRR
- Redemption history

#### Common Mutual Fund Features
- Fund rating (CRISIL/ValueResearch)
- Risk category (Low / Moderate / High / Very High)
- Dividend received history
- Switch history (between funds)
- Exit load and lock-in period tracking
- ELSS lock-in tracking (3-year lock per installment)
- Capital gains split: LTCG / STCG per unit lot
- Consolidated Account Statement (CAS) import support

---

### 1.3 Stocks & Equity

#### Indian Stocks (NSE / BSE)
- Stock name, ticker symbol, exchange
- Purchase lots (date, quantity, buy price, brokerage)
- Current market price (auto-fetch)
- Current value, P&L, return %
- Dividend received history
- Corporate actions: splits, bonus, rights issue
- LTCG / STCG calculation per lot (grandfathering for pre-2018)
- Sector allocation
- Broker account linkage (Zerodha, Groww, Upstox, etc.)

#### International / US Stocks
- Ticker (NYSE/NASDAQ), currency (USD/EUR)
- Purchase details, current price
- Currency conversion at purchase and current
- Realized/unrealized forex gain/loss
- FEMA/LRS limit tracking (USD 250,000/year)

#### Stock Portfolio Analytics
- Sector-wise exposure
- Concentration risk alerts
- Dividend yield on cost

---

### 1.4 Gold

#### Physical Gold
- Form: jewellery / coins / bars
- Weight (grams), purity (karats / fineness)
- Purchase date, purchase price per gram
- Making charges (for jewellery, excluded from investment value)
- Storage location / locker details
- Current market value (auto-fetch gold price)

#### Gold ETF
- Fund name, units, buy price, current NAV
- Same as mutual fund tracking

#### Sovereign Gold Bonds (SGB)
- Series name, units (1 unit = 1 gram)
- Issue price, issue date, maturity date (8 years)
- Interest rate (2.5% p.a.), interest payout dates
- Early exit tracking (after 5 years on exchange)
- Tax-free maturity benefit flag

#### Digital Gold
- Platform (MMTC-PAMP, SafeGold, PhonePe)
- Grams held, buy price, current value

---

### 1.5 Fixed Income & Bonds

#### Corporate Bonds / NCDs
- Issuer name, ISIN, credit rating (CRISIL/ICRA)
- Face value, coupon rate, coupon frequency
- Purchase price, purchase date
- Maturity date, maturity amount
- Interest received history
- Yield to Maturity (YTM) calculation
- Secured / Unsecured flag
- Call/put option details

#### Government Securities (G-Sec / T-Bills)
- Type: T-Bill (91/182/364 days) / G-Sec / SDL
- Face value, purchase price, issue date, maturity date
- Yield calculation

#### Tax-Free Bonds
- Issuer (NHAI, REC, PFC, IRFC)
- Face value, coupon rate, maturity date
- Exchange listed / OTC
- Tax-free interest tracking

---

### 1.6 Government / Tax-Saving Schemes

#### PPF (Public Provident Fund)
- Account number, bank/post office
- Annual contribution (max ₹1.5L), contribution dates
- Opening date, current balance
- Interest rate (quarterly government updates)
- Year-wise interest earned
- 15-year lock-in, extension tracking (5-year blocks)
- Partial withdrawal eligibility (after 7 years)
- Loan against PPF tracking
- 80C deduction tracking

#### NPS (National Pension System)
- PRAN number, tier (Tier I / Tier II)
- Subscriber type: Government / Corporate / All Citizens
- Fund manager, scheme (Active / Auto choice)
- Contribution history (self + employer)
- Current value (equity + debt + alternative allocation)
- Returns per fund manager
- Exit / Annuity planning at 60
- Tax deduction: 80CCD(1), 80CCD(1B) ₹50K additional, 80CCD(2) employer

#### EPF (Employee Provident Fund)
- UAN number, employer name
- Employee + employer contribution per month
- Current balance (employee + employer + VPF)
- Interest rate (annual EPFO announcement)
- Claim history
- VPF (Voluntary Provident Fund) extra contribution tracking
- Transfer tracking (between employers)
- EDLI insurance cover

#### Sukanya Samriddhi Yojana (SSY)
- Account for girl child (up to 2 accounts)
- Annual deposit (min ₹250, max ₹1.5L)
- Opening date, maturity at girl's age 21
- Interest rate, current balance
- 80C deduction

#### National Savings Certificate (NSC)
- Certificate number, denomination, issue date
- Maturity date (5 years), interest rate
- Interest compounded annually (taxable but reinvested counts for 80C)

#### Senior Citizen Savings Scheme (SCSS)
- Account number, deposit amount, tenure (5 years)
- Quarterly interest payout tracking
- Extension tracking (3-year extension)

#### Kisan Vikas Patra (KVP)
- Certificate number, amount, issue date
- Maturity date (amount doubles), current value

#### Post Office Time Deposits & MIS
- Tenure, interest rate, monthly income (MIS)
- Current balance, maturity date

---

### 1.7 Insurance

#### Life Insurance — Term Plan
- Insurer, policy number, plan name
- Sum assured, annual premium, policy term
- Premium due dates, payment history
- Nominee details
- Lapse / reinstatement tracking
- Rider details (accidental death, critical illness)

#### Life Insurance — Endowment / Money-back
- Same as term + bonus tracking (reversionary / terminal)
- Survival benefit payout schedule
- Surrender value at each year
- Maturity date, maturity benefit

#### ULIP (Unit Linked Insurance Plan)
- Insurer, policy number, fund allocation
- NAV per fund, current fund value
- Premium allocation charges, mortality charges, fund management charges
- Lock-in period (5 years)
- Switching history
- Death benefit vs fund value

#### LIC Policies (any type)
- Policy number, plan number, plan name
- Sum assured, bonus accumulated
- Premium amount, mode, next due date
- Loan against policy tracking
- Surrender value

#### Health Insurance
- Insurer, policy number, type (individual / floater / super top-up)
- Sum insured, family members covered
- Premium, renewal date
- Claim history, no-claim bonus
- Waiting period tracking (PED, maternity)
- Network hospital list link

#### Vehicle Insurance
- Vehicle number, insurer, policy number
- Type: third-party / comprehensive
- IDV (Insured Declared Value)
- Premium, expiry date
- NCB (No Claim Bonus) %
- Renewal reminders

#### Critical Illness / Accident Insurance
- Sum insured, conditions covered
- Premium, renewal date

---

### 1.8 Real Estate

#### Residential / Commercial Property
- Property name/address, type (flat / villa / plot / commercial)
- Purchase date, purchase price, registration charges, stamp duty
- Current market value (manual / auto estimate via area rate)
- Rental income (if rented): monthly rent, tenant details, agreement dates
- Loan linked (from Loans section)
- Maintenance charges, property tax
- Capital gains calculation on sale
- Co-owner details & ownership %

#### REITs (Real Estate Investment Trusts)
- REIT name, units, buy price, current NAV
- Distribution received (interest + dividend + capital gains component)

---

### 1.9 Loans & Liabilities

#### Home Loan
- Lender, loan account number
- Loan amount, disbursement date, interest rate (fixed/floating)
- Tenure, EMI amount, EMI due date
- Outstanding principal (amortization schedule)
- Prepayment history
- Tax benefit: 80C (principal) + 24b (interest) + 80EEA tracking
- Property linked

#### Car / Vehicle Loan
- Lender, loan amount, interest rate, EMI, outstanding
- Vehicle linked

#### Personal Loan
- Lender, amount, interest rate, EMI, tenure, outstanding

#### Education Loan
- Lender, amount, interest rate, moratorium period
- 80E tax deduction (interest only)

#### Loan Against Property / Gold / Securities
- Collateral linked, LTV ratio
- Outstanding, interest rate

#### Credit Card Debt
- Card name, outstanding balance, minimum due
- Interest rate (if carrying balance)
- Due date alert

#### Common Loan Features
- Total debt dashboard
- Debt-to-asset ratio
- Prepayment impact simulator (how much interest saved)
- EMI calendar view
- Loan closure date

---

### 1.10 Cryptocurrency (Optional Module)
- Coin name, exchange (WazirX, CoinDCX, Binance)
- Purchase lots (date, quantity, buy price in INR)
- Current price (auto-fetch)
- Current value, P&L
- Transfer between wallets
- Staking / interest earned
- Tax: VDA tax at 30% flat + 1% TDS tracking (post July 2022)

---

### 1.11 Alternative Assets

#### Chit Funds
- Organizer, monthly contribution, total members, duration
- Bid amount received (if won auction), savings vs prize
- Remaining instalments

#### P2P Lending
- Platform (Faircent, LenDenClub), principal lent
- Borrower details (anonymized), interest rate
- EMI received, outstanding, NPA status

#### Angel / Startup Investments
- Company name, investment round, amount invested
- Valuation at investment, current valuation (if known)
- Convertible note / SAFE / equity %

#### Unlisted Shares / Pre-IPO
- Company, shares, buy price, current estimated value

---

## 2. Core Platform Features

### 2.1 Dashboard & Net Worth
- Total net worth = all assets − all liabilities
- Asset allocation pie/donut chart (by category and sub-category)
- Net worth trend chart (historical, monthly)
- Top gaining / losing assets
- Upcoming events widget: maturity dates, EMI dues, premium renewals, SIP dates
- Quick-add asset button

### 2.2 Portfolio Analytics
- Overall portfolio XIRR (across all assets)
- Category-wise XIRR / CAGR / absolute return
- Inflation-adjusted real returns (vs CPI)
- Benchmark comparison (Nifty 50, Nifty 500, FD rates)
- Asset allocation vs target allocation (with rebalancing suggestions)
- Concentration risk: top 5 holdings % of net worth
- Liquidity analysis: liquid vs semi-liquid vs illiquid

### 2.3 Goal-Based Planning
- Create financial goals: retirement, child education, home purchase, emergency fund, vacation, wedding
- Assign assets to goals
- Goal progress tracker (current value vs target)
- SIP calculator: how much SIP needed to reach goal by target date
- Goal achievement probability (Monte Carlo simulation)
- Shortfall alerts

### 2.4 Tax Module
- **80C Basket**: PPF + ELSS + LIC premium + EPF + NSC + home loan principal + SSY — running total vs ₹1.5L limit
- **80CCD(1B)**: NPS additional ₹50K
- **80D**: Health insurance premiums (self + parents)
- **80E**: Education loan interest
- **24b**: Home loan interest (up to ₹2L for self-occupied)
- **Capital Gains Summary**:
  - Equity LTCG (>1 year, >₹1L exempt, 10% above)
  - Equity STCG (<1 year, 15%)
  - Debt LTCG (>3 years, 20% with indexation for pre-2023 purchases)
  - Debt STCG (slab rate)
  - Gold LTCG/STCG
  - Real estate LTCG with indexation (>2 years, 20%)
- **TDS tracker**: TDS on FD interest (26AS reconciliation)
- **Advance tax calendar**: quarterly payment reminders
- **Tax harvesting suggestions**: book losses to offset gains before March 31

### 2.5 Alerts & Notifications
- Maturity alerts: FD, RD, NSC, KVP, bond (configurable days before)
- Insurance premium due dates
- SIP execution dates
- EMI due dates
- PPF / SSY annual contribution reminder (before March 31)
- Loan rate change notifications (for floating rate loans)
- ELSS 3-year lock-in completion per lot
- SGB early exit window (5th year anniversary)
- Goal milestone achieved
- Tax-saving limit approaching (80C, 80D)
- Net worth milestones (every ₹5L increase, configurable)

### 2.6 Documents & Records
- Attach documents to each asset: purchase receipts, passbooks, policy bonds, certificates
- Document expiry alerts (insurance policies, property documents)
- Nominee document storage
- File types: PDF, JPG, PNG (with encryption at rest)
- Storage limit per plan tier

### 2.7 Reports
- Net worth report (monthly/quarterly/annual snapshot)
- Capital gains report (financial year wise, ready for ITR filing)
- Dividend / interest income report
- Insurance coverage summary report
- Loan statement (interest paid, principal paid, outstanding)
- PDF export for all reports
- Excel/CSV export for raw data

### 2.8 Family / Multi-Profile
- Manage assets for self, spouse, children (minor), parents
- Consolidated family net worth view
- Individual profile view
- Shared goal planning

### 2.9 Nominees Management
- Add nominee per asset with name, relationship, %
- Overall nominee coverage health check
- Flag assets with missing nominees

### 2.10 Data Import & Integration
- Mutual fund CAS (CAMS/KFintech PDF import)
- EPF passbook import
- Bank statement (CSV/OFX import for transaction history)
- Broker P&L report import (Zerodha, Groww, Upstox, Angel One)
- Insurance policy import (manual entry or fetcher)
- Form 26AS import (tax reconciliation)
- AIS (Annual Information Statement) import

---

## 3. User Management

- Signup / Login: email + password, Google OAuth, mobile OTP
- Two-factor authentication (TOTP / SMS)
- Role-based: Owner / Viewer (read-only sharing link for family member / CA)
- Profile: name, PAN, DOB, risk profile questionnaire
- Subscription tiers: Free (limited assets) / Pro / Family

---

## 4. Security Requirements

- All data encrypted at rest (AES-256)
- All communications over HTTPS (TLS 1.3)
- No storage of bank credentials (screen scraping avoided; use official APIs or manual entry)
- Masked sensitive fields (account numbers, PAN)
- Session timeout and device management
- Audit log of all changes
- GDPR / DPDP Act compliance (data export, right to delete)
- Regular automated backups

---

## 5. Non-Functional Requirements

- Mobile-first responsive web app + native mobile apps (iOS & Android)
- Offline mode for viewing last-synced data
- Page load < 2 seconds for dashboard
- Support for 10,000+ transactions per user
- Audit trail: every record change logged with timestamp
- Multi-currency support (INR primary, USD for international)
- Accessibility: WCAG 2.1 AA compliance

---

## 6. Possible Future Enhancements (Out of Scope v1)

- AI-based portfolio advisor / rebalancing suggestions
- Direct mutual fund investment (via BSE Star MF / MFU API)
- UPI / bank account aggregation (via Account Aggregator / AA framework)
- Wealthtech integrations (Smallcase, Kuvera, Zerodha Coin)
- Automated tax filing assistance (ITR integration)
- Inheritance / will planning module
- WhatsApp / Telegram bot for quick balance queries
