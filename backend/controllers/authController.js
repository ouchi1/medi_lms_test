// ឧទាហរណ៍កូដត្រឹមត្រូវក្នុង Login Controller
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // ឬទីតាំង db របស់អ្នក

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // ស្វែងរក User តាម Email
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(400).json({ message: 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!' });
        }

        const user = rows[0];

        // ផ្ទៀងផ្ទាត់ Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!' });
        }

        // បង្កើត Token
        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET || 'super_secret_key_12345', 
            { expiresIn: '1d' }
        );

        res.json({
            message: 'ចូលប្រព័ន្ធបានជោគជ័យ!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'មានបញ្ហាក្នុងម៉ាស៊ីនមេ: ' + error.message });
    }
};