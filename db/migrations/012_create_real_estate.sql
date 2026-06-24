USE assetmgmt;

CREATE TABLE IF NOT EXISTS properties (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id            INT UNSIGNED NOT NULL UNIQUE,
  property_type       ENUM('flat','villa','plot','commercial','reit') NOT NULL,
  property_name       VARCHAR(255) NOT NULL,
  address             TEXT,
  purchase_date       DATE NOT NULL,
  purchase_price      DECIMAL(15,2) NOT NULL,
  registration_charges DECIMAL(15,2) DEFAULT 0,
  stamp_duty          DECIMAL(15,2) DEFAULT 0,
  current_value       DECIMAL(15,2),
  -- Rental income
  is_rented           TINYINT(1) DEFAULT 0,
  monthly_rent        DECIMAL(15,2),
  tenant_name         VARCHAR(255),
  lease_start_date    DATE,
  lease_end_date      DATE,
  -- Co-ownership
  ownership_percent   DECIMAL(5,2) DEFAULT 100.00,
  co_owner_name       VARCHAR(255),
  -- REIT specific
  units               DECIMAL(12,4),
  buy_price_per_unit  DECIMAL(15,2),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_type (property_type)
) ENGINE=InnoDB;
