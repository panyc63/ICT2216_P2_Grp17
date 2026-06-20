import express from 'express';
import { dbPromise } from '../config/db.js';
import { ensureOpenOrder, getActiveOrder, patchOrderFields } from '../services/orderService.js';

const router = express.Router();

const normalize = (order) => ({
    ...order,
    needs_medication: order.needs_medication === null ? null : Boolean(order.needs_medication),
    consult_fee_paid: Boolean(order.consult_fee_paid),
    medication_fee_paid: Boolean(order.medication_fee_paid)
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

export default router;
