const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

// GET /api/users
router.get('/', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const users = db.prepare('SELECT id, name, email, phone, role, department, status, created_at FROM users ORDER BY role, name').all();
    res.json(users);
});

// POST /api/users
router.post('/', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const { name, email, phone, role, department, password } = req.body;
    if (!name || !email || !role || !password) return res.status(400).json({ error: 'name, email, role, password required' });
    const bcrypt = require('bcryptjs');
    const id = uuidv4();
    try {
        db.prepare('INSERT INTO users (id,name,email,phone,password_hash,role,department) VALUES (?,?,?,?,?,?,?)').run(
            id, name, email.toLowerCase(), phone, bcrypt.hashSync(password, 10), role, department
        );
        auditLog('User', id, 'CREATE', req.user.id, null, { name, email, role }, req);
        res.status(201).json({ id, name, email, role });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
        throw e;
    }
});

// PATCH /api/users/:id
router.patch('/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, phone, role, department, status } = req.body;
    db.prepare('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), role=COALESCE(?,role), department=COALESCE(?,department), status=COALESCE(?,status), updated_at=datetime(\'now\') WHERE id=?')
        .run(name, phone, role, department, status, req.params.id);
    auditLog('User', req.params.id, 'UPDATE', req.user.id, user, req.body, req);
    res.json({ success: true });
});

module.exports = router;
