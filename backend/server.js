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
import paymentRoutes from './routes/payments.js';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();

app.use(cors());

// Stripe webhook signature verification needs the raw, unparsed request body.
// Register the raw parser for this exact path BEFORE express.json so the JSON
// parser sees req._body already set and skips it. Order matters here — every
// other /api/payments/* route still parses as JSON below.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/api/queue', queueRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/medical-certificates', medicalCertificateRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true, 
    auth: {
        user: 'resend',                 
        pass: process.env.RESEND_API_KEY
    }
});

app.post('/api/register', (req, res) => {
    const { name, email, password, role = 'Patient' } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
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

        const insertQuery = 'INSERT INTO users (user_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)';
        db.query(insertQuery, [nextUserId, name, email, password, role], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Email is already registered.' });
                }
                return res.status(500).json({ error: err.message });
            }

            const verificationUrl = `http://localhost:5000/api/verify-email/${nextUserId}`;

            const mailOptions = {
                from: '"MediFlow Email Verification" <onboarding@resend.dev>',
                to: email,
                subject: 'Verify Your MediFlow Account Email',
                html: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px;">
                        <h2 style="color: #4f46e5; margin-bottom: 8px;">Welcome to MediFlow, ${name}!</h2>
                        <p style="color: #475569; font-size: 14px; line-height: 1.5;">Please click the button below to verify your account.</p>
                        <div style="margin: 24px 0; text-align: center;">
                            <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email Address</a>
                        </div>
                        <p style="color: #94a3b8; font-size: 11px;">If you didn't trigger this registration, you can safely ignore this email.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (mailErr, info) => {
                if (mailErr) {
                    console.error('Email dispatch failed:', mailErr);
                } else {
                    console.log('Verification email sent successfully:', info.response);
                }
            });

            res.status(201).json({
                message: 'User registered successfully! Verification email dispatched.',
                user: {
                    user_id: nextUserId,
                    email,
                    role
                }
            });
        });
    });
});

app.get('/api/verify-email/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'UPDATE users SET is_verified = TRUE WHERE user_id = ?';

    db.query(query, [userId], (err, result) => {
        if (err) {
            return res.status(500).send('<h2>Verification failed due to a server error.</h2>');
        }
        if (result.affectedRows === 0) {
            return res.status(404).send('<h2>Verification failed — account not found.</h2>');
        }
        res.status(200).send('<h2>Email verified successfully! You can now log in.</h2>');
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

        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email address before signing in.' });
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