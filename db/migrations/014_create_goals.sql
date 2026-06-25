USE assetmgmt;

CREATE TABLE IF NOT EXISTS goals (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  name            VARCHAR(255) NOT NULL,
  goal_type       ENUM('retirement','education','home','car','vacation','emergency_fund','wedding','other') NOT NULL DEFAULT 'other',
  target_amount   DECIMAL(15,2) NOT NULL,
  target_date     DATE NOT NULL,
  assumed_return  DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  notes           TEXT,
  created_at      DATETIME DEFAULT NOW(),
  updated_at      DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_goals_user (user_id),
  INDEX idx_goals_type (goal_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS goal_assets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  goal_id    INT UNSIGNED NOT NULL,
  asset_id   INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_goal_asset (goal_id, asset_id),
  FOREIGN KEY (goal_id)  REFERENCES goals(id)  ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB;
