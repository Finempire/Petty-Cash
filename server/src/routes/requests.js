const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog, notify } = require('../middleware/auditLog');

// Convert empty strings to null for FK fields
const nullify = v => (v === '' || v === undefined) ? null : v;

function generateRequestNo() {
    const year = new Date().getFullYear();
    const count = db.prepare('SELECT COUNT(*) as c FROM material_requests').get().c + 1;
    return `MR-${year}-${String(count).padStart(4, '0')}`;
}

// GET /api/requests
router.get('/', authenticateToken, (req, res) => {
    const { role, id: userId } = req.user;
    const { status, buyer_id, order_id, from, to } = req.query;

    let sql = `SELECT mr.*, u.name as requested_by_name, b.name as buyer_name,
    o.order_no, o.style,
    (SELECT SUM(expected_amount) FROM material_request_lines WHERE material_request_id=mr.id) as total_expected_amount
    FROM material_requests mr
    LEFT JOIN users u ON mr.requested_by_user_id=u.id
    LEFT JOIN buyers b ON mr.buyer_id=b.id
    LEFT JOIN orders o ON mr.order_id=o.id
    WHERE 1=1`;
    const params = [];

    // Store managers see only their own requests
    if (role === 'STORE_MANAGER') { sql += ' AND mr.requested_by_user_id=?'; params.push(userId); }
    if (status) { sql += ' AND mr.status=?'; params.push(status); }
    if (buyer_id) { sql += ' AND mr.buyer_id=?'; params.push(buyer_id); }
    if (order_id) { sql += ' AND mr.order_id=?'; params.push(order_id); }
    if (from) { sql += ' AND mr.requested_date>=?'; params.push(from); }
    if (to) { sql += ' AND mr.requested_date<=?'; params.push(to); }
    sql += ' ORDER BY mr.created_at DESC';

    res.json(db.prepare(sql).all(...params));
});

// GET /api/requests/:id  (with lines)
router.get('/:id', authenticateToken, (req, res) => {
    const mr = db.prepare(`SELECT mr.*, u.name as requested_by_name, b.name as buyer_name,
    o.order_no, o.style, v.name as preferred_vendor_name
    FROM material_requests mr
    LEFT JOIN users u ON mr.requested_by_user_id=u.id
    LEFT JOIN buyers b ON mr.buyer_id=b.id
    LEFT JOIN orders o ON mr.order_id=o.id
    LEFT JOIN vendors v ON mr.preferred_vendor_id=v.id
    WHERE mr.id=?`).get(req.params.id);
    if (!mr) return res.status(404).json({ error: 'Not found' });

    const lines = db.prepare(`SELECT l.*, m.name as material_name, m.unit_of_measure, m.category
    FROM material_request_lines l
    LEFT JOIN materials m ON l.material_id=m.id
    WHERE l.material_request_id=?`).all(req.params.id);

    const purchases = db.prepare(`SELECT p.*, u.name as runner_name, v.name as vendor_name
    FROM purchases p
    LEFT JOIN users u ON p.runner_boy_user_id=u.id
    LEFT JOIN vendors v ON p.vendor_id=v.id
    WHERE p.material_request_id=? ORDER BY p.created_at DESC`).all(req.params.id);

    res.json({ ...mr, lines, purchases });
});

// POST /api/requests
router.post('/', authenticateToken, requireRole('STORE_MANAGER'), (req, res) => {
    try {
        const { buyer_id, order_id, department, requested_date, expected_purchase_date, preferred_vendor_id, notes, lines } = req.body;
        if (!lines || lines.length === 0) return res.status(400).json({ error: 'At least one line item required' });

        const id = uuidv4();
        const request_no = generateRequestNo();

        db.prepare(`INSERT INTO material_requests (id,request_no,requested_by_user_id,department,buyer_id,order_id,preferred_vendor_id,requested_date,expected_purchase_date,status,notes)
        VALUES (?,?,?,?,?,?,?,?,?,'DRAFT',?)`).run(id, request_no, req.user.id, department || null, nullify(buyer_id), nullify(order_id), nullify(preferred_vendor_id), requested_date || new Date().toISOString().split('T')[0], expected_purchase_date || null, notes || null);

        const insertLine = db.prepare('INSERT INTO material_request_lines (id,material_request_id,material_id,description,quantity,expected_rate,expected_amount,remarks) VALUES (?,?,?,?,?,?,?,?)');
        for (const l of lines) {
            insertLine.run(uuidv4(), id, nullify(l.material_id), l.description || null, Number(l.quantity) || 0, Number(l.expected_rate) || 0, (Number(l.quantity) || 0) * (Number(l.expected_rate) || 0), l.remarks || null);
        }

        auditLog('MaterialRequest', id, 'CREATE', req.user.id, null, { request_no, status: 'DRAFT' }, req);
        res.status(201).json({ id, request_no });
    } catch (err) {
        console.error('POST /requests error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/requests/:id  (edit / submit / cancel)
router.patch('/:id', authenticateToken, (req, res) => {
    try {
        const mr = db.prepare('SELECT * FROM material_requests WHERE id=?').get(req.params.id);
        if (!mr) return res.status(404).json({ error: 'Not found' });

        const { role, id: userId } = req.user;
        // Only the owner or accountant can edit
        if (role === 'STORE_MANAGER' && mr.requested_by_user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

        const { status, department, expected_purchase_date, preferred_vendor_id, notes, lines } = req.body;

        // Cannot edit if a purchase already exists
        if (lines) {
            const purchaseCount = db.prepare('SELECT COUNT(*) as c FROM purchases WHERE material_request_id=?').get(mr.id).c;
            if (purchaseCount > 0) return res.status(400).json({ error: 'Cannot edit lines after purchase has been created' });
            // Replace lines
            db.prepare('DELETE FROM material_request_lines WHERE material_request_id=?').run(mr.id);
            const insertLine = db.prepare('INSERT INTO material_request_lines (id,material_request_id,material_id,description,quantity,expected_rate,expected_amount,remarks) VALUES (?,?,?,?,?,?,?,?)');
            for (const l of lines) {
                insertLine.run(uuidv4(), mr.id, nullify(l.material_id), l.description || null, Number(l.quantity) || 0, Number(l.expected_rate) || 0, (Number(l.quantity) || 0) * (Number(l.expected_rate) || 0), l.remarks || null);
            }
        }

        db.prepare(`UPDATE material_requests SET status=COALESCE(?,status), department=COALESCE(?,department),
        expected_purchase_date=COALESCE(?,expected_purchase_date), preferred_vendor_id=COALESCE(?,preferred_vendor_id),
        notes=COALESCE(?,notes), updated_at=datetime('now') WHERE id=?`)
            .run(status || null, department || null, expected_purchase_date || null, nullify(preferred_vendor_id), notes || null, mr.id);

        // Notifications
        if (status === 'PENDING_PURCHASE') {
            // Notify all runner boys
            const runners = db.prepare("SELECT id FROM users WHERE role='RUNNER_BOY' AND status='ACTIVE'").all();
            const accountants = db.prepare("SELECT id FROM users WHERE role='ACCOUNTANT' AND status='ACTIVE'").all();
            for (const r of [...runners, ...accountants]) {
                notify(r.id, 'New Material Request', `Request ${mr.request_no} submitted and ready for purchase`, `/requests/${mr.id}`);
            }
        }

        auditLog('MaterialRequest', mr.id, status ? `STATUS_${status}` : 'UPDATE', userId, mr, req.body, req);
        res.json({ success: true });
    } catch (err) {
        console.error('PATCH /requests error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
