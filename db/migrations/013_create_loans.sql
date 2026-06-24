USE assetmgmt;

CREATE TABLE IF NOT EXISTS loans (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id            INT UNSIGNED NOT NULL UNIQUE,
  loan_type           ENUM('home','car','personal','education','lap','gold','credit_card') NOT NULL,
  lender              VARCHAR(255) NOT NULL,
  loan_account_number VARCHAR(100),
  principal_amount    DECIMAL(15,2) NOT NULL,
  outstanding_amount  DECIMAL(15,2) NOT NULL,
  interest_rate       DECIMAL(5,2) NOT NULL,
  rate_type           ENUM('fixed','floating') DEFAULT 'fixed',
  tenure_months       SMALLINT UNSIGNED NOT NULL,
  emi_amount          DECIMAL(15,2),
  disbursement_date   DATE NOT NULL,
  emi_due_day         TINYINT UNSIGNED DEFAULT 1,
  -- Home loan specific
  property_address    VARCHAR(500),
  -- Education loan specific
  moratorium_months   SMALLINT UNSIGNED DEFAULT 0,
  -- Credit card specific
  credit_limit        DECIMAL(15,2),
  minimum_due         DECIMAL(15,2),
  payment_due_date    DATE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_loan_type (loan_type),
  INDEX idx_due_day (emi_due_day)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loan_transactions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  loan_id         INT UNSIGNED NOT NULL,
  txn_date        DATE NOT NULL,
  txn_type        ENUM('emi','prepayment','rate_change','partial_closure') NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  principal_part  DECIMAL(15,2),
  interest_part   DECIMAL(15,2),
  new_rate        DECIMAL(5,2),
  notes           TEXT,
  created_at      DATETIME DEFAULT NOW(),
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  INDEX idx_loan_date (loan_id, txn_date)
) ENGINE=InnoDB;
