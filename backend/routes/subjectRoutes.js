const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM subjects');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, parentId, schoolId, type } = req.body;
        if (!name) return res.status(400).json({ message: 'សូមវាយបញ្ចូលឈ្មោះមុខវិជ្ជា!' });

        await db.query(
            'INSERT INTO subjects (name, parent_id, school_id, type) VALUES (?, ?, ?, ?)',
            [name, parentId ? parseInt(parentId) : null, schoolId ? parseInt(schoolId) : null, type || 'qcm']
        );
        res.status(201).json({ message: 'បន្ថែមមុខវិជ្ជាជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const subjectId = req.params.id;
        const { name, parentId } = req.body;
        
        await db.query(
            'UPDATE subjects SET name = ?, parent_id = ? WHERE id = ?', 
            [name, parentId ? parseInt(parentId) : null, subjectId]
        );
        res.json({ message: 'កែប្រែមុខវិជ្ជាជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const subjectId = req.params.id;
        await db.query('DELETE FROM subjects WHERE id = ?', [subjectId]);
        res.json({ message: 'លុបមុខវិជ្ជាជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;