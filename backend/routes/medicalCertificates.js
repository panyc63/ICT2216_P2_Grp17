import express from 'express';
import { dbPromise } from '../config/db.js';
import { nextSeqId } from '../services/ids.js';
import { logAudit } from '../services/audit.js';

const router = express.Router();

// POST /api/medical-certificates — issue a STANDALONE certificate, not tied to
// any consultation (consultation_id stays NULL). For patients who don't need a
// video consult, or for a follow-up/replacement MC. Body:
// { patient_id, doctor_id, diagnosis, valid_until }.
router.post('/', async (req, res) => {
    const { patient_id, doctor_id, diagnosis, valid_until } = req.body;

    if (!patient_id || !doctor_id || !diagnosis || !valid_until) {
        return res.status(400).json({ error: 'patient_id, doctor_id, diagnosis and valid_until are required.' });
    }

    try {
        const [prows] = await dbPromise.query('SELECT user_id FROM users WHERE user_id = ?', [patient_id]);
        if (prows.length === 0) {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        const mcId = await nextSeqId('medical_certificates', 'mc_id', 'MH-MC');
        await dbPromise.query(
            `INSERT INTO medical_certificates
                (mc_id, consultation_id, doctor_id, patient_id, issue_date, valid_until, is_revoked, diagnosis)
             VALUES (?, NULL, ?, ?, CURDATE(), ?, 0, ?)`,
            [mcId, doctor_id, patient_id, valid_until, diagnosis]
        );

        await logAudit(doctor_id, 'ISSUE_STANDALONE_MC', mcId);

        res.status(201).json({ message: 'Medical certificate issued.', mc_id: mcId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/medical-certificates/:patientId — all MCs issued to a patient,
// newest first. Joins users to surface the doctor's and patient's display name
// (falling back to email where name is null). Returns [] when none exist.
router.get('/:patientId', async (req, res) => {
    const { patientId } = req.params;

    try {
        const [rows] = await dbPromise.query(
            `SELECT mc.mc_id,
                    mc.consultation_id,
                    DATE_FORMAT(mc.issue_date, '%Y-%m-%d')   AS issue_date,
                    DATE_FORMAT(mc.valid_until, '%Y-%m-%d')  AS valid_until,
                    mc.is_revoked,
                    mc.diagnosis,
                    mc.doctor_id,
                    COALESCE(doc.name, doc.email)  AS doctor_name,
                    mc.patient_id,
                    COALESCE(pat.name, pat.email)  AS patient_name
             FROM medical_certificates mc
             LEFT JOIN users doc ON mc.doctor_id = doc.user_id
             LEFT JOIN users pat ON mc.patient_id = pat.user_id
             WHERE mc.patient_id = ?
             ORDER BY mc.issue_date DESC`,
            [patientId]
        );

        const certificates = rows.map((r) => ({
            mc_id: r.mc_id,
            consultation_id: r.consultation_id,
            issue_date: r.issue_date,
            valid_until: r.valid_until,
            is_revoked: Boolean(r.is_revoked),
            diagnosis: r.diagnosis, // null until a doctor sets it (Issue 2)
            doctor_name: r.doctor_name,
            patient_name: r.patient_name
        }));

        res.status(200).json(certificates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
