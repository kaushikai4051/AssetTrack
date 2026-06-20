USE assetmgmt;

-- quantity meaning by type:
--   physical / digital : weight in grams
--   etf                : number of units (shares)
--   sgb                : number of bonds  (1 bond = 1 gram equivalent)
-- last_price meaning by type:
--   physical / digital / sgb : INR per gram of 24k gold
--   etf                      : INR per ETF unit

CREATE TABLE IF NOT EXISTS gold_holdings (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id         INT UNSIGNED NOT NULL UNIQUE,
  gold_type        ENUM('physical','etf','sgb','digital') NOT NULL,
  name             VARCHAR(255) NOT NULL,
  quantity         DECIMAL(15,4) NOT NULL,
  purchase_price   DECIMAL(12,4),
  purchase_date    DATE,

  -- physical / digital
  purity           ENUM('24k','22k','18k','999','995','916'),
  platform         VARCHAR(100),
  storage_location VARCHAR(255),

  -- etf
  ticker           VARCHAR(20),
  broker           VARCHAR(100),

  -- sgb
  sgb_series       VARCHAR(150),
  face_value       DECIMAL(12,4),
  issue_date       DATE,
  maturity_date    DATE,
  coupon_rate      DECIMAL(5,2) DEFAULT 2.50,

  -- price cache
  last_price       DECIMAL(12,4),
  last_price_date  DATE,

  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB;
