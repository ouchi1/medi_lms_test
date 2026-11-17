const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// ទាញយកបញ្ជីមុខវិជ្ជា និងចំនួនសំណួរ QCM
router.get('/subjects', async (req, res) => {
    try {
        const [subjects] = await db.query(`
            SELECT s.id, s.name, s.parent_id, s.school_id, s.type, p.name as parent_name, COUNT(q.id) as question_count 
            FROM subjects s 
            LEFT JOIN subjects p ON s.parent_id = p.id
            LEFT JOIN quizzes q ON s.id = q.subject_id 
            GROUP BY s.id, s.name, s.parent_id, s.school_id, s.type, p.name
            ORDER BY s.parent_id ASC, s.id ASC
        `);
        res.json(subjects);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ទាញយកសំណួរ និងចម្លើយតាម ID មុខវិជ្ជា
router.get('/questions/:subjectId', async (req, res) => {
    try {
        const subjectId = req.params.subjectId;
        const [questions] = await db.query('SELECT * FROM quizzes WHERE subject_id = ?', [subjectId]);
        
        for (let q of questions) {
            const [options] = await db.query('SELECT * FROM quiz_options WHERE quiz_id = ?', [q.id]);
            q.options = options;
        }
        res.json(questions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// បន្ថែមសំណួរ QCM ម្តងមួយ (Manual)
router.post('/questions', verifyToken, isAdmin, async (req, res) => {
    try {
        const { subjectId, questionText, explanation, options } = req.body;
        
        const [qResult] = await db.query(
            'INSERT INTO quizzes (subject_id, question_text, explanation, created_by) VALUES (?, ?, ?, ?)',
            [subjectId, questionText, explanation || '', req.user.id]
        );
        const quizId = qResult.insertId;

        for (let opt of options) {
            await db.query(
                'INSERT INTO quiz_options (quiz_id, option_text, is_correct) VALUES (?, ?, ?)',
                [quizId, opt.option_text, opt.is_correct ? 1 : 0]
            );
        }

        res.status(201).json({ message: 'បន្ថែមសំណួរ QCM ជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// បន្ថែមសំណួរ QCM ច្រើនព្រមគ្នា (Bulk Import)
router.post('/questions/bulk', verifyToken, isAdmin, async (req, res) => {
    try {
        const { questions } = req.body;
        if (!questions || !questions.length) {
            return res.status(400).json({ message: 'គ្មានទិន្នន័យសំណួរសម្រាប់បញ្ចូលទេ!' });
        }

        for (let q of questions) {
            const [qResult] = await db.query(
                'INSERT INTO quizzes (subject_id, question_text, explanation, created_by) VALUES (?, ?, ?, ?)',
                [q.subjectId, q.questionText, q.explanation || '', req.user.id]
            );
            const quizId = qResult.insertId;

            for (let opt of q.options) {
                await db.query(
                    'INSERT INTO quiz_options (quiz_id, option_text, is_correct) VALUES (?, ?, ?)',
                    [quizId, opt.option_text, opt.is_correct ? 1 : 0]
                );
            }
        }

        res.status(201).json({ message: `បញ្ចូលសំណួរ QCM ចំនួន ${questions.length} ជោគជ័យ!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 🟢 លុបសំណួរ QCM ម្តងបានច្រើន (Bulk Delete) - ត្រូវដាក់មុន /questions/:id ដើម្បីការពារការច្រឡំ Path
router.post('/questions/bulk-delete', verifyToken, isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !ids.length) {
            return res.status(400).json({ message: 'សូមជ្រើសរើសសំណួរយ៉ាងហោចណាស់មួយសម្រាប់លុប!' });
        }

        for (let id of ids) {
            await db.query('DELETE FROM quiz_options WHERE quiz_id = ?', [id]);
            await db.query('DELETE FROM quizzes WHERE id = ?', [id]);
        }

        res.json({ message: `លុបសំណួរ QCM ចំនួន ${ids.length} បានជោគជ័យ!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 🟢 លុបសំណួរ QCM ម្តងមួយ (Single Delete)
router.delete('/questions/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const questionId = req.params.id;
        await db.query('DELETE FROM quiz_options WHERE quiz_id = ?', [questionId]);
        await db.query('DELETE FROM quizzes WHERE id = ?', [questionId]);
        res.json({ message: 'លុបសំណួរ QCM ជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;