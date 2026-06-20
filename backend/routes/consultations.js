import express from 'express';
import { db as rtdb } from '../config/firebase.js';
import { dbPromise } from '../config/db.js';

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

        // Carry the patient's Path A/B declaration from the queue entry onto the
        // persisted consultation record.
        const needsMedication = typeof entry.needs_medication === 'boolean' ? entry.needs_medication : null;

        // Persist the consultation in MySQL (Stripe/Phase 2 keys off this).
        await dbPromise.query(
            'INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status, needs_medication) VALUES (?, ?, ?, ?, ?)',
            [consultationId, entry.patient_id, doctor_id, 'Active', needsMedication]
        );

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

// POST /api/consultations/:id/complete — end the call and clean up.
router.post('/:id/complete', async (req, res) => {
    const { id } = req.params;

    try {
        await dbPromise.query(
            "UPDATE consultations SET session_status = 'Completed' WHERE consultation_id = ?",
            [id]
        );

        // Remove the patient's queue entry tied to this room.
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

        // Tear down the signaling node.
        await rtdb.ref(`${ROOMS_REF}/${id}`).remove();

        res.status(200).json({ message: 'Consultation completed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
