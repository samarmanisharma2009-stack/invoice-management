-- Invoice Management System - Database Schema
-- Run: mysql -u root -p invoice_management < schema.sql

CREATE TABLE IF NOT EXISTS users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    full_name           VARCHAR(150)  NOT NULL,
    email               VARCHAR(190)  NOT NULL UNIQUE,
    phone               VARCHAR(30)   NULL,
    organization_name   VARCHAR(190)  NULL,
    verification_note   TEXT          NULL,
    password_hash       VARCHAR(255)  NOT NULL,
    role                ENUM('admin','user') NOT NULL DEFAULT 'user',
    status              ENUM('pending','approved','rejected','revoked') NOT NULL DEFAULT 'pending',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_status (status),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(190) NOT NULL,
    email       VARCHAR(190) NULL,
    phone       VARCHAR(30)  NULL,
    address     TEXT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_customers_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    customer_id     INT NOT NULL,
    invoice_number  VARCHAR(40) NOT NULL UNIQUE,
    invoice_date    DATE NOT NULL,
    due_date        DATE NULL,
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status          ENUM('Draft','Pending','Paid','Cancelled') NOT NULL DEFAULT 'Draft',
    notes           TEXT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_invoices_user (user_id),
    INDEX idx_invoices_customer (customer_id),
    INDEX idx_invoices_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id    INT NOT NULL,
    description   VARCHAR(255) NOT NULL,
    quantity      DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_price    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_rate      DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    line_total    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_items_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sequence table to generate strictly-increasing invoice numbers per year
CREATE TABLE IF NOT EXISTS invoice_number_seq (
    year_key    INT PRIMARY KEY,
    last_value  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
