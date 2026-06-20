USE assetmgmt;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash  CHAR(64) PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  device_info VARCHAR(255),
  created_at  DATETIME DEFAULT NOW(),
  expires_at  DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;
