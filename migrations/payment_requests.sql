-- Migration: ad-hoc payment requests (standalone charges raised by a
-- doctor/admin, outside the normal consult/medication fee flow). Decoupled from
-- the orders lifecycle. Safe to run against an existing database.
USE mediflow_db;

CREATE TABLE IF NOT EXISTS payment_requests (
    payment_request_id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    requested_by VARCHAR(36),
    description VARCHAR(255) NOT NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'sgd',
    status ENUM('Pending', 'Paid', 'Cancelled') NOT NULL DEFAULT 'Pending',
    stripe_session_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL
);
