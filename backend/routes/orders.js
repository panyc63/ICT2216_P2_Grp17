import express from 'express';
import { dbPromise } from '../config/db.js';
import { ensureOpenOrder, getActiveOrder, patchOrderFields, setOrderStatus } from '../services/orderService.js';

const router = express.Router();

const normalize = (order) => ({
    ...order,
    needs_medication: order.needs_medication === null ? null : Boolean(order.needs_medication),
    consult_fee_paid: Boolean(order.consult_fee_paid),
    medication_fee_paid: Boolean(order.medication_fee_paid)
});

// Admin-allowed status transitions (from -> [to]). Terminal statuses
// (Completed/Refunded/Cancelled) intentionally have no outgoing transitions.
const ADMIN_TRANSITIONS = {
    Pending: ['PendingRefund', 'Cancelled'],
    InQueue: ['PendingRefund', 'Cancelled'],
    InCall: ['PendingRefund', 'Cancelled'],
    AwaitingFinalization: ['PendingRefund', 'Cancelled'],
    AwaitingPayment: ['PendingRefund', 'Cancelled'],
    AwaitingDelivery: ['Completed', 'PendingRefund', 'Cancelled'],
    PendingRefund: ['Refunded', 'Cancelled']
};
// A note is mandatory when closing an order as refunded or cancelled.
const NOTE_REQUIRED = ['Refunded', 'Cancelled'];

// GET /api/orders — all orders (optionally filtered by ?status=), newest first,
// with the patient's display name. For the admin Orders view.
router.get('/', async (req, res) => {
    const { status } = req.query;
    try {
        const where = status ? 'WHERE o.status = ?' : '';
        const params = status ? [status] : [];
        const [rows] = await dbPromise.query(
            `SELECT o.*, COALESCE(u.name, u.email) AS patient_name
             FROM orders o
             LEFT JOIN users u ON o.patient_id = u.user_id
             ${where}
             ORDER BY o.created_at DESC, o.order_id DESC`,
            params
        );
        res.status(200).json(rows.map(normalize));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/orders — create (or return the existing open) order for a patient.
// Idempotent: clicking "Start Consultation" twice won't spawn duplicate orders.
router.post('/', async (req, res) => {
    const { patient_id } = req.body;
    if (!patient_id) {
        return res.status(400).json({ error: 'patient_id is required.' });
    }
    try {
        const order = await ensureOpenOrder(patient_id);
        res.status(201).json(normalize(order));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/active/:patientId — the patient's current open order.
router.get('/active/:patientId', async (req, res) => {
    try {
        const order = await getActiveOrder(req.params.patientId);
        if (!order) {
            return res.status(404).json({ error: 'No active order for this patient.' });
        }
        res.status(200).json(normalize(order));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/latest/:patientId — the patient's most recent order of ANY
// status (incl. terminal). For post-flow pages (e.g. Closing) where the active
// lookup would 404 because the order is already Completed.
router.get('/latest/:patientId', async (req, res) => {
    try {
        const [rows] = await dbPromise.query(
            'SELECT * FROM orders WHERE patient_id = ? ORDER BY created_at DESC, order_id DESC LIMIT 1',
            [req.params.patientId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No order for this patient.' });
        }
        res.status(200).json(normalize(rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/orders/:id — update editable order fields (needs_medication /
// collection_method). Used by the Phase 2 frontend.
router.patch('/:id', async (req, res) => {
    const { needs_medication, collection_method } = req.body;
    if (collection_method !== undefined && !['self-collect', 'delivery'].includes(collection_method)) {
        return res.status(400).json({ error: 'collection_method must be self-collect or delivery.' });
    }
    try {
        await patchOrderFields(req.params.id, { needs_medication, collection_method });
        const [rows] = await dbPromise.query('SELECT * FROM orders WHERE order_id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }
        res.status(200).json(normalize(rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/:id/history — the status transition audit trail for an order.
router.get('/:id/history', async (req, res) => {
    try {
        const [rows] = await dbPromise.query(
            'SELECT history_id, status, note, changed_at FROM order_status_history WHERE order_id = ? ORDER BY history_id ASC',
            [req.params.id]
        );
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/orders/:id/status — admin status transition (refund/cancel close
// or mark delivered). Validated against ADMIN_TRANSITIONS; a note is required
// for Refunded/Cancelled. Written to order_status_history via setOrderStatus.
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'status is required.' });
    }
    if (NOTE_REQUIRED.includes(status) && (!note || !note.trim())) {
        return res.status(400).json({ error: `A note is required when setting status to ${status}.` });
    }

    try {
        const [rows] = await dbPromise.query('SELECT status FROM orders WHERE order_id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const current = rows[0].status;
        const allowed = ADMIN_TRANSITIONS[current] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Cannot transition from ${current} to ${status}.` });
        }

        await setOrderStatus(id, status, note && note.trim() ? note.trim() : null);

        const [updated] = await dbPromise.query('SELECT * FROM orders WHERE order_id = ?', [id]);
        res.status(200).json(normalize(updated[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
