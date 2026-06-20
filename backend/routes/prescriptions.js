import express from 'express';
import { dbPromise } from '../config/db.js';

const router = express.Router();

// GET /api/prescriptions/:patientId — medication lines for the patient's most
// recent consultation, plus the consultation context the frontend needs to
// decide what to render (e.g. "still being finalized" vs the actual list).
router.get('/:patientId', async (req, res) => {
    const { patientId } = req.params;

    try {
        const [crows] = await dbPromise.query(
            `SELECT c.consultation_id, c.doctor_id, c.session_status,
                    c.needs_medication, c.collection_method,
                    COALESCE(d.name, d.email) AS doctor_name
             FROM consultations c
             LEFT JOIN users d ON c.doctor_id = d.user_id
             WHERE c.patient_id = ?
             ORDER BY c.consultation_id DESC
             LIMIT 1`,
            [patientId]
        );

        // No consultation at all yet.
        if (crows.length === 0) {
            return res.status(200).json({
                consultation_id: null,
                session_status: null,
                needs_medication: null,
                collection_method: null,
                doctor_name: null,
                issued_date: null,
                items: []
            });
        }

        const con = crows[0];

        const [items] = await dbPromise.query(
            `SELECT medication_name, dosage, instructions, status,
                    DATE_FORMAT(created_at, '%Y-%m-%d') AS created_date
             FROM prescriptions
             WHERE consultation_id = ?
             ORDER BY created_at ASC`,
            [con.consultation_id]
        );

        res.status(200).json({
            consultation_id: con.consultation_id,
            session_status: con.session_status,
            needs_medication: con.needs_medication === null ? null : Boolean(con.needs_medication),
            collection_method: con.collection_method,
            doctor_name: con.doctor_name,
            issued_date: items.length ? items[0].created_date : null,
            items: items.map((it) => ({
                medication_name: it.medication_name,
                dosage: it.dosage,
                instructions: it.instructions,
                status: it.status
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
