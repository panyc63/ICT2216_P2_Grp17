import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { dbPromise } from '../config/db.js';
import { FEES } from '../config/fees.js';
import { markConsultFeePaid, markMedicationFeePaid } from '../services/orderService.js';
import { nextSeqId } from '../services/ids.js';
import { logAudit } from '../services/audit.js';

dotenv.config(); // matches db.js / firebase.js — ensures env is loaded at import time

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /api/payments/fees — server-side authoritative amounts (SGD, in cents).
// The payment pages read prices from here; the client is never trusted for them.
router.get('/fees', (req, res) => {
    res.status(200).json(FEES);
});

// POST /api/payments/consult/checkout — creates a Stripe Checkout Session for
// the consultation fee and returns its hosted-page URL. The amount comes only
// from config/fees.js (never the client). order_id + fee_type are attached as
// metadata so the webhook can mark the right order paid.
router.post('/consult/checkout', async (req, res) => {
    const { order_id } = req.body;
    if (!order_id) {
        return res.status(400).json({ error: 'order_id is required.' });
    }

    try {
        const [rows] = await dbPromise.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }
        // Already paid (e.g. webhook landed before a re-click) — skip Stripe.
        if (rows[0].consult_fee_paid) {
            return res.status(200).json({ already_paid: true, url: null });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: FEES.currency,
                    product_data: { name: 'Consultation Fee' },
                    unit_amount: FEES.consult.amount_cents
                },
                quantity: 1
            }],
            metadata: { order_id, fee_type: 'consult' },
            success_url: `${FRONTEND_URL}/patient/consult-payment?status=success`,
            cancel_url: `${FRONTEND_URL}/patient/consult-payment?status=cancelled`
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payments/medication/checkout — creates a Stripe Checkout Session for
// the medication fee (Path B, after the doctor finalizes). Same pattern as the
// consult checkout; the webhook marks the order paid and advances it to
// AwaitingDelivery. Amount comes only from config/fees.js.
router.post('/medication/checkout', async (req, res) => {
    const { order_id } = req.body;
    if (!order_id) {
        return res.status(400).json({ error: 'order_id is required.' });
    }

    try {
        const [rows] = await dbPromise.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }
        if (!rows[0].needs_medication) {
            return res.status(400).json({ error: 'This order has no medication to pay for.' });
        }
        // Already paid (e.g. webhook landed before a re-click) — skip Stripe.
        if (rows[0].medication_fee_paid) {
            return res.status(200).json({ already_paid: true, url: null });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: FEES.currency,
                    product_data: { name: 'Medication Fee' },
                    unit_amount: FEES.medication.amount_cents
                },
                quantity: 1
            }],
            metadata: { order_id, fee_type: 'medication' },
            success_url: `${FRONTEND_URL}/patient/medication-payment?status=success`,
            cancel_url: `${FRONTEND_URL}/patient/medication-payment?status=cancelled`
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Ad-hoc payment requests ────────────────────────────────────────────────
// Standalone charges raised by a doctor/admin, decoupled from the orders
// lifecycle (own payment_requests table). The amount is set at creation and read
// back from the DB at pay time — never trusted from the client at checkout.

// POST /api/payments/requests — create a request. Body:
// { patient_id, requested_by, description, amount_cents }.
router.post('/requests', async (req, res) => {
    const { patient_id, requested_by, description, amount_cents } = req.body;
    const amount = Number(amount_cents);

    if (!patient_id || !requested_by || !description || !description.trim()) {
        return res.status(400).json({ error: 'patient_id, requested_by and description are required.' });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'amount_cents must be a positive whole number.' });
    }

    try {
        const [prows] = await dbPromise.query('SELECT user_id FROM users WHERE user_id = ?', [patient_id]);
        if (prows.length === 0) {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        const id = await nextSeqId('payment_requests', 'payment_request_id', 'MH-PR');
        await dbPromise.query(
            `INSERT INTO payment_requests
                (payment_request_id, patient_id, requested_by, description, amount_cents, currency, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [id, patient_id, requested_by, description.trim(), amount, FEES.currency]
        );

        await logAudit(requested_by, 'CREATE_PAYMENT_REQUEST', id);

        const [rows] = await dbPromise.query('SELECT * FROM payment_requests WHERE payment_request_id = ?', [id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payments/requests — all requests (admin oversight), newest first.
router.get('/requests', async (req, res) => {
    try {
        const [rows] = await dbPromise.query(
            `SELECT pr.*, COALESCE(p.name, p.email) AS patient_name
             FROM payment_requests pr
             LEFT JOIN users p ON pr.patient_id = p.user_id
             ORDER BY pr.created_at DESC, pr.payment_request_id DESC`
        );
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payments/requests/patient/:patientId — one patient's requests.
router.get('/requests/patient/:patientId', async (req, res) => {
    try {
        const [rows] = await dbPromise.query(
            'SELECT * FROM payment_requests WHERE patient_id = ? ORDER BY created_at DESC, payment_request_id DESC',
            [req.params.patientId]
        );
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payments/requests/:id/checkout — Stripe Checkout for a request. The
// amount is read from the DB row (server-authoritative), not the client.
router.post('/requests/:id/checkout', async (req, res) => {
    try {
        const [rows] = await dbPromise.query('SELECT * FROM payment_requests WHERE payment_request_id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Payment request not found.' });
        }
        const pr = rows[0];
        if (pr.status === 'Paid') {
            return res.status(200).json({ already_paid: true, url: null });
        }
        if (pr.status === 'Cancelled') {
            return res.status(400).json({ error: 'This payment request has been cancelled.' });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: pr.currency || FEES.currency,
                    product_data: { name: pr.description },
                    unit_amount: pr.amount_cents
                },
                quantity: 1
            }],
            metadata: { type: 'payment_request', payment_request_id: pr.payment_request_id },
            success_url: `${FRONTEND_URL}/patient/pending-charges?status=success`,
            cancel_url: `${FRONTEND_URL}/patient/pending-charges?status=cancelled`
        });

        await dbPromise.query('UPDATE payment_requests SET stripe_session_id = ? WHERE payment_request_id = ?', [session.id, pr.payment_request_id]);

        res.status(200).json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payments/webhook — Stripe payment confirmation. This is the SOURCE
// OF TRUTH for paid status: flags are set here, server-side, only after the
// signature is verified. The client success redirect is never trusted.
// Mounted with express.raw in server.js so req.body is the raw bytes Stripe needs.
router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const meta = event.data.object.metadata || {};
            const { order_id, fee_type } = meta;
            // Idempotent: Stripe retries webhooks. Only mark + write history if
            // not already paid, so retries don't duplicate history rows or
            // re-run the status transition.
            if (order_id && fee_type === 'consult') {
                const [rows] = await dbPromise.query('SELECT consult_fee_paid FROM orders WHERE order_id = ?', [order_id]);
                if (rows.length && !rows[0].consult_fee_paid) {
                    await markConsultFeePaid(order_id);
                }
            } else if (order_id && fee_type === 'medication') {
                const [rows] = await dbPromise.query('SELECT medication_fee_paid FROM orders WHERE order_id = ?', [order_id]);
                if (rows.length && !rows[0].medication_fee_paid) {
                    await markMedicationFeePaid(order_id); // sets flag + AwaitingPayment→AwaitingDelivery
                }
            } else if (meta.type === 'payment_request' && meta.payment_request_id) {
                const [rows] = await dbPromise.query('SELECT status FROM payment_requests WHERE payment_request_id = ?', [meta.payment_request_id]);
                if (rows.length && rows[0].status !== 'Paid') {
                    await dbPromise.query(
                        "UPDATE payment_requests SET status = 'Paid', paid_at = NOW() WHERE payment_request_id = ?",
                        [meta.payment_request_id]
                    );
                }
            }
        }
    } catch (err) {
        // Log-and-ack: a processing error shouldn't make Stripe retry forever for
        // a prototype. (Stripe still has the event for manual replay.)
        console.error('Webhook processing error:', err.message);
    }

    res.status(200).json({ received: true });
});

export default router;
