USE assetmgmt;

CREATE TABLE IF NOT EXISTS mutual_funds (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id        INT UNSIGNED NOT NULL UNIQUE,
  scheme_name     VARCHAR(512) NOT NULL,
  scheme_code     VARCHAR(20) NOT NULL,
  isin            VARCHAR(20),
  fund_house      VARCHAR(255),
  category        VARCHAR(100),
  plan_type       ENUM('growth','idcw') DEFAULT 'growth',
  folio_number    VARCHAR(50),
  units_held      DECIMAL(18,4) DEFAULT 0.0000,
  avg_cost_nav    DECIMAL(12,4) DEFAULT 0.0000,
  last_nav        DECIMAL(12,4),
  last_nav_date   DATE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_scheme_code (scheme_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mutual_fund_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fund_id          INT UNSIGNED NOT NULL,
  type             ENUM('purchase','redemption','dividend_reinvest','switch_in','switch_out') NOT NULL,
  source           ENUM('sip','lumpsum','switch','dividend') DEFAULT 'lumpsum',
  transaction_date DATE NOT NULL,
  units            DECIMAL(18,4) NOT NULL,
  nav              DECIMAL(12,4) NOT NULL,
  amount           DECIMAL(15,2) NOT NULL,
  notes            VARCHAR(500),
  FOREIGN KEY (fund_id) REFERENCES mutual_funds(id) ON DELETE CASCADE,
  INDEX idx_fund_date (fund_id, transaction_date)
) ENGINE=InnoDB;
