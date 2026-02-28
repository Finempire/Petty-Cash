const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

// GET /api/vendors  (all roles can read)
router.get('/', authenticateToken, (req, res) => {
    const { q, active } = req.query;
    let sql = 'SELECT * FROM vendors WHERE 1=1';
    const params = [];
    if (q) { sql += ' AND (name LIKE ? OR contact_person LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    if (active !== undefined) { sql += ' AND active=?'; params.push(active === 'true' ? 1 : 0); }
    sql += ' ORDER BY name';
    res.json(db.prepare(sql).all(...params));
});

// POST /api/vendors
router.post('/', authenticateToken, (req, res) => {
    const { name, contact_person, phone, email, address, gstin, ledger_code, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Vendor name required' });
    const id = uuidv4();
    db.prepare('INSERT INTO vendors (id,name,contact_person,phone,email,address,gstin,ledger_code,notes) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, name, contact_person || null, phone || null, email || null, address || null, gstin || null, ledger_code || null, notes || null);
    auditLog('Vendor', id, 'CREATE', req.user.id, null, req.body, req);
    res.status(201).json({ id, name });
});

// PATCH /api/vendors/:id
router.patch('/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id=?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    const { name, contact_person, phone, email, address, gstin, ledger_code, notes, active } = req.body;
    db.prepare(`UPDATE vendors SET name=COALESCE(?,name), contact_person=COALESCE(?,contact_person),
    phone=COALESCE(?,phone), email=COALESCE(?,email), address=COALESCE(?,address), gstin=COALESCE(?,gstin),
    ledger_code=COALESCE(?,ledger_code), notes=COALESCE(?,notes),
    active=COALESCE(?,active), updated_at=datetime('now') WHERE id=?`)
        .run(name, contact_person, phone, email, address, gstin, ledger_code, notes, active !== undefined ? (active ? 1 : 0) : undefined, req.params.id);
    auditLog('Vendor', req.params.id, 'UPDATE', req.user.id, vendor, req.body, req);
    res.json({ success: true });
});

// DELETE /api/vendors/:id (soft delete)
router.delete('/:id', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    db.prepare("UPDATE vendors SET active=0, updated_at=datetime('now') WHERE id=?").run(req.params.id);
    auditLog('Vendor', req.params.id, 'DELETE', req.user.id, null, null, req);
    res.json({ success: true });
});

module.exports = router;
