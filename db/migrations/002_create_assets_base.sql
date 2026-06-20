USE assetmgmt;

CREATE TABLE IF NOT EXISTS assets (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL,
  family_member_id INT UNSIGNED,
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
  asset_name       VARCHAR(255) NOT NULL,
  currency         CHAR(3) DEFAULT 'INR',
  current_value    DECIMAL(15,2) DEFAULT 0.00,
  invested_amount  DECIMAL(15,2) DEFAULT 0.00,
  notes            TEXT,
  is_active        TINYINT(1) DEFAULT 1,
  created_at       DATETIME DEFAULT NOW(),
  updated_at       DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL,
  INDEX idx_user_type (user_id, asset_type),
  INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB;
