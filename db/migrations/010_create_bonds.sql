USE assetmgmt;

CREATE TABLE IF NOT EXISTS bond_holdings (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id          INT UNSIGNED NOT NULL UNIQUE,
  bond_type         ENUM('corporate','ncd','gsec','tbill','sdl','tax_free') NOT NULL,
  issuer            VARCHAR(255) NOT NULL,
  isin              VARCHAR(20),
  credit_rating     VARCHAR(20),
  face_value        DECIMAL(15,2) NOT NULL,
  units             DECIMAL(12,4) NOT NULL DEFAULT 1,
  coupon_rate       DECIMAL(5,2) NOT NULL DEFAULT 0,
  coupon_frequency  ENUM('monthly','quarterly','half_yearly','yearly','on_maturity') DEFAULT 'half_yearly',
  purchase_price    DECIMAL(15,2) NOT NULL,
  purchase_date     DATE NOT NULL,
  maturity_date     DATE NOT NULL,
  is_secured        TINYINT(1) DEFAULT 1,
  is_listed         TINYINT(1) DEFAULT 1,
  ytm               DECIMAL(6,4),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_maturity (maturity_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bond_coupon_payments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bond_id       INT UNSIGNED NOT NULL,
  payment_date  DATE NOT NULL,
  amount        DECIMAL(15,2) NOT NULL,
  is_received   TINYINT(1) DEFAULT 0,
  notes         TEXT,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (bond_id) REFERENCES bond_holdings(id) ON DELETE CASCADE,
  INDEX idx_bond_date (bond_id, payment_date)
) ENGINE=InnoDB;
