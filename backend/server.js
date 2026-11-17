const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./config/db');
const apiRoutes = require('./routes');
const { verifyToken, isAdmin } = require('./middleware/authMiddleware');

const app = express();
app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Multer Setup សម្រាប់ Upload រូបភាព
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'school-' + Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔗 ភ្ជាប់ Main API Routes ទាំងអស់នៅទីនេះ (Prefix: /api)
app.use('/api', apiRoutes);

// Upload Image Route ដាច់ដោយឡែក
app.post('/api/upload', verifyToken, isAdmin, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'សូមជ្រើសរើសរូបភាព!' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ imageUrl: imageUrl });
});

// Admin Create Student Route
app.post('/api/admin/students', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, email, password, expire_date } = req.body;
        
        if (!name || !email || !password || !expire_date) {
            return res.status(400).json({ message: 'សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់!' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password_hash, expire_date, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, expire_date, 'student']
        );

        const userId = result.insertId;
        await db.query('INSERT INTO student_profiles (user_id) VALUES (?)', [userId]);

        res.json({ message: 'បង្កើតគណនីសិស្ស និងកំណត់ថ្ងៃផុតកំណត់បានជោគជ័យ!', studentId: userId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'អុីមែលនេះមានរួចហើយក្នុងប្រព័ន្ធ!' });
        }
        res.status(500).json({ message: 'មានបញ្ហាលើ Server: ' + err.message });
    }
    
});

// Server Listening Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Medi-LMS Server running on http://localhost:${PORT}`));