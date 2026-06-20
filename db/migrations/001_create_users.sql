-- Run this first: creates the database and core user tables
-- Usage: mysql -u root -p < db/migrations/001_create_users.sql

CREATE DATABASE IF NOT EXISTS assetmgmt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE assetmgmt;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  mobile        VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  is_verified   TINYINT(1) DEFAULT 0,
  is_active     TINYINT(1) DEFAULT 1,
  totp_secret   VARCHAR(255),
  created_at    DATETIME DEFAULT NOW(),
  updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       INT UNSIGNED PRIMARY KEY,
  full_name     VARCHAR(255) NOT NULL,
  pan           VARCHAR(10),
  dob           DATE,
  risk_profile  ENUM('conservative','moderate','aggressive'),
  avatar_url    VARCHAR(512),
  base_currency CHAR(3) DEFAULT 'INR',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS family_members (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  relation      ENUM('self','spouse','child','parent','sibling','other') NOT NULL,
  dob           DATE,
  pan           VARCHAR(10),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id    INT UNSIGNED PRIMARY KEY,
  plan       ENUM('free','pro','family') DEFAULT 'free',
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
