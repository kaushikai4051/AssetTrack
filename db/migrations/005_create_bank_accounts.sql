USE assetmgmt;

CREATE TABLE IF NOT EXISTS fixed_deposits (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id        INT UNSIGNED NOT NULL UNIQUE,
  bank_name       VARCHAR(255) NOT NULL,
  account_number  VARCHAR(100),
  principal       DECIMAL(15,2) NOT NULL,
  interest_rate   DECIMAL(5,2) NOT NULL,
  compounding     ENUM('monthly','quarterly','half_yearly','yearly','simple') DEFAULT 'quarterly',
  start_date      DATE NOT NULL,
  maturity_date   DATE NOT NULL,
  maturity_amount DECIMAL(15,2),
  is_auto_renew   TINYINT(1) DEFAULT 0,
  nominee_name    VARCHAR(255),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_maturity (maturity_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recurring_deposits (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id        INT UNSIGNED NOT NULL UNIQUE,
  bank_name       VARCHAR(255) NOT NULL,
  account_number  VARCHAR(100),
  monthly_amount  DECIMAL(15,2) NOT NULL,
  interest_rate   DECIMAL(5,2) NOT NULL,
  tenure_months   SMALLINT UNSIGNED NOT NULL,
  start_date      DATE NOT NULL,
  maturity_date   DATE NOT NULL,
  maturity_amount DECIMAL(15,2),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_maturity (maturity_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS savings_accounts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id        INT UNSIGNED NOT NULL UNIQUE,
  bank_name       VARCHAR(255) NOT NULL,
  account_number  VARCHAR(100),
  account_type    ENUM('savings','current','salary') DEFAULT 'savings',
  ifsc_code       VARCHAR(20),
  branch_name     VARCHAR(255),
  interest_rate   DECIMAL(5,2) DEFAULT 0.00,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB;
