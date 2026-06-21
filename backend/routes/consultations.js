import express from 'express';
import { db as rtdb } from '../config/firebase.js';
import { dbPromise } from '../config/db.js';
import { ensureOpenOrder, setOrderStatus, findOrderByConsultation } from '../services/orderService.js';
import { nextSeqId } from '../services/ids.js';

const router = express.Router();

const QUEUE_REF = 'active_queues';
const ROOMS_REF = 'rooms';

// Higher weight is served first; ties broken by who joined earliest.
const PRIORITY_WEIGHT = {
    emergency: 3,
    urgent: 2,
    normal: 1
};

const getWeight = (priorityScore) => PRIORITY_WEIGHT[priorityScore] || PRIORITY_WEIGHT.normal;

// Ordered queue of patients NOT yet accepted (no room_id assigned).
const getWaitingQueue = async () => {
    const snapshot = await rtdb.ref(QUEUE_REF).once('value');
    const queue = snapshot.val() || {};

    return Object.entries(queue)
        .map(([key, value]) => ({ key, ...value }))
        .filter((entry) => !entry.room_id)
        .sort((a, b) => {
            const weightDiff = getWeight(b.priority_score) - getWeight(a.priority_score);
            if (weightDiff !== 0) return weightDiff;
            return a.timestamp - b.timestamp;
        });
};

// Generates the next sequential consultation id (MH-C001, MH-C002, ...).
const nextConsultationId = async () => {
    const [rows] = await dbPromise.query(
        "SELECT consultation_id FROM consultations WHERE consultation_id LIKE 'MH-C%' ORDER BY consultation_id DESC LIMIT 1"
    );

    if (rows.length === 0) return 'MH-C001';

    const lastNum = parseInt(rows[0].consultation_id.replace('MH-C', ''), 10);
    return `MH-C${String(lastNum + 1).padStart(3, '0')}`;
};

// Removes the WebRTC signaling node and releases the patient's queue entry for a
// room. Used both when a call ends and when a consultation is finalized.
const teardownRoomAndQueue = async (id) => {
    const snapshot = await rtdb.ref(QUEUE_REF)
        .orderByChild('room_id')
        .equalTo(id)
        .once('value');

    const updates = {};
    snapshot.forEach((child) => {
        updates[child.key] = null;
    });
    if (Object.keys(updates).length > 0) {
        await rtdb.ref(QUEUE_REF).update(updates);
    }
    await rtdb.ref(`${ROOMS_REF}/${id}`).remove();
};

// POST /api/consultations/accept — doctor claims a patient and opens a room.
// Body: { doctor_id, patient_id? }. Without patient_id, the front of the queue
// is taken. consultation_id doubles as the WebRTC room id.
router.post('/accept', async (req, res) => {
    const { doctor_id, patient_id } = req.body;

    if (!doctor_id) {
        return res.status(400).json({ error: 'doctor_id is required.' });
    }

    try {
        // Locate the target queue entry (specific patient or front of queue).
        let entry;
        if (patient_id) {
            const snapshot = await rtdb.ref(QUEUE_REF)
                .orderByChild('patient_id')
                .equalTo(patient_id)
                .once('value');

            if (!snapshot.exists()) {
                return res.status(404).json({ error: 'Patient is not in the queue.' });
            }
            snapshot.forEach((child) => {
                entry = { key: child.key, ...child.val() };
            });
        } else {
            const waiting = await getWaitingQueue();
            if (waiting.length === 0) {
                return res.status(404).json({ error: 'The queue is empty.' });
            }
            entry = waiting[0];
        }

        if (entry.room_id) {
            return res.status(409).json({ error: 'Patient is already in a consultation.', room_id: entry.room_id });
        }

        const consultationId = await nextConsultationId();

        // The order is the source of truth for the Path A/B declaration. Use the
        // order linked at join time, falling back to find-or-create.
        let order;
        if (entry.order_id) {
            const [orows] = await dbPromise.query('SELECT * FROM orders WHERE order_id = ?', [entry.order_id]);
            order = orows[0];
        }
        if (!order) {
            order = await ensureOpenOrder(entry.patient_id, { needs_medication: entry.needs_medication });
        }
        const orderId = order.order_id;
        const needsMedication = order.needs_medication === null ? null : Boolean(order.needs_medication);

        // Persist the consultation, linked to its order. needs_medication is
        // dual-written onto the consultation for the not-yet-migrated frontend.
        await dbPromise.query(
            'INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status, needs_medication, order_id) VALUES (?, ?, ?, ?, ?, ?)',
            [consultationId, entry.patient_id, doctor_id, 'Active', needsMedication, orderId]
        );

        // Link order -> consultation and advance the lifecycle to InCall.
        await dbPromise.query('UPDATE orders SET consultation_id = ? WHERE order_id = ?', [consultationId, orderId]);
        await setOrderStatus(orderId, 'InCall', 'Consultation started');

        // Stamp the room id onto the patient's queue entry so their status
        // poll picks it up and routes them into the call.
        await rtdb.ref(`${QUEUE_REF}/${entry.key}`).update({
            room_id: consultationId,
            doctor_id
        });

        res.status(201).json({
            room_id: consultationId,
            consultation_id: consultationId,
            patient_id: entry.patient_id,
            doctor_id,
            order_id: orderId,
            needs_medication: needsMedication
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/consultations/active/:patientId — the patient's most recent
// consultation. Lets the frontend recover the Path A/B branch (needs_medication)
// after a refresh, since the queue entry is gone once the call completes.
router.get('/active/:patientId', async (req, res) => {
    const { patientId } = req.params;

    try {
        const [rows] = await dbPromise.query(
            'SELECT consultation_id, doctor_id, session_status, needs_medication FROM consultations WHERE patient_id = ? ORDER BY consultation_id DESC LIMIT 1',
            [patientId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No consultation found for this patient.' });
        }

        // MySQL returns TINYINT (0/1/null) for BOOLEAN; normalize to bool/null.
        const row = rows[0];
        res.status(200).json({
            consultation_id: row.consultation_id,
            doctor_id: row.doctor_id,
            session_status: row.session_status,
            needs_medication: row.needs_medication === null ? null : Boolean(row.needs_medication)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/consultations/:id/end — end the call: tear down signaling and
// release the patient from the queue. Does NOT mark the consultation Completed
// (that happens at finalize). Used on Hang Up so the patient is freed promptly.
router.post('/:id/end', async (req, res) => {
    const { id } = req.params;
    try {
        await teardownRoomAndQueue(id);

        // Advance the order to AwaitingFinalization (call done, doctor still to
        // write the clinical record). Guard against double-firing.
        const order = await findOrderByConsultation(id);
        if (order && order.status === 'InCall') {
            await setOrderStatus(order.order_id, 'AwaitingFinalization', 'Call ended');
        }

        res.status(200).json({ message: 'Call ended.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/consultations/:id/finalize — doctor writes the clinical record:
// always issues a Medical Certificate (diagnosis + validity); adds prescription
// lines when provided; marks the consultation Completed; cleans up the room.
router.post('/:id/finalize', async (req, res) => {
    const { id } = req.params;
    const { diagnosis, valid_until, prescription_items } = req.body;

    if (!diagnosis || !valid_until) {
        return res.status(400).json({ error: 'diagnosis and valid_until are required.' });
    }

    try {
        const [crows] = await dbPromise.query(
            'SELECT consultation_id, patient_id, doctor_id, session_status FROM consultations WHERE consultation_id = ?',
            [id]
        );
        if (crows.length === 0) {
            return res.status(404).json({ error: 'Consultation not found.' });
        }
        const con = crows[0];

        // Guard against double-finalize: once Completed, the MC/prescriptions are
        // already issued and the order has moved on. Re-running would duplicate
        // the MC. (Finalize can now be triggered from Admin Orders at any time.)
        if (con.session_status === 'Completed') {
            return res.status(409).json({ error: 'This consultation has already been finalized.' });
        }

        // Always issue a Medical Certificate.
        const mcId = await nextSeqId('medical_certificates', 'mc_id', 'MH-MC');
        await dbPromise.query(
            `INSERT INTO medical_certificates
                (mc_id, consultation_id, doctor_id, patient_id, issue_date, valid_until, is_revoked, diagnosis)
             VALUES (?, ?, ?, ?, CURDATE(), ?, 0, ?)`,
            [mcId, id, con.doctor_id, con.patient_id, valid_until, diagnosis]
        );

        // Add prescription lines (skip blank rows).
        const items = Array.isArray(prescription_items)
            ? prescription_items.filter((it) => it && typeof it.medication_name === 'string' && it.medication_name.trim())
            : [];
        let created = 0;
        for (const it of items) {
            const rxId = await nextSeqId('prescriptions', 'prescription_id', 'MH-RX');
            await dbPromise.query(
                `INSERT INTO prescriptions
                    (prescription_id, consultation_id, patient_id, doctor_id, medication_name, dosage, instructions)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [rxId, id, con.patient_id, con.doctor_id, it.medication_name.trim(), (it.dosage || '').trim(), (it.instructions || '').trim()]
            );
            created += 1;
        }

        await dbPromise.query(
            "UPDATE consultations SET session_status = 'Completed' WHERE consultation_id = ?",
            [id]
        );

        // Advance the order: Path A (no medication) is done; Path B still owes
        // the medication fee. needs_medication comes from the order.
        const order = await findOrderByConsultation(id);
        if (order) {
            const needsMed = Boolean(order.needs_medication);
            const nextStatus = needsMed ? 'AwaitingPayment' : 'Completed';
            await setOrderStatus(order.order_id, nextStatus, 'Consultation finalized');
        }

        // Best-effort cleanup in case the call wasn't already ended.
        await teardownRoomAndQueue(id);

        res.status(200).json({ message: 'Consultation finalized.', mc_id: mcId, prescriptions_created: created });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/consultations/:id/collection-method — patient's self-collect/
// delivery choice for the prescribed medication.
router.patch('/:id/collection-method', async (req, res) => {
    const { id } = req.params;
    const { collection_method } = req.body;

    if (!['self-collect', 'delivery'].includes(collection_method)) {
        return res.status(400).json({ error: 'collection_method must be self-collect or delivery.' });
    }

    try {
        const [result] = await dbPromise.query(
            'UPDATE consultations SET collection_method = ? WHERE consultation_id = ?',
            [collection_method, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Consultation not found.' });
        }

        // Dual-write to the order (the source of truth going forward).
        const order = await findOrderByConsultation(id);
        if (order) {
            await dbPromise.query('UPDATE orders SET collection_method = ? WHERE order_id = ?', [collection_method, order.order_id]);
        }

        res.status(200).json({ message: 'Collection method updated.', collection_method });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/consultations/:id — consultation detail for the doctor's Finalize
// screen (patient name + their Path A/B declaration). Defined last so it doesn't
// shadow the more specific routes above.
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await dbPromise.query(
            `SELECT c.consultation_id, c.patient_id, c.doctor_id, c.session_status,
                    COALESCE(o.needs_medication, c.needs_medication) AS needs_medication,
                    COALESCE(o.collection_method, c.collection_method) AS collection_method,
                    c.order_id,
                    COALESCE(p.name, p.email) AS patient_name
             FROM consultations c
             LEFT JOIN users p ON c.patient_id = p.user_id
             LEFT JOIN orders o ON c.order_id = o.order_id
             WHERE c.consultation_id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Consultation not found.' });
        }
        const r = rows[0];
        res.status(200).json({
            consultation_id: r.consultation_id,
            patient_id: r.patient_id,
            doctor_id: r.doctor_id,
            order_id: r.order_id,
            session_status: r.session_status,
            needs_medication: r.needs_medication === null ? null : Boolean(r.needs_medication),
            collection_method: r.collection_method,
            patient_name: r.patient_name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
