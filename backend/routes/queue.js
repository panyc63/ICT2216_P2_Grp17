import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

const QUEUE_REF = 'active_queues';

// Higher weight is served first. Patients with the same priority are
// ordered by who joined earliest (timestamp ascending).
const PRIORITY_WEIGHT = {
    emergency: 3,
    urgent: 2,
    normal: 1
};

const getWeight = (priorityScore) => PRIORITY_WEIGHT[priorityScore] || PRIORITY_WEIGHT.normal;

// Returns the queue entries sorted by serving order (priority first, then timestamp).
const getOrderedQueue = async () => {
    const snapshot = await db.ref(QUEUE_REF).once('value');
    const queue = snapshot.val() || {};

    return Object.entries(queue)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => {
            const weightDiff = getWeight(b.priority_score) - getWeight(a.priority_score);
            if (weightDiff !== 0) return weightDiff;
            return a.timestamp - b.timestamp;
        });
};

// GET /api/queue/list — full ordered queue, for the staff/doctor view.
router.get('/list', async (req, res) => {
    try {
        const ordered = await getOrderedQueue();
        res.status(200).json(ordered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/queue/join — adds a patient to the active queue.
router.post('/join', async (req, res) => {
    const { patient_id, priority_score } = req.body;

    if (!patient_id) {
        return res.status(400).json({ error: 'patient_id is required.' });
    }

    try {
        const existing = await db.ref(QUEUE_REF)
            .orderByChild('patient_id')
            .equalTo(patient_id)
            .once('value');

        if (existing.exists()) {
            return res.status(409).json({ error: 'Patient is already in the queue.' });
        }

        const entry = {
            patient_id,
            priority_score: priority_score || 'normal',
            timestamp: Date.now()
        };

        const ref = await db.ref(QUEUE_REF).push(entry);

        res.status(201).json({ message: 'Patient added to the queue.', id: ref.key, ...entry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/queue/status/:patientId — returns the patient's current position.
router.get('/status/:patientId', async (req, res) => {
    const { patientId } = req.params;

    try {
        const ordered = await getOrderedQueue();
        const entry = ordered.find((e) => e.patient_id === patientId);

        if (!entry) {
            return res.status(404).json({ error: 'Patient is not in the queue.' });
        }

        // Already accepted by a doctor — hand the room id to the patient so
        // they can route into the call. Position no longer applies.
        if (entry.room_id) {
            return res.status(200).json({
                patient_id: entry.patient_id,
                room_id: entry.room_id,
                doctor_id: entry.doctor_id || null,
                status: 'accepted'
            });
        }

        // Position is computed among waiting (not-yet-accepted) patients only.
        const waiting = ordered.filter((e) => !e.room_id);
        const index = waiting.findIndex((e) => e.patient_id === patientId);

        res.status(200).json({
            patient_id: entry.patient_id,
            priority_score: entry.priority_score,
            timestamp: entry.timestamp,
            position: index + 1,
            total: waiting.length,
            status: 'waiting'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/queue/leave/:patientId — removes a patient from the queue.
router.delete('/leave/:patientId', async (req, res) => {
    const { patientId } = req.params;

    try {
        const snapshot = await db.ref(QUEUE_REF)
            .orderByChild('patient_id')
            .equalTo(patientId)
            .once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ error: 'Patient is not in the queue.' });
        }

        const updates = {};
        snapshot.forEach((child) => {
            updates[child.key] = null;
        });
        await db.ref(QUEUE_REF).update(updates);

        res.status(200).json({ message: 'Patient removed from the queue.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
