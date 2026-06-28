CREATE TABLE IF NOT EXISTS documents (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  asset_type   VARCHAR(50),
  asset_id     INT,
  file_name    VARCHAR(255)  NOT NULL,
  stored_name  VARCHAR(255)  NOT NULL UNIQUE,
  mime_type    VARCHAR(100)  NOT NULL,
  size_bytes   INT           NOT NULL DEFAULT 0,
  expires_at   DATE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
