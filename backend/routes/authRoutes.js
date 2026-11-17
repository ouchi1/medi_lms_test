const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'អុីមែលនេះមានក្នុងប្រព័ន្ធរួចហើយ!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [fullName, email, hashedPassword, 'student']
        );
        const userId = result.insertId;

        await db.query('INSERT INTO student_profiles (user_id) VALUES (?)', [userId]);

        res.status(201).json({ message: 'ចុះឈ្មោះជាសិស្សជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'រកមិនឃើញអុីមែលនេះនៅក្នុងប្រព័ន្ធទេ!' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);

        res.json({ message: 'កំណត់ពាក្យសម្ងាត់ថ្មីជោគជ័យ! សូមចូលប្រព័ន្ធជាថ្មី។' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(400).json({ message: 'រកមិនឃើញអុីមែលនេះទេ!' });
        }

        const user = users[0];
        const userRole = user.role || 'student';

        if (userRole.toLowerCase() === 'student' && user.expire_date) {
            const today = new Date();
            const expireDate = new Date(user.expire_date);
            if (today > expireDate) {
                return res.status(403).json({ 
                    message: `គណនីរបស់អ្នកបានផុតកំណត់ចាប់តាំងពីថ្ងៃទី ${user.expire_date}! សូមទាក់ទង Admin ដើម្បីពន្យារពេល។` 
                });
            }
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ!' });
        }

        const token = jwt.sign(
            { id: user.id, name: user.full_name, role: userRole },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: { id: user.id, name: user.full_name, email: user.email, role: userRole, expire_date: user.expire_date }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;