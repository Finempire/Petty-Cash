const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

// Buyers
router.get('/buyers', authenticateToken, (req, res) => {
    res.json(db.prepare('SELECT * FROM buyers ORDER BY name').all());
});
router.post('/buyers', authenticateToken, requireRole('ACCOUNTANT', 'STORE_MANAGER'), (req, res) => {
    const { name, contact_details, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    // Auto-generate buyer code if not provided
    let { code } = req.body;
    if (!code) {
        const prefix = name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'BUY';
        const count = db.prepare('SELECT COUNT(*) as c FROM buyers').get().c + 1;
        code = `${prefix}${String(count).padStart(3, '0')}`;
    }
    const id = uuidv4();
    db.prepare('INSERT INTO buyers (id,name,code,contact_details,notes) VALUES (?,?,?,?,?)').run(id, name, code, contact_details || null, notes || null);
    auditLog('Buyer', id, 'CREATE', req.user.id, null, req.body, req);
    res.status(201).json({ id, name, code });
});
router.patch('/buyers/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const { name, code, contact_details, notes } = req.body;
    db.prepare("UPDATE buyers SET name=COALESCE(?,name),code=COALESCE(?,code),contact_details=COALESCE(?,contact_details),notes=COALESCE(?,notes),updated_at=datetime('now') WHERE id=?")
        .run(name, code, contact_details, notes, req.params.id);
    res.json({ success: true });
});
router.delete('/buyers/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    db.prepare('DELETE FROM buyers WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// Orders
router.get('/orders', authenticateToken, (req, res) => {
    const { buyer_id } = req.query;
    let sql = `SELECT o.*, b.name as buyer_name FROM orders o LEFT JOIN buyers b ON o.buyer_id=b.id WHERE 1=1`;
    const params = [];
    if (buyer_id) { sql += ' AND o.buyer_id=?'; params.push(buyer_id); }
    sql += ' ORDER BY o.order_no';
    res.json(db.prepare(sql).all(...params));
});
router.post('/orders', authenticateToken, requireRole('ACCOUNTANT', 'STORE_MANAGER'), (req, res) => {
    const { buyer_id, style, season, remarks, start_date, end_date } = req.body;
    if (!buyer_id) return res.status(400).json({ error: 'buyer_id required' });
    // Auto-generate order_no if not provided
    let { order_no } = req.body;
    if (!order_no) {
        const year = new Date().getFullYear();
        const count = db.prepare('SELECT COUNT(*) as c FROM orders').get().c + 1;
        order_no = `ORD-${year}-${String(count).padStart(3, '0')}`;
    }
    const id = uuidv4();
    try {
        db.prepare('INSERT INTO orders (id,order_no,buyer_id,style,season,remarks,start_date,end_date) VALUES (?,?,?,?,?,?,?,?)')
            .run(id, order_no, buyer_id, style, season || null, remarks || null, start_date || null, end_date || null);
        auditLog('Order', id, 'CREATE', req.user.id, null, req.body, req);
        res.status(201).json({ id, order_no });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Order number already exists' });
        throw e;
    }
});
router.patch('/orders/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const { style, season, remarks, start_date, end_date, status } = req.body;
    db.prepare("UPDATE orders SET style=COALESCE(?,style),season=COALESCE(?,season),remarks=COALESCE(?,remarks),start_date=COALESCE(?,start_date),end_date=COALESCE(?,end_date),status=COALESCE(?,status),updated_at=datetime('now') WHERE id=?")
        .run(style, season, remarks, start_date, end_date, status, req.params.id);
    res.json({ success: true });
});

// Materials
router.get('/materials', authenticateToken, (req, res) => {
    const { q } = req.query;
    let sql = 'SELECT * FROM materials WHERE active=1';
    const params = [];
    if (q) { sql += ' AND (name LIKE ? OR category LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    sql += ' ORDER BY category,name';
    res.json(db.prepare(sql).all(...params));
});
router.post('/materials', authenticateToken, requireRole('ACCOUNTANT', 'STORE_MANAGER'), (req, res) => {
    const { name, category, unit_of_measure, default_rate, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    db.prepare('INSERT INTO materials (id,name,category,unit_of_measure,default_rate,notes) VALUES (?,?,?,?,?,?)')
        .run(id, name, category, unit_of_measure || 'piece', default_rate, notes);
    res.status(201).json({ id, name });
});
router.patch('/materials/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const { name, category, unit_of_measure, default_rate, notes, active } = req.body;
    db.prepare("UPDATE materials SET name=COALESCE(?,name),category=COALESCE(?,category),unit_of_measure=COALESCE(?,unit_of_measure),default_rate=COALESCE(?,default_rate),notes=COALESCE(?,notes),active=COALESCE(?,active),updated_at=datetime('now') WHERE id=?")
        .run(name, category, unit_of_measure, default_rate, notes, active !== undefined ? (active ? 1 : 0) : undefined, req.params.id);
    res.json({ success: true });
});

module.exports = router;
