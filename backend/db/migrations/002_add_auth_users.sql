-- Select the target database before running this migration.
CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_users_email (email),
  KEY idx_app_users_role_active (role, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_setup_lock (
  id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  CHECK (id = 1)
) ENGINE=InnoDB;

INSERT IGNORE INTO auth_setup_lock (id) VALUES (1);
