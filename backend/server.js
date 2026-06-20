import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './config/db.js';
import queueRoutes from './routes/queue.js';
import consultationRoutes from './routes/consultations.js';
import medicalCertificateRoutes from './routes/medicalCertificates.js';
import prescriptionRoutes from './routes/prescriptions.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/queue', queueRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/medical-certificates', medicalCertificateRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

app.post('/api/register', (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const maxIdQuery = "SELECT user_id FROM users WHERE user_id LIKE 'MH-U%' ORDER BY user_id DESC LIMIT 1";

    db.query(maxIdQuery, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        let nextUserId = 'MH-U001';

        if (results.length > 0) {
            const lastId = results[0].user_id;
            const currentNumericPart = parseInt(lastId.replace('MH-U', ''), 10);
            const nextNumericPart = currentNumericPart + 1;

            nextUserId = `MH-U${String(nextNumericPart).padStart(3, '0')}`;
        }

        const insertQuery = 'INSERT INTO users (user_id, email, password_hash, role) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [nextUserId, email, password, role], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Email is already registered.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({
                message: 'User registered successfully!',
                user: {
                    user_id: nextUserId,
                    email,
                    role
                }
            });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password credentials.' });
        }

        const user = results[0];

        if (password !== user.password_hash) {
            return res.status(401).json({ error: 'Invalid email or password credentials.' });
        }

        res.status(200).json({
            message: 'Login successful.',
            user: {
                user_id: user.user_id,
                email: user.email,
                role: user.role 
            }
        });
    });
});

app.get('/api/staff', (req, res) => {
    const query = "SELECT * FROM users WHERE LOWER(role) != 'patient' ORDER BY CAST(SUBSTRING(user_id, 5) AS UNSIGNED) ASC";

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const formattedResults = results.map(user => ({
            user_id: user.user_id,
            email: user.email,
            role: user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
        }));

        res.status(200).json(formattedResults);
    });
});

app.delete('/api/staff/:id', (req, res) => {
    const userId = req.params.id;
    const query = "DELETE FROM users WHERE user_id = ?";
    db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Staff member account dropped completely.' });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend server is running.`);
});