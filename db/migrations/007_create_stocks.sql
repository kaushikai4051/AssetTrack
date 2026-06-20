USE assetmgmt;

CREATE TABLE IF NOT EXISTS stock_holdings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id        INT UNSIGNED NOT NULL UNIQUE,
  ticker          VARCHAR(20) NOT NULL,
  company_name    VARCHAR(255) NOT NULL,
  exchange        ENUM('NSE','BSE','NASDAQ','NYSE','OTHER') DEFAULT 'NSE',
  sector          VARCHAR(100),
  isin            VARCHAR(20),
  broker          VARCHAR(100),
  shares_held     DECIMAL(15,4) DEFAULT 0.0000,
  avg_cost_price  DECIMAL(12,4) DEFAULT 0.0000,
  last_price      DECIMAL(12,4),
  last_price_date DATE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_ticker (ticker)
) ENGINE=InnoDB;

-- For split type: shares = split_ratio (e.g. 2 for 2-for-1), price = 0
-- For bonus type: price = 0
CREATE TABLE IF NOT EXISTS stock_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  holding_id       INT UNSIGNED NOT NULL,
  type             ENUM('buy','sell','bonus','split') NOT NULL,
  transaction_date DATE NOT NULL,
  shares           DECIMAL(15,4) NOT NULL,
  price            DECIMAL(12,4) DEFAULT 0.0000,
  amount           DECIMAL(15,2) DEFAULT 0.00,
  brokerage        DECIMAL(10,2) DEFAULT 0.00,
  notes            VARCHAR(500),
  FOREIGN KEY (holding_id) REFERENCES stock_holdings(id) ON DELETE CASCADE,
  INDEX idx_holding_date (holding_id, transaction_date)
) ENGINE=InnoDB;
