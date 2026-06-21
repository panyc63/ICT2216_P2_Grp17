import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json()); 

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the MySQL database:', err.message);
    } else {
        console.log('Successfully connected to the MySQL database.');
        connection.release();
    }
});

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
            from: '"Mediflow Email Verification" <onboarding@resend.dev>',
            to: email, 
            subject: 'Verify Your Mediflow Account Email',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px;">
                    <h2 style="color: #4f46e5; margin-bottom: 8px;">Welcome to Mediflow, ${name}!</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Please click the button below to instantly verify your account and activate your login parameters.</p>
                    <div style="margin: 24px 0; text-align: center;">
                        <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email Address</a>
                    </div>
                    <p style="color: #94a3b8; font-size: 11px;">If you didn't trigger this registry workflow, you can safely ignore this email.</p>
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
                user: { user_id: nextUserId, role: role }
            });
        });
    });
});

app.get('/api/verify-email/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'UPDATE users SET is_verified = TRUE WHERE user_id = ?';
    db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).send('<h1>Verification Failed</h1><p>User account not found.</p>');
        }
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1 style="color: #4f46e5;">Email Verified Successfully!</h1>
                <p>Your Mediflow account is active. You can now close this tab.</p>
                <a href="http://localhost:5173/login" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Login Portal</a>
            </div>
        `);
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