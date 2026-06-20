CREATE DATABASE IF NOT EXISTS mediflow_db;
USE mediflow_db;

-- users
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Patient', 'Nurse', 'Doctor', 'Admin', 'Pharmacist') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    home_address VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT NULL
);

-- consultations
CREATE TABLE IF NOT EXISTS consultations (
    consultation_id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    doctor_id VARCHAR(36),
    session_status ENUM('Pending', 'Active', 'Completed') NOT NULL,
    needs_medication BOOLEAN DEFAULT NULL,
    collection_method VARCHAR(20) DEFAULT NULL,
    order_id VARCHAR(36) DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- orders (full patient-journey lifecycle record, separate from the clinical
-- consultation). Created when the patient starts a consultation.
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    consultation_id VARCHAR(36) DEFAULT NULL,
    status ENUM('Pending', 'PendingRefund', 'Refunded', 'Cancelled',
                'InQueue', 'InCall', 'AwaitingFinalization',
                'AwaitingPayment', 'AwaitingDelivery', 'Completed') NOT NULL DEFAULT 'Pending',
    needs_medication BOOLEAN DEFAULT NULL,
    collection_method VARCHAR(20) DEFAULT NULL,
    consult_fee_paid BOOLEAN DEFAULT FALSE,
    medication_fee_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE SET NULL
);

-- order_status_history (append-only audit trail of order status transitions)
CREATE TABLE IF NOT EXISTS order_status_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36),
    status VARCHAR(30) NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Back-link consultations -> orders (added after orders exists; the
-- relationship is bidirectional so it can't be inline above).
ALTER TABLE consultations
    ADD CONSTRAINT fk_consultations_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL;

-- prescriptions (one row per medication line; a consultation can have several)
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id VARCHAR(36) PRIMARY KEY,
    consultation_id VARCHAR(36),
    patient_id VARCHAR(36),
    doctor_id VARCHAR(36),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(255),
    instructions VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- medical_certificates
CREATE TABLE IF NOT EXISTS medical_certificates (
    mc_id VARCHAR(36) PRIMARY KEY,
    consultation_id VARCHAR(36),
    doctor_id VARCHAR(36),
    patient_id VARCHAR(36),
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    diagnosis VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- security_audit_logs
CREATE TABLE IF NOT EXISTS security_audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id VARCHAR(36) NOT NULL,
    action_performed VARCHAR(100) NOT NULL,
    affected_resource VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    outcome ENUM('SUCCESS', 'FAILURE') NOT NULL
);

-- FAKE DATA INSERT
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE security_audit_logs;
TRUNCATE TABLE order_status_history;
TRUNCATE TABLE orders;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE medical_certificates;
TRUNCATE TABLE consultations;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;


INSERT INTO users (user_id, email, name, password_hash, role, is_verified, home_address, last_login) VALUES
('MH-U001', 'admin@mediflow.com', 'Alex Lim', '1234', 'Admin', TRUE, NULL, CURRENT_TIMESTAMP),
('MH-U002', 'doctor@mediflow.com', 'Dr. Emily Wong', '1234', 'Doctor', TRUE, NULL, CURRENT_TIMESTAMP),
('MH-U003', 'nurse@mediflow.com', 'Clara Oswald', '1234', 'Nurse', TRUE, NULL, CURRENT_TIMESTAMP),
('MH-U004', 'pharmacy@mediflow.com', 'Raj Kumar', '1234', 'Pharmacist', TRUE, NULL, CURRENT_TIMESTAMP),
('MH-U005', 'jane@gmail.com', 'Jane Lee', '1234', 'Patient', FALSE, '88 Clementi Ave 3, #12-05, Singapore 120088', NULL),
('MH-U006', 'john@gmail.com', 'John Tan', '1234', 'Patient', TRUE, '123 Bukit Timah Road, #08-21, Singapore 589456', CURRENT_TIMESTAMP);

INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status) VALUES
('MH-C001', 'MH-U004', 'MH-U002', 'Completed'),
('MH-C002', 'MH-U005', 'MH-U002', 'Active');

-- Orders backfilled from the seed consultations (mirrors phase0_orders.sql).
INSERT INTO orders (order_id, patient_id, consultation_id, status, needs_medication, collection_method, consult_fee_paid, medication_fee_paid) VALUES
('MH-O001', 'MH-U004', 'MH-C001', 'Completed', NULL, NULL, TRUE, FALSE),
('MH-O002', 'MH-U005', 'MH-C002', 'InCall', NULL, NULL, TRUE, FALSE);

UPDATE consultations SET order_id = 'MH-O001' WHERE consultation_id = 'MH-C001';
UPDATE consultations SET order_id = 'MH-O002' WHERE consultation_id = 'MH-C002';

INSERT INTO order_status_history (order_id, status, note) VALUES
('MH-O001', 'Completed', 'Backfilled from existing consultation'),
('MH-O002', 'InCall', 'Backfilled from existing consultation');

INSERT INTO medical_certificates (mc_id, consultation_id, doctor_id, patient_id, issue_date, valid_until, is_revoked) VALUES
('MH-MC001', 'MH-C001', 'MH-U002', 'MH-U006', '2026-06-19', '2026-06-22', FALSE);