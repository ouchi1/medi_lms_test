const bcrypt = require('bcryptjs');
const db = require('./config/db'); // ផ្ទៀងផ្ទាត់ផ្លូវទៅកាន់ไฟล์ db.js របស់អ្នក

async function createAdmin() {
    try {
        const email = 'admin@gmail.com';
        const password = '123456';
        const fullName = 'Administrator';
        const role = 'ADMIN';

        // ឆែកមើលថាតើមាន Email ນີ້រួចហើយឬនៅ
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            console.log('⚠️ អុីមែលនេះមានរួចហើយក្នុងប្រព័ន្ធ! កំពុងធ្វើការប្តូរ Password ថ្មី...');
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE users SET password_hash = ?, role = ? WHERE email = ?', [hashedPassword, role, email]);
            console.log('✅ ធ្វើបច្ចុប្បន្នភាព Password សម្រាប់ Admin ជោគជ័យ!');
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const [result] = await db.query(
                'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                [fullName, email, hashedPassword, role]
            );
            await db.query('INSERT INTO student_profiles (user_id) VALUES (?)', [result.insertId]);
            console.log('🎉 បង្កើត Account Admin ថ្មីបានជោគជ័យ!');
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ មានបញ្ហា:', err.message);
        process.exit(1);
    }
}

createAdmin();