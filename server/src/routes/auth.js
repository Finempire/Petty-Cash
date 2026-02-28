const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { auditLog } = require('../middleware/auditLog');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?').get(email.toLowerCase(), 'ACTIVE');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department },
        JWT_SECRET,
        { expiresIn: '12h' }
    );

    auditLog('User', user.id, 'LOGIN', user.id, null, { email: user.email }, req);

    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
    });
});

// POST /api/auth/me  (token validation)
router.get('/me', require('../middleware/auth').authenticateToken, (req, res) => {
    const user = db.prepare('SELECT id, name, email, role, department, phone FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
});

module.exports = router;
