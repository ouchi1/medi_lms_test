const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', async (req, res) => {
    try {
        const [schools] = await db.query('SELECT * FROM schools ORDER BY id ASC');
        res.json(schools);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, logo_type, logo_value, description } = req.body;
        if (!name) return res.status(400).json({ message: 'សូមបញ្ចូលឈ្មោះសាលារៀន!' });

        await db.query(
            'INSERT INTO schools (name, logo_type, logo_url, description) VALUES (?, ?, ?, ?)',
            [name, logo_type || 'emoji', logo_value || '🏫', description || '']
        );
        res.status(201).json({ message: 'បន្ថែមសាលារៀនជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const schoolId = req.params.id;
        const { name, logo_type, logo_url, description } = req.body;

        if (!name) return res.status(400).json({ message: 'សូមបញ្ចូលឈ្មោះសាលារៀន!' });

        const [existing] = await db.query('SELECT * FROM schools WHERE id = ?', [schoolId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'រកមិនឃើញសាលានេះទេ!' });
        }

        const currentSchool = existing[0];
        const finalLogoType = logo_type || currentSchool.logo_type || 'emoji';
        const finalLogoUrl = (logo_url !== undefined && logo_url !== '') ? logo_url : currentSchool.logo_url;
        const finalDesc = (description !== undefined) ? description : currentSchool.description;

        await db.query(
            'UPDATE schools SET name = ?, logo_type = ?, logo_url = ?, description = ? WHERE id = ?',
            [name, finalLogoType, finalLogoUrl, finalDesc, schoolId]
        );
        
        res.json({ message: 'កែប្រែព័ត៌មានសាលារៀនជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const schoolId = req.params.id;
        const [result] = await db.query('DELETE FROM schools WHERE id = ?', [schoolId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'រកមិនឃើញសាលារៀននេះទេ!' });
        }
        
        res.json({ message: 'លុបសាលារៀនបានជោគជ័យ!' });
    } catch (err) {
        res.status(500).json({ message: 'មានបញ្ហាក្នុងការលុប: ' + err.message });
    }
});

module.exports = router;