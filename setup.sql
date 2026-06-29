CREATE DATABASE IF NOT EXISTS mediflow_db;
USE mediflow_db;

DROP TRIGGER IF EXISTS prevent_security_audit_logs_update;
DROP TRIGGER IF EXISTS prevent_security_audit_logs_delete;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS medication_inventory;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS medical_certificates;
DROP TABLE IF EXISTS triage_submissions;
DROP TABLE IF EXISTS consultations;
DROP TABLE IF EXISTS security_audit_logs;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    user_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Patient', 'Nurse', 'Doctor', 'Admin', 'Pharmacist') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    status ENUM('PendingVerification', 'Active', 'Deactivated') NOT NULL DEFAULT 'PendingVerification',
    token_version INT NOT NULL DEFAULT 0,
    email_verification_hash VARCHAR(64) NULL,
    email_verification_expires_at TIMESTAMP NULL DEFAULT NULL,
    mfa_challenge_id VARCHAR(128) NULL,
    mfa_otp_hash VARCHAR(64) NULL,
    mfa_expires_at TIMESTAMP NULL DEFAULT NULL,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL DEFAULT NULL,
    -- Self-service profile (PHI fields are encrypted at the application layer)
    phone VARCHAR(30) NULL,
    address_encrypted TEXT NULL,
    nric_encrypted TEXT NULL,
    -- Password-reset (hashed, single-use, time-limited token)
    reset_token_hash VARCHAR(64) NULL,
    reset_expires_at TIMESTAMP NULL DEFAULT NULL,
    -- Per-doctor MC signing keypair (Ed25519). Private key is encrypted at rest.
    mc_public_key TEXT NULL,
    mc_private_key_encrypted TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT NULL,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_users_email_status (email, status),
    INDEX idx_users_role_status (role, status)
);

CREATE TABLE consultations (
    consultation_id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NULL,
    session_status ENUM('Pending', 'Active', 'Completed', 'Cancelled') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_consultations_patient (patient_id),
    INDEX idx_consultations_doctor (doctor_id)
);

CREATE TABLE triage_submissions (
    triage_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    answers_encrypted TEXT NOT NULL,
    priority_score ENUM('Routine', 'Urgent', 'Emergency') NOT NULL,
    assigned_doctor_id VARCHAR(36) NULL,
    status ENUM('Waiting', 'Called', 'InConsultation', 'Completed', 'Discharged') NOT NULL DEFAULT 'Waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_doctor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_triage_status_priority (status, priority_score, created_at)
);

CREATE TABLE payment_events (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    consultation_id VARCHAR(36) NULL,
    checkout_reference VARCHAR(80) NOT NULL UNIQUE,
    stripe_event_id VARCHAR(120) NULL UNIQUE,
    amount_cents INT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'SGD',
    status ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE SET NULL,
    INDEX idx_payment_patient_status (patient_id, status)
);

CREATE TABLE medication_inventory (
    medication_id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    form VARCHAR(80) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    unit_price_cents INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE prescriptions (
    prescription_id VARCHAR(50) PRIMARY KEY,
    consultation_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    medication_id VARCHAR(40) NULL,
    medication_name VARCHAR(120) NOT NULL,
    dosage VARCHAR(80) NOT NULL,
    frequency VARCHAR(80) NOT NULL,
    refills INT NOT NULL DEFAULT 0,
    instructions_encrypted TEXT NULL,
    status ENUM('Issued', 'Fulfilled', 'Cancelled') NOT NULL DEFAULT 'Issued',
    fulfilled_by VARCHAR(36) NULL,
    fulfilled_at TIMESTAMP NULL DEFAULT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medication_inventory(medication_id) ON DELETE SET NULL,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_prescriptions_patient (patient_id),
    INDEX idx_prescriptions_doctor (doctor_id)
);

CREATE TABLE medical_certificates (
    mc_id VARCHAR(60) PRIMARY KEY,
    consultation_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(36) NOT NULL,
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    diagnosis_encrypted TEXT NULL,
    qr_token_hash VARCHAR(64) NULL UNIQUE,
    signature_hash VARCHAR(64) NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_mc_patient (patient_id),
    INDEX idx_mc_doctor (doctor_id)
);

CREATE TABLE chat_messages (
    message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    consultation_id VARCHAR(36) NOT NULL,
    sender_id VARCHAR(36) NOT NULL,
    message_body_encrypted TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE RESTRICT,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_chat_consultation_sent (consultation_id, sent_at)
);

CREATE TABLE message_attachments (
    attachment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    consultation_id VARCHAR(36) NOT NULL,
    uploader_id VARCHAR(36) NOT NULL,
    filename VARCHAR(160) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT NOT NULL,
    malware_scan_status ENUM('PASSED_STUB', 'FAILED', 'PENDING') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE RESTRICT,
    FOREIGN KEY (uploader_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE security_audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id VARCHAR(36) NULL,
    action_performed VARCHAR(100) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(80) NULL,
    outcome ENUM('SUCCESS', 'FAILURE') NOT NULL,
    metadata_json JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    previous_hash CHAR(64) NOT NULL,
    entry_hash CHAR(64) NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_actor_time (actor_id, timestamp),
    INDEX idx_audit_action_time (action_performed, timestamp)
);

DELIMITER //
CREATE TRIGGER prevent_security_audit_logs_update
BEFORE UPDATE ON security_audit_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'security_audit_logs is append-only';
END//

CREATE TRIGGER prevent_security_audit_logs_delete
BEFORE DELETE ON security_audit_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'security_audit_logs is append-only';
END//
DELIMITER ;

INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, last_login) VALUES
('MH-U001', 'System Administrator', 'admin@mediflow.com', 'scrypt$16384$8$1$admin-seed-salt01$GOnOZV4v-lh6jU2TvUDOdpXSnlMd-QCLO22r6pGYFqC72EdtkQXWkx82z-xJ9rN2P7UvRATjMyhabgqx3s6a9Q', 'Admin', TRUE, 'Active', CURRENT_TIMESTAMP),
('MH-U002', 'Dr. Alex Rivera', 'doctor@mediflow.com', 'scrypt$16384$8$1$doctor-seed-salt1$ux84p6uNPYUfW6dNC47P17AxC6u0W7Hai_STCnhftKxlgLckC0kbLzt_OkQ989AjHwWbeJ61QsurvFZjKMJW3Q', 'Doctor', TRUE, 'Active', CURRENT_TIMESTAMP),
('MH-U003', 'Nurse Sarah Jenkins', 'nurse@mediflow.com', 'scrypt$16384$8$1$nurse-seed-salt01$Uvg01M3J0tUXPC5GSh5E-2LG287UKjX09eXomww7SRO6dwELNKHaHKHFDWzV6s_QJJjPdxCYddbsV_z_U_XiHw', 'Nurse', TRUE, 'Active', CURRENT_TIMESTAMP),
('MH-U004', 'Pharmacist David Vance', 'pharmacy@mediflow.com', 'scrypt$16384$8$1$pharm-seed-salt01$x-oR9dDVw3bJTcP134Jj3VT0Ntjmw2OINP4wy7Wjy3xKC0fLQacqYht4WdUUYalkH4BZo4hRKkx07pKfRCagdw', 'Pharmacist', TRUE, 'Active', CURRENT_TIMESTAMP),
('MH-U005', 'Jane Doe', 'jane@gmail.com', 'scrypt$16384$8$1$jane-seed-salt001$PPEtYF3U3hU19lkX40Gd7X12PIyaFlbm2yg7ZAAr6k-VZM5WirDUaHYgmbogECmFJjSJzvlYiJPf_IfN1zjO-Q', 'Patient', FALSE, 'PendingVerification', NULL),
('MH-U006', 'John Smith', 'john@gmail.com', 'scrypt$16384$8$1$john-seed-salt001$WgHLk8E45CFFGpKv_D9irMhv9zawYu3V2rSqSvaNnLGUAY0pOUXoUm1ZYzOox57KU5-haAXJZay7QuB9Y59rHg', 'Patient', TRUE, 'Active', CURRENT_TIMESTAMP);

INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status, completed_at) VALUES
('MH-C001', 'MH-U006', 'MH-U002', 'Completed', CURRENT_TIMESTAMP),
('MH-C002', 'MH-U005', 'MH-U002', 'Active', NULL);

INSERT INTO triage_submissions (patient_id, answers_encrypted, priority_score, assigned_doctor_id, status) VALUES
('MH-U006', '{"fever":"No","cough":"Yes","chestPain":"Mild","duration":"2 days"}', 'Routine', 'MH-U002', 'Completed'),
('MH-U005', '{"fever":"Yes","cough":"Yes","chestPain":"Moderate","duration":"1 day"}', 'Urgent', 'MH-U002', 'InConsultation');

INSERT INTO payment_events (patient_id, consultation_id, checkout_reference, amount_cents, currency, status, paid_at) VALUES
('MH-U006', 'MH-C001', 'MF-SEED-PAID-001', 7350, 'SGD', 'Paid', CURRENT_TIMESTAMP);

INSERT INTO medication_inventory (medication_id, name, form, stock_quantity, unit_price_cents) VALUES
('MED-AMOX500', 'Amoxicillin', 'Capsule 500mg', 120, 1500),
('MED-PARA500', 'Paracetamol', 'Tablet 500mg', 500, 400),
('MED-IBU400', 'Ibuprofen', 'Tablet 400mg', 0, 600),
('MED-LORA10', 'Loratadine', 'Tablet 10mg', 80, 900),
('MED-SALBINH', 'Salbutamol', 'Inhaler 100mcg', 35, 1200);

INSERT INTO medical_certificates
(mc_id, consultation_id, doctor_id, patient_id, issue_date, valid_until, diagnosis_encrypted, qr_token_hash, signature_hash, is_revoked)
VALUES
('MH-MC001', 'MH-C001', 'MH-U002', 'MH-U006', '2026-06-19', '2026-06-22', NULL, NULL, NULL, FALSE);

INSERT INTO security_audit_logs
(actor_id, action_performed, resource_type, resource_id, outcome, metadata_json, ip_address, user_agent, previous_hash, entry_hash)
VALUES
(NULL, 'DATABASE_SEED', 'SYSTEM', 'setup.sql', 'SUCCESS', JSON_OBJECT('standard', 'OWASP ASVS/NIST SSDF baseline'), '127.0.0.1', 'setup.sql', 'GENESIS', SHA2('GENESIS:DATABASE_SEED:setup.sql', 256));
