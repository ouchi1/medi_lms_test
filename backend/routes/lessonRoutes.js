const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', async (req, res) => {
    try {
        const [lessons] = await db.query(`
            SELECT l.*, s.name as subject_name 
            FROM lessons l 
            JOIN subjects s ON l.subject_id = s.id 
            ORDER BY l.id DESC
        `);
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { title, subjectId, videoUrl, videoType, createdBy } = req.body;
        await db.query(
            'INSERT INTO lessons (title, subject_id, video_url, video_type, created_by) VALUES (?, ?, ?, ?, ?)',
            [title, subjectId, videoUrl, videoType || 'embed', createdBy || req.user.id]
        );
        res.status(201).json({ message: 'បន្ថែមមេរៀនជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const lessonId = req.params.id;
        const { title, subjectId, videoUrl } = req.body;
        
        await db.query(
            'UPDATE lessons SET title = ?, subject_id = ?, video_url = ? WHERE id = ?',
            [title, subjectId, videoUrl, lessonId]
        );
        res.json({ message: 'កែប្រែមេរៀនវីដេអូជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const lessonId = req.params.id;
        await db.query('DELETE FROM lessons WHERE id = ?', [lessonId]);
        res.json({ message: 'លុបមេរៀនវីដេអូជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;