USE assetmgmt;

CREATE TABLE IF NOT EXISTS insurance_policies (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id             INT UNSIGNED NOT NULL UNIQUE,
  insurance_type       ENUM('term','endowment','money_back','ulip','lic','health','vehicle','critical_illness') NOT NULL,
  insurer              VARCHAR(255) NOT NULL,
  policy_number        VARCHAR(100),
  plan_name            VARCHAR(255),
  -- Coverage
  sum_assured          DECIMAL(15,2),
  -- Premium
  annual_premium       DECIMAL(15,2) NOT NULL,
  premium_frequency    ENUM('monthly','quarterly','half_yearly','yearly','single') DEFAULT 'yearly',
  -- Dates
  start_date           DATE NOT NULL,
  renewal_date         DATE,
  policy_term_years    SMALLINT UNSIGNED,
  premium_term_years   SMALLINT UNSIGNED,
  -- Life insurance specific
  bonus_accumulated    DECIMAL(15,2) DEFAULT 0,
  surrender_value      DECIMAL(15,2),
  -- Health insurance specific
  family_floater       TINYINT(1) DEFAULT 0,
  members_covered      TEXT,
  no_claim_bonus       DECIMAL(5,2) DEFAULT 0,
  -- Vehicle insurance specific
  vehicle_number       VARCHAR(20),
  idv                  DECIMAL(15,2),
  ncb_percent          DECIMAL(5,2) DEFAULT 0,
  ins_type_vehicle     ENUM('third_party','comprehensive') DEFAULT 'comprehensive',
  -- ULIP
  fund_value           DECIMAL(15,2),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_renewal (renewal_date),
  INDEX idx_type (insurance_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insurance_nominees (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_id       INT UNSIGNED NOT NULL,
  name            VARCHAR(255) NOT NULL,
  relationship    VARCHAR(100),
  share_percent   DECIMAL(5,2) DEFAULT 100.00,
  dob             DATE,
  FOREIGN KEY (policy_id) REFERENCES insurance_policies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insurance_premium_payments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_id       INT UNSIGNED NOT NULL,
  payment_date    DATE NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  is_paid         TINYINT(1) DEFAULT 1,
  receipt_number  VARCHAR(100),
  notes           TEXT,
  created_at      DATETIME DEFAULT NOW(),
  FOREIGN KEY (policy_id) REFERENCES insurance_policies(id) ON DELETE CASCADE,
  INDEX idx_policy_date (policy_id, payment_date)
) ENGINE=InnoDB;
