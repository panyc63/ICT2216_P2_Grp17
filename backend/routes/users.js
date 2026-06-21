import express from 'express';
import { dbPromise } from '../config/db.js';

const router = express.Router();

// GET /api/users/patients — minimal list of patients for selector UIs (doctor/
// admin standalone MC + payment-request tools). Defined before /:userId so the
// literal 'patients' segment isn't captured as a user id.
router.get('/patients', async (req, res) => {
    try {
        const [rows] = await dbPromise.query(
            "SELECT user_id, name, email FROM users WHERE role = 'Patient' ORDER BY COALESCE(name, email) ASC"
        );
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/:userId — public-facing profile fields for one user.
// Deliberately excludes password_hash (and NRIC is not stored/returned).
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [rows] = await dbPromise.query(
            'SELECT user_id, name, email, role, home_address FROM users WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/users/:userId — update editable profile fields. Only the home
// address is editable from the patient portal.
router.patch('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { home_address } = req.body;

    if (typeof home_address !== 'string') {
        return res.status(400).json({ error: 'home_address is required.' });
    }

    try {
        const [result] = await dbPromise.query(
            'UPDATE users SET home_address = ? WHERE user_id = ?',
            [home_address.trim(), userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const [rows] = await dbPromise.query(
            'SELECT user_id, name, email, role, home_address FROM users WHERE user_id = ?',
            [userId]
        );

        res.status(200).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
