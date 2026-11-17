const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'គ្មាន Token បញ្ជាក់សិទ្ធិទេ សូម Login ចូលជាថ្មី!' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token មិនត្រឹមត្រូវ ឬអស់សុពលភាព!' });
        }
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    const role = req.user && req.user.role ? String(req.user.role).toUpperCase().trim() : '';
    if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'TEACHER') {
        return next();
    }
    return res.status(403).json({ message: "privilege check for 'Update' fail" });
};

module.exports = { verifyToken, isAdmin };