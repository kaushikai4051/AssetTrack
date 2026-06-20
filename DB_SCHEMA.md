# Database Schema — Asset Management App (MySQL 8)

## Design Pattern

- `assets` is the **base table** — every asset (FD, stock, mutual fund, etc.) has one row here with shared fields.
- Each asset type has a **child table** linked by `asset_id` (1-to-1) that holds type-specific fields.
- Transactional assets (MF, stocks, PPF, loans) have a separate **transactions table** (1-to-many) for history.
- `current_value` in the `assets` table is a **calculated cache** refreshed by background jobs. Raw transactions are the source of truth.

---

## Core Tables

### `users`
```sql
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  mobile        VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  is_verified   TINYINT(1) DEFAULT 0,
  is_active     TINYINT(1) DEFAULT 1,
  totp_secret   VARCHAR(255),             -- 2FA secret (encrypted)
  created_at    DATETIME DEFAULT NOW(),
  updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW()
);
```

### `user_profiles`
```sql
CREATE TABLE user_profiles (
  user_id       INT UNSIGNED PRIMARY KEY,
  full_name     VARCHAR(255) NOT NULL,
  pan           VARCHAR(10),              -- encrypted at app layer
  dob           DATE,
  risk_profile  ENUM('conservative','moderate','aggressive'),
  avatar_url    VARCHAR(512),
  base_currency CHAR(3) DEFAULT 'INR',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### `family_members`
```sql
CREATE TABLE family_members (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  relation      ENUM('self','spouse','child','parent','sibling','other') NOT NULL,
  dob           DATE,
  pan           VARCHAR(10),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### `subscriptions`
```sql
CREATE TABLE subscriptions (
  user_id    INT UNSIGNED PRIMARY KEY,
  plan       ENUM('free','pro','family') DEFAULT 'free',
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Asset Base Table

### `assets`
```sql
CREATE TABLE assets (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL,
  family_member_id INT UNSIGNED,           -- null = owner themselves
  asset_type       ENUM(
                     'fixed_deposit','recurring_deposit','savings_account',
                     'mutual_fund','stock','gold',
                     'corporate_bond','gsec_bond','tax_free_bond',
                     'ppf','nps','epf','ssy','nsc','scss','kvp','post_office',
                     'life_insurance','health_insurance','vehicle_insurance',
                     'property','reit',
                     'home_loan','car_loan','personal_loan','education_loan',
                     'lap_loan','gold_loan','credit_card_debt',
                     'crypto','chit_fund','p2p_lending','angel_investment','unlisted_shares'
                   ) NOT NULL,
  asset_name       VARCHAR(255) NOT NULL,  -- user-friendly label
  currency         CHAR(3) DEFAULT 'INR',
  current_value    DECIMAL(15,2) DEFAULT 0.00,  -- cached, updated by job
  invested_amount  DECIMAL(15,2) DEFAULT 0.00,  -- total cost basis
  notes            TEXT,
  is_active        TINYINT(1) DEFAULT 1,
  created_at       DATETIME DEFAULT NOW(),
  updated_at       DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL,
  INDEX idx_user_type (user_id, asset_type),
  INDEX idx_user_active (user_id, is_active)
);
```

---

## Bank Account Tables

### `fixed_deposits`
```sql
CREATE TABLE fixed_deposits (
  asset_id          INT UNSIGNED PRIMARY KEY,
  bank_name         VARCHAR(255) NOT NULL,
  branch            VARCHAR(255),
  account_number    VARCHAR(50),           -- stored encrypted
  principal_amount  DECIMAL(12,2) NOT NULL,
  interest_rate     DECIMAL(5,2) NOT NULL, -- annual %
  tenure_months     SMALLINT UNSIGNED NOT NULL,
  start_date        DATE NOT NULL,
  maturity_date     DATE NOT NULL,
  interest_type     ENUM('cumulative','monthly','quarterly','annually') DEFAULT 'cumulative',
  auto_renewal      TINYINT(1) DEFAULT 0,
  tds_applicable    TINYINT(1) DEFAULT 1,
  maturity_amount   DECIMAL(12,2),         -- calculated and stored
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `recurring_deposits`
```sql
CREATE TABLE recurring_deposits (
  asset_id            INT UNSIGNED PRIMARY KEY,
  bank_name           VARCHAR(255) NOT NULL,
  account_number      VARCHAR(50),
  monthly_installment DECIMAL(10,2) NOT NULL,
  interest_rate       DECIMAL(5,2) NOT NULL,
  tenure_months       SMALLINT UNSIGNED NOT NULL,
  start_date          DATE NOT NULL,
  maturity_date       DATE NOT NULL,
  missed_installments TINYINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `savings_accounts`
```sql
CREATE TABLE savings_accounts (
  asset_id        INT UNSIGNED PRIMARY KEY,
  bank_name       VARCHAR(255) NOT NULL,
  account_number  VARCHAR(50),
  account_type    ENUM('savings','current','salary') DEFAULT 'savings',
  current_balance DECIMAL(12,2) NOT NULL,
  interest_rate   DECIMAL(5,2) DEFAULT 0.00,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Mutual Fund Tables

### `mutual_funds`
```sql
CREATE TABLE mutual_funds (
  asset_id         INT UNSIGNED PRIMARY KEY,
  fund_name        VARCHAR(255) NOT NULL,
  amc              VARCHAR(255),
  isin             VARCHAR(12),
  scheme_code      VARCHAR(10),            -- MFAPI scheme code
  folio_number     VARCHAR(50),
  investment_type  ENUM('sip','lumpsum') NOT NULL,
  fund_category    ENUM('equity','debt','hybrid','index','elss','liquid','gold','international','other'),
  risk_category    ENUM('low','moderate_low','moderate','moderately_high','high','very_high'),
  -- SIP-specific
  sip_amount       DECIMAL(10,2),
  sip_frequency    ENUM('weekly','monthly','quarterly'),
  sip_start_date   DATE,
  sip_status       ENUM('active','paused','stopped'),
  sip_bank_account VARCHAR(100),           -- mandate bank
  -- Current state
  units_held       DECIMAL(15,4) DEFAULT 0,
  average_nav      DECIMAL(10,4),
  current_nav      DECIMAL(10,4),
  -- ELSS lock-in
  is_elss          TINYINT(1) DEFAULT 0,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `mutual_fund_transactions`
```sql
CREATE TABLE mutual_fund_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id         INT UNSIGNED NOT NULL,
  transaction_type ENUM('buy','sell','switch_in','switch_out','dividend_reinvest','dividend_payout','sip') NOT NULL,
  transaction_date DATE NOT NULL,
  units            DECIMAL(15,4) NOT NULL,
  nav              DECIMAL(10,4) NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,  -- negative = outflow, positive = inflow
  stamp_duty       DECIMAL(8,2) DEFAULT 0,
  created_at       DATETIME DEFAULT NOW(),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_asset_date (asset_id, transaction_date)
);
```

---

## Stock Tables

### `stock_holdings`
```sql
CREATE TABLE stock_holdings (
  asset_id      INT UNSIGNED PRIMARY KEY,
  ticker        VARCHAR(20) NOT NULL,
  exchange      ENUM('NSE','BSE','NYSE','NASDAQ','OTHER') DEFAULT 'NSE',
  company_name  VARCHAR(255),
  sector        VARCHAR(100),
  broker_account VARCHAR(100),
  is_international TINYINT(1) DEFAULT 0,
  units_held    DECIMAL(12,4) DEFAULT 0,   -- updated from transactions
  average_price DECIMAL(10,4),
  current_price DECIMAL(10,4),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `stock_transactions`
```sql
CREATE TABLE stock_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id         INT UNSIGNED NOT NULL,
  transaction_type ENUM('buy','sell','bonus','split','dividend','rights') NOT NULL,
  transaction_date DATE NOT NULL,
  quantity         DECIMAL(12,4) NOT NULL,
  price            DECIMAL(10,4),           -- null for bonus/split
  brokerage        DECIMAL(8,2) DEFAULT 0,
  stt              DECIMAL(8,2) DEFAULT 0,
  total_amount     DECIMAL(12,2),
  split_ratio      VARCHAR(10),             -- e.g. "2:1" for splits
  exchange_rate    DECIMAL(10,4) DEFAULT 1, -- for international stocks
  created_at       DATETIME DEFAULT NOW(),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_asset_date (asset_id, transaction_date)
);
```

---

## Gold Table

### `gold_holdings`
```sql
CREATE TABLE gold_holdings (
  asset_id              INT UNSIGNED PRIMARY KEY,
  gold_type             ENUM('physical','etf','sgb','digital') NOT NULL,
  -- Physical / Digital
  weight_grams          DECIMAL(10,4),
  purity_karats         TINYINT,           -- 24, 22, 18
  purchase_date         DATE,
  purchase_price_per_gram DECIMAL(10,2),
  making_charges        DECIMAL(10,2),     -- jewellery only
  storage_location      VARCHAR(255),
  -- ETF (same as MF, links to mutual_funds table)
  -- SGB
  sgb_series            VARCHAR(50),
  sgb_units             DECIMAL(10,4),     -- 1 unit = 1 gram
  sgb_issue_price       DECIMAL(10,2),
  sgb_issue_date        DATE,
  sgb_maturity_date     DATE,
  sgb_interest_rate     DECIMAL(5,2) DEFAULT 2.50,
  -- Digital
  platform              VARCHAR(100),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Bond Tables

### `bond_holdings`
```sql
CREATE TABLE bond_holdings (
  asset_id           INT UNSIGNED PRIMARY KEY,
  issuer             VARCHAR(255) NOT NULL,
  isin               VARCHAR(12),
  bond_type          ENUM('corporate','gsec','sdl','tbill','tax_free','ncd') NOT NULL,
  face_value         DECIMAL(12,2) NOT NULL,
  units              DECIMAL(10,4) DEFAULT 1,
  coupon_rate        DECIMAL(5,2),         -- annual %
  coupon_frequency   ENUM('monthly','quarterly','semi_annual','annual','none'),
  purchase_date      DATE NOT NULL,
  purchase_price     DECIMAL(12,2) NOT NULL,
  maturity_date      DATE NOT NULL,
  credit_rating      VARCHAR(20),          -- AAA, AA+, etc.
  is_secured         TINYINT(1) DEFAULT 1,
  ytm                DECIMAL(6,4),         -- calculated
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `bond_coupon_payments`
```sql
CREATE TABLE bond_coupon_payments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id     INT UNSIGNED NOT NULL,
  payment_date DATE NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  tds_deducted DECIMAL(8,2) DEFAULT 0,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Government Scheme Tables

### `ppf_accounts`
```sql
CREATE TABLE ppf_accounts (
  asset_id         INT UNSIGNED PRIMARY KEY,
  account_number   VARCHAR(50),
  bank_name        VARCHAR(255),
  post_office      VARCHAR(255),
  opening_date     DATE NOT NULL,
  current_balance  DECIMAL(12,2) DEFAULT 0,
  extension_count  TINYINT DEFAULT 0,      -- 5-year extensions after 15 years
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `ppf_transactions`
```sql
CREATE TABLE ppf_transactions (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id       INT UNSIGNED NOT NULL,
  financial_year CHAR(7) NOT NULL,         -- e.g. '2024-25'
  deposit_amount DECIMAL(10,2) NOT NULL,
  deposit_date   DATE NOT NULL,
  interest_earned DECIMAL(10,2),           -- annual interest credited
  closing_balance DECIMAL(12,2),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `nps_accounts`
```sql
CREATE TABLE nps_accounts (
  asset_id                  INT UNSIGNED PRIMARY KEY,
  pran                      VARCHAR(16) NOT NULL,
  tier                      ENUM('1','2') DEFAULT '1',
  subscriber_type           ENUM('government','corporate','all_citizens'),
  fund_manager              VARCHAR(255),
  scheme_preference         ENUM('active','auto'),
  -- Active choice %
  equity_pct                TINYINT,       -- 0-75
  debt_pct                  TINYINT,
  alternative_pct           TINYINT,
  -- Current values by asset class
  current_value_equity      DECIMAL(12,2) DEFAULT 0,
  current_value_debt        DECIMAL(12,2) DEFAULT 0,
  current_value_alternative DECIMAL(12,2) DEFAULT 0,
  employer_contribution_monthly DECIMAL(10,2) DEFAULT 0,
  employee_contribution_monthly DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `epf_accounts`
```sql
CREATE TABLE epf_accounts (
  asset_id                     INT UNSIGNED PRIMARY KEY,
  uan                          VARCHAR(12),
  employer_name                VARCHAR(255),
  employee_contribution_monthly DECIMAL(10,2),
  employer_contribution_monthly DECIMAL(10,2),
  vpf_amount_monthly           DECIMAL(10,2) DEFAULT 0,
  current_balance_employee     DECIMAL(12,2) DEFAULT 0,
  current_balance_employer     DECIMAL(12,2) DEFAULT 0,
  current_balance_vpf          DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `govt_scheme_holdings` (NSC, SSY, SCSS, KVP, Post Office)
```sql
CREATE TABLE govt_scheme_holdings (
  asset_id      INT UNSIGNED PRIMARY KEY,
  scheme_type   ENUM('nsc','ssy','scss','kvp','po_td','po_mis','po_rd') NOT NULL,
  account_number VARCHAR(50),
  deposit_amount DECIMAL(12,2) NOT NULL,
  interest_rate  DECIMAL(5,2) NOT NULL,
  start_date     DATE NOT NULL,
  maturity_date  DATE NOT NULL,
  current_value  DECIMAL(12,2),
  -- SSY specific
  beneficiary_name VARCHAR(255),         -- girl child name
  -- SCSS specific
  quarterly_payout DECIMAL(10,2),
  -- Post Office MIS
  monthly_income DECIMAL(10,2),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Insurance Tables

### `insurance_policies`
```sql
CREATE TABLE insurance_policies (
  asset_id           INT UNSIGNED PRIMARY KEY,
  insurer            VARCHAR(255) NOT NULL,
  policy_number      VARCHAR(100) NOT NULL,
  plan_name          VARCHAR(255),
  insurance_type     ENUM('term','endowment','money_back','ulip','lic_other',
                          'health_individual','health_floater','health_super_topup',
                          'vehicle_third_party','vehicle_comprehensive',
                          'critical_illness','accident') NOT NULL,
  sum_assured        DECIMAL(12,2) NOT NULL,
  annual_premium     DECIMAL(10,2) NOT NULL,
  premium_mode       ENUM('annual','semi_annual','quarterly','monthly','single'),
  policy_term_years  SMALLINT,
  premium_term_years SMALLINT,
  start_date         DATE NOT NULL,
  maturity_date      DATE,
  next_due_date      DATE,
  -- Health specific
  sum_insured        DECIMAL(12,2),
  family_members_covered JSON,           -- array of family_member IDs
  -- Vehicle specific
  vehicle_number     VARCHAR(20),
  idv                DECIMAL(10,2),
  ncb_pct            TINYINT DEFAULT 0,
  -- ULIP specific
  fund_value         DECIMAL(12,2),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `insurance_premium_payments`
```sql
CREATE TABLE insurance_premium_payments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id       INT UNSIGNED NOT NULL,
  payment_date   DATE NOT NULL,
  amount_paid    DECIMAL(10,2) NOT NULL,
  receipt_number VARCHAR(100),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Real Estate Tables

### `properties`
```sql
CREATE TABLE properties (
  asset_id              INT UNSIGNED PRIMARY KEY,
  property_type         ENUM('residential_flat','residential_villa',
                             'residential_plot','commercial','agricultural') NOT NULL,
  address               TEXT NOT NULL,
  city                  VARCHAR(100),
  state                 VARCHAR(100),
  area_sqft             DECIMAL(10,2),
  purchase_date         DATE NOT NULL,
  purchase_price        DECIMAL(14,2) NOT NULL,
  stamp_duty            DECIMAL(12,2) DEFAULT 0,
  registration_charges  DECIMAL(12,2) DEFAULT 0,
  current_market_value  DECIMAL(14,2),
  is_rented             TINYINT(1) DEFAULT 0,
  monthly_rent          DECIMAL(10,2),
  tenant_name           VARCHAR(255),
  rent_agreement_end    DATE,
  annual_maintenance    DECIMAL(10,2),
  annual_property_tax   DECIMAL(10,2),
  ownership_pct         DECIMAL(5,2) DEFAULT 100.00,
  co_owner_name         VARCHAR(255),
  linked_loan_id        INT UNSIGNED,   -- FK to assets.id of the home loan
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_loan_id) REFERENCES assets(id) ON DELETE SET NULL
);
```

---

## Loan Tables

### `loans`
```sql
CREATE TABLE loans (
  asset_id              INT UNSIGNED PRIMARY KEY,
  lender                VARCHAR(255) NOT NULL,
  loan_account_number   VARCHAR(100),
  loan_type             ENUM('home','car','personal','education',
                             'lap','gold','securities','credit_card') NOT NULL,
  loan_amount           DECIMAL(14,2) NOT NULL,
  disbursement_date     DATE NOT NULL,
  interest_rate         DECIMAL(5,2) NOT NULL,
  interest_type         ENUM('fixed','floating') DEFAULT 'fixed',
  tenure_months         SMALLINT UNSIGNED NOT NULL,
  emi_amount            DECIMAL(10,2) NOT NULL,
  emi_due_day           TINYINT,              -- day of month
  outstanding_principal DECIMAL(14,2) NOT NULL,
  linked_asset_id       INT UNSIGNED,         -- property / vehicle linked
  is_closed             TINYINT(1) DEFAULT 0,
  closure_date          DATE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_asset_id) REFERENCES assets(id) ON DELETE SET NULL
);
```

### `loan_transactions`
```sql
CREATE TABLE loan_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id         INT UNSIGNED NOT NULL,
  transaction_date DATE NOT NULL,
  principal_paid   DECIMAL(10,2) NOT NULL,
  interest_paid    DECIMAL(10,2) NOT NULL,
  total_paid       DECIMAL(10,2) NOT NULL,
  balance_after    DECIMAL(14,2) NOT NULL,
  is_prepayment    TINYINT(1) DEFAULT 0,
  created_at       DATETIME DEFAULT NOW(),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_asset_date (asset_id, transaction_date)
);
```

---

## Alternative Investment Tables

### `crypto_holdings`
```sql
CREATE TABLE crypto_holdings (
  asset_id       INT UNSIGNED PRIMARY KEY,
  coin_symbol    VARCHAR(20) NOT NULL,
  coin_name      VARCHAR(100),
  exchange       VARCHAR(100),
  wallet_address VARCHAR(255),
  units_held     DECIMAL(18,8) DEFAULT 0,
  average_price  DECIMAL(14,4),
  current_price  DECIMAL(14,4),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `crypto_transactions`
```sql
CREATE TABLE crypto_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id         INT UNSIGNED NOT NULL,
  transaction_type ENUM('buy','sell','transfer_in','transfer_out','stake_reward','airdrop') NOT NULL,
  transaction_date DATE NOT NULL,
  quantity         DECIMAL(18,8) NOT NULL,
  price_inr        DECIMAL(14,4),
  total_inr        DECIMAL(14,2),
  tds_deducted     DECIMAL(8,2) DEFAULT 0,
  created_at       DATETIME DEFAULT NOW(),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `alternative_investments`
```sql
CREATE TABLE alternative_investments (
  asset_id         INT UNSIGNED PRIMARY KEY,
  alt_type         ENUM('chit_fund','p2p_lending','angel','unlisted_shares') NOT NULL,
  platform         VARCHAR(255),
  invested_amount  DECIMAL(12,2) NOT NULL,
  current_value    DECIMAL(12,2),
  -- Chit fund
  monthly_contribution DECIMAL(10,2),
  total_members    TINYINT,
  duration_months  TINYINT,
  prize_won        TINYINT(1) DEFAULT 0,
  prize_amount     DECIMAL(12,2),
  -- Angel / Unlisted
  company_name     VARCHAR(255),
  investment_round VARCHAR(50),
  ownership_pct    DECIMAL(8,4),
  valuation_at_investment DECIMAL(14,2),
  -- P2P
  interest_rate    DECIMAL(5,2),
  npa_amount       DECIMAL(10,2) DEFAULT 0,
  details_json     JSON,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Goals Tables

### `goals`
```sql
CREATE TABLE goals (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  name          VARCHAR(255) NOT NULL,
  goal_type     ENUM('retirement','child_education','home_purchase',
                     'emergency_fund','vehicle','vacation','wedding','other') NOT NULL,
  target_amount DECIMAL(14,2) NOT NULL,
  target_date   DATE NOT NULL,
  current_value DECIMAL(14,2) DEFAULT 0,  -- sum of linked assets
  priority      ENUM('high','medium','low') DEFAULT 'medium',
  color         CHAR(7) DEFAULT '#3B82F6', -- hex color for UI
  is_achieved   TINYINT(1) DEFAULT 0,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### `goal_assets`
```sql
CREATE TABLE goal_assets (
  goal_id             INT UNSIGNED NOT NULL,
  asset_id            INT UNSIGNED NOT NULL,
  allocation_pct      DECIMAL(5,2) DEFAULT 100.00,
  PRIMARY KEY (goal_id, asset_id),
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Nominees Table

### `nominees`
```sql
CREATE TABLE nominees (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id       INT UNSIGNED NOT NULL,
  full_name      VARCHAR(255) NOT NULL,
  relationship   VARCHAR(100) NOT NULL,
  dob            DATE,
  share_pct      DECIMAL(5,2) DEFAULT 100.00,
  contact_mobile VARCHAR(15),
  guardian_name  VARCHAR(255),            -- if nominee is minor
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

---

## Documents Table

### `documents`
```sql
CREATE TABLE documents (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  asset_id      INT UNSIGNED,
  document_type ENUM('policy_bond','passbook','certificate','purchase_deed',
                     'statement','aadhaar','pan','other') NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(512) NOT NULL,
  file_size_kb  INT UNSIGNED,
  mime_type     VARCHAR(100),
  expiry_date   DATE,                     -- for insurance, property docs
  uploaded_at   DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
);
```

---

## Alerts & Notifications

### `alert_configs`
```sql
CREATE TABLE alert_configs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  asset_id     INT UNSIGNED,              -- null = global alert type
  alert_type   ENUM('maturity','emi_due','premium_due','sip_date',
                     'ppf_contribution','goal_milestone',
                     'tax_saving_limit','net_worth_milestone') NOT NULL,
  days_before  SMALLINT DEFAULT 30,       -- alert N days before event
  is_active    TINYINT(1) DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
```

### `notifications`
```sql
CREATE TABLE notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  asset_id   INT UNSIGNED,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  type       ENUM('info','warning','success','urgent') DEFAULT 'info',
  is_read    TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  INDEX idx_user_read (user_id, is_read)
);
```

---

## Market Price History

### `market_prices`
```sql
CREATE TABLE market_prices (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  symbol     VARCHAR(50) NOT NULL,        -- ISIN / ticker / 'GOLD_INR' / 'BTC'
  price_type ENUM('mf_nav','stock','gold','crypto') NOT NULL,
  price      DECIMAL(14,4) NOT NULL,
  price_date DATE NOT NULL,
  source     VARCHAR(100),
  UNIQUE KEY uq_symbol_date (symbol, price_date),
  INDEX idx_symbol_date (symbol, price_date DESC)
);
```

---

## Tax Records

### `tax_records`
```sql
CREATE TABLE tax_records (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  financial_year CHAR(7) NOT NULL,         -- '2024-25'
  record_type    ENUM('tds','advance_tax','self_assessment',
                      'capital_gain','dividend','interest_income') NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  record_date    DATE,
  tan            VARCHAR(10),              -- TDS deductor TAN
  details_json   JSON,
  created_at     DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_fy (user_id, financial_year)
);
```

---

## Refresh Tokens (managed in Redis, table as fallback)

### `refresh_tokens`
```sql
CREATE TABLE refresh_tokens (
  token_hash  CHAR(64) PRIMARY KEY,        -- SHA-256 of token
  user_id     INT UNSIGNED NOT NULL,
  device_info VARCHAR(255),
  created_at  DATETIME DEFAULT NOW(),
  expires_at  DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);
```

---

## Index Summary (performance-critical)

```sql
-- Most frequent query: all assets for a user
INDEX idx_user_type  ON assets(user_id, asset_type);
INDEX idx_user_active ON assets(user_id, is_active);

-- Transaction history queries
INDEX idx_asset_date ON mutual_fund_transactions(asset_id, transaction_date);
INDEX idx_asset_date ON stock_transactions(asset_id, transaction_date);
INDEX idx_asset_date ON loan_transactions(asset_id, transaction_date);

-- Price history lookup
INDEX idx_symbol_date ON market_prices(symbol, price_date DESC);

-- Notification polling
INDEX idx_user_read ON notifications(user_id, is_read);

-- Tax records by FY
INDEX idx_user_fy ON tax_records(user_id, financial_year);
```
