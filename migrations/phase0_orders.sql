-- Phase 0 — Orders data-model restructure (schema only, no behavior change)
-- Introduces the `orders` lifecycle record + `order_status_history`, links
-- consultations to an order, and backfills existing consultations into orders.
-- Idempotent-ish: safe to run once on an existing mediflow_db. The application
-- still reads needs_medication / collection_method from `consultations` until a
-- later phase migrates those reads (dual-source during migration).

USE mediflow_db;

-- 1. Orders: the full patient-journey record with an explicit status lifecycle.
CREATE TABLE IF NOT EXISTS orders (
    order_id            VARCHAR(36) PRIMARY KEY,          -- MH-O001, ...
    patient_id          VARCHAR(36),
    consultation_id     VARCHAR(36) DEFAULT NULL,         -- null until a doctor accepts
    status ENUM('Pending','PendingRefund','Refunded','Cancelled',
                'InQueue','InCall','AwaitingFinalization',
                'AwaitingPayment','AwaitingDelivery','Completed') NOT NULL DEFAULT 'Pending',
    needs_medication    BOOLEAN DEFAULT NULL,
    collection_method   VARCHAR(20) DEFAULT NULL,
    consult_fee_paid    BOOLEAN DEFAULT FALSE,
    medication_fee_paid BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id)      REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE SET NULL
);

-- 2. Append-only audit trail of order status transitions.
CREATE TABLE IF NOT EXISTS order_status_history (
    history_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id    VARCHAR(36),
    status      VARCHAR(30) NOT NULL,
    note        VARCHAR(255) DEFAULT NULL,
    changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- 3. Back-link consultations -> orders. Column first, then FK (bidirectional
--    relationship means it can't be created inline before `orders` exists).
ALTER TABLE consultations ADD COLUMN order_id VARCHAR(36) DEFAULT NULL;
ALTER TABLE consultations
    ADD CONSTRAINT fk_consultations_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL;

-- 4. Backfill: one order per existing consultation.
--    Status map: Completed->Completed, Active->InCall, Pending->Pending.
--    consult_fee_paid = TRUE for any row that reached a consultation.
INSERT INTO orders (order_id, patient_id, consultation_id, status, needs_medication, collection_method, consult_fee_paid, medication_fee_paid)
SELECT CONCAT('MH-O', LPAD(ROW_NUMBER() OVER (ORDER BY c.consultation_id), 3, '0')),
       c.patient_id,
       c.consultation_id,
       CASE c.session_status
            WHEN 'Completed' THEN 'Completed'
            WHEN 'Active'    THEN 'InCall'
            ELSE 'Pending'
       END,
       c.needs_medication,
       c.collection_method,
       CASE WHEN c.session_status IN ('Completed','Active') THEN TRUE ELSE FALSE END,
       FALSE
FROM consultations c
WHERE c.order_id IS NULL
ORDER BY c.consultation_id;

-- Link each consultation back to its new order.
UPDATE consultations c
JOIN orders o ON o.consultation_id = c.consultation_id
SET c.order_id = o.order_id
WHERE c.order_id IS NULL;

-- Seed the history with the backfilled status for each new order.
INSERT INTO order_status_history (order_id, status, note)
SELECT order_id, status, 'Backfilled from existing consultation'
FROM orders;
