USE assetmgmt;

CREATE TABLE IF NOT EXISTS govt_scheme_holdings (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id               INT UNSIGNED NOT NULL UNIQUE,
  scheme_type            ENUM('ppf','nps','epf','nsc','ssy','scss','kvp','po_td','po_mis','po_rd') NOT NULL,

  -- Common
  account_number         VARCHAR(100),
  institution            VARCHAR(200),
  start_date             DATE,
  maturity_date          DATE,
  maturity_amount        DECIMAL(14,2),
  interest_rate          DECIMAL(5,2),
  nominee                VARCHAR(200),

  -- NPS
  pran                   VARCHAR(20),
  nps_account_type       ENUM('tier1','tier2'),
  fund_manager           VARCHAR(100),

  -- EPF
  uan                    VARCHAR(20),
  employee_share         DECIMAL(14,2),
  employer_share         DECIMAL(14,2),
  eps_balance            DECIMAL(14,2),

  -- SSY
  beneficiary_name       VARCHAR(200),
  beneficiary_dob        DATE,

  -- KVP
  maturity_period_months INT UNSIGNED,

  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Transactions are tracked for PPF and EPF primarily
CREATE TABLE IF NOT EXISTS govt_scheme_transactions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  holding_id  INT UNSIGNED NOT NULL,
  tx_date     DATE NOT NULL,
  tx_type     ENUM('deposit','withdrawal','interest','employer_contribution','maturity') NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  description VARCHAR(500),
  FOREIGN KEY (holding_id) REFERENCES govt_scheme_holdings(id) ON DELETE CASCADE
) ENGINE=InnoDB;
