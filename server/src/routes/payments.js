const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog, notify } = require('../middleware/auditLog');
const upload = require('../middleware/upload');

// GET /api/payments  (for a specific purchase or all)
router.get('/', authenticateToken, (req, res) => {
    const { purchase_id } = req.query;
    let sql = `SELECT py.*, u.name as created_by_name FROM payments py
    LEFT JOIN users u ON py.created_by_user_id=u.id WHERE 1=1`;
    const params = [];
    if (purchase_id) { sql += ' AND py.purchase_id=?'; params.push(purchase_id); }
    sql += ' ORDER BY py.payment_date DESC';
    res.json(db.prepare(sql).all(...params));
});

// POST /api/payments  (Accountant records payment)
router.post('/', authenticateToken, requireRole('ACCOUNTANT'), (req, res) => {
    const { purchase_id, payment_date, payment_method, paid_amount, reference_no, notes } = req.body;
    if (!purchase_id || !payment_date || !payment_method || !paid_amount) {
        return res.status(400).json({ error: 'purchase_id, payment_date, payment_method, paid_amount required' });
    }

    const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(purchase_id);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    if (purchase.status === 'REJECTED') return res.status(400).json({ error: 'Cannot pay a rejected purchase' });
    if (!['APPROVED', 'PARTIALLY_PAID'].includes(purchase.status)) return res.status(400).json({ error: 'Purchase must be APPROVED before payment' });

    const id = uuidv4();
    db.prepare(`INSERT INTO payments (id,purchase_id,payment_date,payment_method,paid_amount,reference_no,notes,created_by_user_id)
    VALUES (?,?,?,?,?,?,?,?)`).run(id, purchase_id, payment_date, payment_method, paid_amount, reference_no || null, notes || null, req.user.id);

    // Compute cumulative paid
    const totalPaid = db.prepare('SELECT COALESCE(SUM(paid_amount),0) as total FROM payments WHERE purchase_id=?').get(purchase_id).total;
    let newStatus;
    if (totalPaid >= purchase.total_invoice_amount) {
        // If original was provisional and tax invoice not yet uploaded, mark as pending
        newStatus = (purchase.invoice_type_submitted === 'PROVISIONAL' && !purchase.tax_invoice_path) ? 'PAID_TAX_INVOICE_PENDING' : 'PAID';
    } else {
        newStatus = 'PARTIALLY_PAID';
    }
    db.prepare("UPDATE purchases SET status=?, updated_at=datetime('now') WHERE id=?").run(newStatus, purchase_id);

    // Update petty cash ledger
    const today = payment_date;
    const existing = db.prepare('SELECT * FROM petty_cash_ledger WHERE ledger_date=?').get(today);
    if (existing) {
        db.prepare("UPDATE petty_cash_ledger SET total_outflow=total_outflow+?, closing_balance=closing_balance-?, updated_at=datetime('now') WHERE ledger_date=?")
            .run(paid_amount, paid_amount, today);
    } else {
        // Get previous day's closing balance
        const prev = db.prepare('SELECT closing_balance FROM petty_cash_ledger ORDER BY ledger_date DESC LIMIT 1').get();
        const opening = prev ? prev.closing_balance : 0;
        db.prepare('INSERT INTO petty_cash_ledger (id,ledger_date,opening_balance,total_outflow,closing_balance) VALUES (?,?,?,?,?)')
            .run(uuidv4(), today, opening, paid_amount, opening - paid_amount);
    }

    // Notify runner boy and store manager
    const mr = db.prepare('SELECT * FROM material_requests WHERE id=?').get(purchase.material_request_id);
    notify(purchase.runner_boy_user_id, 'Payment Recorded – Confirmation Required',
        `Payment of \u20B9${paid_amount} recorded for purchase ${purchase.invoice_no || purchase_id.slice(0, 8)}. Please view payment proof and confirm with vendor.`,
        `/purchases/${purchase_id}`);
    if (mr) notify(mr.requested_by_user_id, 'Payment Recorded', `Payment recorded for your request ${mr.request_no}`, `/purchases/${purchase_id}`);

    // Initialize vendor confirmation record if not existing
    const existingVc = db.prepare('SELECT id FROM vendor_confirmations WHERE purchase_id=?').get(purchase_id);
    if (!existingVc) {
        db.prepare(`INSERT INTO vendor_confirmations (id, purchase_id, runner_user_id, acknowledgement_status)
            VALUES (?,?,?,'NOT_ACKNOWLEDGED')`).run(uuidv4(), purchase_id, purchase.runner_boy_user_id);
    }

    auditLog('Payment', id, 'CREATE', req.user.id, null, { purchase_id, paid_amount, newStatus }, req);
    res.status(201).json({ id, status: newStatus });
});

// POST /api/payments/:id/proof  (upload payment proof)
router.post('/:id/proof', authenticateToken, requireRole('ACCOUNTANT'), (req, res, next) => {
    req.uploadFolder = 'payment-proofs';
    next();
}, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = path.join('payment-proofs', req.file.filename);
    db.prepare('UPDATE payments SET payment_proof_file_path=? WHERE id=?').run(filePath, req.params.id);
    res.json({ file_path: filePath });
});

module.exports = router;
