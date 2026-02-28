const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog, notify } = require('../middleware/auditLog');
const upload = require('../middleware/upload');

const nullify = v => (v === '' || v === undefined) ? null : v;

// GET /api/purchases
router.get('/', authenticateToken, (req, res) => {
    const { role, id: userId } = req.user;
    const { status, vendor_id, runner_id, from, to, buyer_id, order_id } = req.query;

    let sql = `SELECT p.*, mr.request_no, mr.department,
    u.name as runner_name, v.name as vendor_name,
    b.name as buyer_name, o.order_no, o.style,
    (SELECT SUM(amount) FROM purchase_lines WHERE purchase_id=p.id) as computed_total,
    (SELECT COALESCE(SUM(paid_amount),0) FROM payments WHERE purchase_id=p.id) as total_paid,
    vc.acknowledgement_status
    FROM purchases p
    LEFT JOIN material_requests mr ON p.material_request_id=mr.id
    LEFT JOIN users u ON p.runner_boy_user_id=u.id
    LEFT JOIN vendors v ON p.vendor_id=v.id
    LEFT JOIN buyers b ON mr.buyer_id=b.id
    LEFT JOIN orders o ON mr.order_id=o.id
    LEFT JOIN vendor_confirmations vc ON vc.purchase_id=p.id
    WHERE 1=1`;
    const params = [];

    if (role === 'RUNNER_BOY') { sql += ' AND p.runner_boy_user_id=?'; params.push(userId); }
    if (status) { sql += ' AND p.status=?'; params.push(status); }
    if (vendor_id) { sql += ' AND p.vendor_id=?'; params.push(vendor_id); }
    if (runner_id) { sql += ' AND p.runner_boy_user_id=?'; params.push(runner_id); }
    if (buyer_id) { sql += ' AND mr.buyer_id=?'; params.push(buyer_id); }
    if (order_id) { sql += ' AND mr.order_id=?'; params.push(order_id); }
    if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
    if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
    sql += ' ORDER BY p.created_at DESC';
    res.json(db.prepare(sql).all(...params));
});

// GET /api/purchases/:id  (with lines and payments)
router.get('/:id', authenticateToken, (req, res) => {
    const p = db.prepare(`SELECT p.*, mr.request_no, mr.department,
    u.name as runner_name, v.name as vendor_name,
    v.phone as vendor_phone, v.email as vendor_email, v.contact_person as vendor_contact_person, v.gstin as vendor_gstin,
    b.name as buyer_name, o.order_no, o.style,
    (SELECT COALESCE(SUM(paid_amount),0) FROM payments WHERE purchase_id=p.id) as total_paid,
    (SELECT SUM(expected_amount) FROM material_request_lines WHERE material_request_id=mr.id) as total_expected
    FROM purchases p
    LEFT JOIN material_requests mr ON p.material_request_id=mr.id
    LEFT JOIN users u ON p.runner_boy_user_id=u.id
    LEFT JOIN vendors v ON p.vendor_id=v.id
    LEFT JOIN buyers b ON mr.buyer_id=b.id
    LEFT JOIN orders o ON mr.order_id=o.id
    WHERE p.id=?`).get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });

    const lines = db.prepare(`SELECT pl.*, m.name as material_name, m.unit_of_measure
    FROM purchase_lines pl LEFT JOIN materials m ON pl.material_id=m.id
    WHERE pl.purchase_id=?`).all(req.params.id);

    const payments = db.prepare(`SELECT py.*, u.name as created_by_name
    FROM payments py LEFT JOIN users u ON py.created_by_user_id=u.id
    WHERE py.purchase_id=? ORDER BY py.payment_date DESC`).all(req.params.id);

    const requestLines = db.prepare(`SELECT l.*, m.name as material_name, m.unit_of_measure
    FROM material_request_lines l LEFT JOIN materials m ON l.material_id=m.id
    WHERE l.material_request_id=?`).all(p.material_request_id);

    const vendorConfirmation = db.prepare(`SELECT vc.*, u.name as runner_name
    FROM vendor_confirmations vc LEFT JOIN users u ON vc.runner_user_id=u.id
    WHERE vc.purchase_id=?`).get(req.params.id) || null;

    res.json({ ...p, lines, payments, requestLines, vendorConfirmation });
});

// POST /api/purchases  (Runner Boy creates a purchase)
router.post('/', authenticateToken, requireRole('RUNNER_BOY'), (req, res) => {
    try {
        const { material_request_id, vendor_id, invoice_no, invoice_date, total_invoice_amount, notes, lines, invoice_type_submitted } = req.body;
        if (!material_request_id) return res.status(400).json({ error: 'material_request_id required' });
        const invoiceType = ['PROVISIONAL', 'TAX_INVOICE'].includes(invoice_type_submitted) ? invoice_type_submitted : 'TAX_INVOICE';

        const mr = db.prepare('SELECT * FROM material_requests WHERE id=?').get(material_request_id);
        if (!mr) return res.status(404).json({ error: 'Material request not found' });
        if (!['PENDING_PURCHASE', 'IN_PROGRESS'].includes(mr.status)) return res.status(400).json({ error: 'Request is not in a purchasable state' });

        const id = uuidv4();
        db.prepare(`INSERT INTO purchases (id,material_request_id,runner_boy_user_id,vendor_id,invoice_no,invoice_date,total_invoice_amount,notes,invoice_type_submitted,status)
        VALUES (?,?,?,?,?,?,?,?,?,'INVOICE_SUBMITTED')`).run(id, material_request_id, req.user.id, vendor_id, invoice_no || null, invoice_date || null, total_invoice_amount || 0, notes || null, invoiceType);

        if (lines && lines.length > 0) {
            const insertLine = db.prepare('INSERT INTO purchase_lines (id,purchase_id,material_id,description,quantity,rate,amount) VALUES (?,?,?,?,?,?,?)');
            for (const l of lines) insertLine.run(uuidv4(), id, nullify(l.material_id), l.description || null, l.quantity || 0, l.actual_rate || l.rate || 0, (l.quantity || 0) * (l.actual_rate || l.rate || 0));
        }

        db.prepare("UPDATE material_requests SET status='IN_PROGRESS', updated_at=datetime('now') WHERE id=?").run(material_request_id);

        const typeLabel = invoiceType === 'PROVISIONAL' ? 'Provisional Invoice' : 'Tax Invoice';
        const accountants = db.prepare("SELECT id FROM users WHERE role='ACCOUNTANT' AND status='ACTIVE'").all();
        for (const a of accountants) {
            notify(a.id, 'Invoice Submitted', `Runner ${req.user.name || 'Unknown'} submitted ${typeLabel} for ${mr.request_no}`, `/purchases/${id}`);
        }

        auditLog('Purchase', id, 'CREATE', req.user.id, null, { material_request_id, status: 'INVOICE_SUBMITTED', invoice_type_submitted: invoiceType }, req);
        res.status(201).json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/purchases/:id/invoice  (upload invoice file)
router.post('/:id/invoice', authenticateToken, requireRole('RUNNER_BOY'), (req, res, next) => {
    req.uploadFolder = 'invoices';
    next();
}, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = path.join('invoices', req.file.filename);
    db.prepare("UPDATE purchases SET invoice_file_path=?, updated_at=datetime('now') WHERE id=?").run(filePath, req.params.id);
    res.json({ file_path: filePath });
});

// PATCH /api/purchases/:id/approve (Accountant)
router.patch('/:id/approve', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Not found' });
    const { accountant_comment } = req.body;
    db.prepare("UPDATE purchases SET status='APPROVED', accountant_comment=COALESCE(?,accountant_comment), updated_at=datetime('now') WHERE id=?")
        .run(accountant_comment || null, req.params.id);

    const mr = db.prepare('SELECT * FROM material_requests WHERE id=?').get(purchase.material_request_id);
    notify(purchase.runner_boy_user_id, 'Purchase Approved', `Your purchase for ${mr?.request_no} has been approved`, `/purchases/${purchase.id}`);
    if (mr) notify(mr.requested_by_user_id, 'Purchase Approved', `Purchase for your request ${mr.request_no} approved`, `/purchases/${purchase.id}`);

    auditLog('Purchase', purchase.id, 'APPROVE', req.user.id, purchase, { status: 'APPROVED' }, req);
    res.json({ success: true });
});

// PATCH /api/purchases/:id/reject (Accountant)
router.patch('/:id/reject', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Not found' });
    const { accountant_comment } = req.body;
    db.prepare("UPDATE purchases SET status='REJECTED', accountant_comment=COALESCE(?,accountant_comment), updated_at=datetime('now') WHERE id=?")
        .run(accountant_comment || null, req.params.id);

    const mr = db.prepare('SELECT * FROM material_requests WHERE id=?').get(purchase.material_request_id);
    notify(purchase.runner_boy_user_id, 'Purchase Rejected', `Your purchase for ${mr?.request_no} was rejected. Reason: ${accountant_comment || 'See details'}`, `/purchases/${purchase.id}`);
    if (mr) notify(mr.requested_by_user_id, 'Purchase Rejected', `Purchase for ${mr.request_no} was rejected`, `/purchases/${purchase.id}`);

    auditLog('Purchase', purchase.id, 'REJECT', req.user.id, purchase, { status: 'REJECTED', accountant_comment }, req);
    res.json({ success: true });
});

// POST /api/purchases/:id/tax-invoice  (Runner uploads final tax invoice)
router.post('/:id/tax-invoice', authenticateToken, requireRole('RUNNER_BOY'), (req, res, next) => {
    req.uploadFolder = 'invoices';
    next();
}, upload.single('file'), (req, res) => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Not found' });
    if (purchase.runner_boy_user_id !== req.user.id) return res.status(403).json({ error: 'Only the assigned Runner Boy can upload the tax invoice' });
    if (purchase.invoice_type_submitted !== 'PROVISIONAL') return res.status(400).json({ error: 'Tax invoice upload only applicable for provisional invoice purchases' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = path.join('invoices', req.file.filename);
    const newStatus = ['PAID', 'PARTIALLY_PAID', 'PAID_TAX_INVOICE_PENDING'].includes(purchase.status) ? 'COMPLETED' : purchase.status;
    db.prepare("UPDATE purchases SET tax_invoice_path=?, status=?, updated_at=datetime('now') WHERE id=?").run(filePath, newStatus, req.params.id);

    // Notify accountants
    const mr = db.prepare('SELECT * FROM material_requests WHERE id=?').get(purchase.material_request_id);
    const accountants = db.prepare("SELECT id FROM users WHERE role='ACCOUNTANT' AND status='ACTIVE'").all();
    for (const a of accountants) {
        notify(a.id, 'Tax Invoice Uploaded', `Runner ${req.user.name} uploaded final Tax Invoice for ${mr?.request_no || 'purchase'}`, `/purchases/${purchase.id}`);
    }

    auditLog('Purchase', purchase.id, 'TAX_INVOICE_UPLOAD', req.user.id, purchase, { status: newStatus, tax_invoice_path: filePath }, req);
    res.json({ file_path: filePath, status: newStatus });
});

module.exports = router;
