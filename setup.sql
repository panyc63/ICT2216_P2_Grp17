CREATE DATABASE IF NOT EXISTS mediflow_db;
USE mediflow_db;

-- DELETE OLD TABLE
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS security_audit_logs;
DROP TABLE IF EXISTS medical_certificates;
DROP TABLE IF EXISTS consultations;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- users Table
CREATE TABLE users (
    user_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Patient', 'Nurse', 'Doctor', 'Admin', 'Pharmacist') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT NULL
);

-- consultations Table
CREATE TABLE consultations (
    consultation_id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    doctor_id VARCHAR(36),
    session_status ENUM('Pending', 'Active', 'Completed') NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- medical_certificates Table
CREATE TABLE medical_certificates (
    mc_id VARCHAR(36) PRIMARY KEY,
    consultation_id VARCHAR(36),
    doctor_id VARCHAR(36),
    patient_id VARCHAR(36),
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- security_audit_logs Table
CREATE TABLE security_audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id VARCHAR(36) NOT NULL,
    action_performed VARCHAR(100) NOT NULL,
    affected_resource VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    outcome ENUM('SUCCESS', 'FAILURE') NOT NULL
);

-- FAKE DATA
INSERT INTO users (user_id, name, email, password_hash, role, is_verified, last_login) VALUES
('MH-U001', 'System Administrator', 'admin@mediflow.com', '1234', 'Admin', TRUE, CURRENT_TIMESTAMP),
('MH-U002', 'Dr. Alex Rivera', 'doctor@mediflow.com', '1234', 'Doctor', TRUE, CURRENT_TIMESTAMP),
('MH-U003', 'Nurse Sarah Jenkins', 'nurse@mediflow.com', '1234', 'Nurse', TRUE, CURRENT_TIMESTAMP),
('MH-U004', 'Pharmacist David Vance', 'pharmacy@mediflow.com', '1234', 'Pharmacist', TRUE, CURRENT_TIMESTAMP),
('MH-U005', 'Jane Doe', 'jane@gmail.com', '1234', 'Patient', FALSE, NULL),
('MH-U006', 'John Smith', 'john@gmail.com', '1234', 'Patient', TRUE, CURRENT_TIMESTAMP);

INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status) VALUES
('MH-C001', 'MH-U006', 'MH-U002', 'Completed'),
('MH-C002', 'MH-U005', 'MH-U002', 'Active');

INSERT INTO medical_certificates (mc_id, consultation_id, doctor_id, patient_id, issue_date, valid_until, is_revoked) VALUES
('MH-MC001', 'MH-C001', 'MH-U002', 'MH-U006', '2026-06-19', '2026-06-22', FALSE);