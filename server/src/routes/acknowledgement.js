const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

// GET /api/purchases/:purchaseId/acknowledgement
router.get('/', authenticateToken, (req, res) => {
    try {
        const vc = db.prepare(`SELECT vc.*, u.name as runner_name
            FROM vendor_confirmations vc
            LEFT JOIN users u ON vc.runner_user_id=u.id
            WHERE vc.purchase_id=?`).get(req.params.purchaseId);
        res.json(vc || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/purchases/:purchaseId/acknowledgement  (Runner Boy only – create or update)
router.post('/', authenticateToken, requireRole('RUNNER_BOY'), (req, res) => {
    try {
        const purchaseId = req.params.purchaseId;
        const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(purchaseId);
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        if (purchase.runner_boy_user_id !== req.user.id) return res.status(403).json({ error: 'Only the assigned runner can update confirmation' });

        const { acknowledgement_status, runner_remark } = req.body;
        if (!['SHOWN_TO_VENDOR', 'VENDOR_CONFIRMED'].includes(acknowledgement_status)) {
            return res.status(400).json({ error: 'Invalid status. Use SHOWN_TO_VENDOR or VENDOR_CONFIRMED' });
        }

        const existing = db.prepare('SELECT * FROM vendor_confirmations WHERE purchase_id=?').get(purchaseId);
        const now = new Date().toISOString();

        if (existing) {
            // Update existing record
            const updates = {
                acknowledgement_status,
                runner_remark: runner_remark || existing.runner_remark || null,
                updated_at: now
            };
            if (acknowledgement_status === 'SHOWN_TO_VENDOR' && !existing.shown_to_vendor_at) {
                updates.shown_to_vendor_at = now;
            }
            if (acknowledgement_status === 'VENDOR_CONFIRMED') {
                if (!existing.shown_to_vendor_at) updates.shown_to_vendor_at = now;
                updates.vendor_confirmed_at = now;
            }

            db.prepare(`UPDATE vendor_confirmations SET
                acknowledgement_status=?, shown_to_vendor_at=COALESCE(?,shown_to_vendor_at),
                vendor_confirmed_at=COALESCE(?,vendor_confirmed_at), runner_remark=?, updated_at=?
                WHERE purchase_id=?`).run(
                updates.acknowledgement_status,
                updates.shown_to_vendor_at || null,
                updates.vendor_confirmed_at || null,
                updates.runner_remark,
                updates.updated_at,
                purchaseId
            );

            auditLog('VendorConfirmation', existing.id, `STATUS_${acknowledgement_status}`, req.user.id, existing, updates, req);
            res.json({ id: existing.id, ...updates });
        } else {
            // Create new record
            const id = uuidv4();
            const shownAt = acknowledgement_status === 'SHOWN_TO_VENDOR' || acknowledgement_status === 'VENDOR_CONFIRMED' ? now : null;
            const confirmedAt = acknowledgement_status === 'VENDOR_CONFIRMED' ? now : null;

            db.prepare(`INSERT INTO vendor_confirmations (id, purchase_id, runner_user_id, acknowledgement_status, shown_to_vendor_at, vendor_confirmed_at, runner_remark)
                VALUES (?,?,?,?,?,?,?)`).run(id, purchaseId, req.user.id, acknowledgement_status, shownAt, confirmedAt, runner_remark || null);

            auditLog('VendorConfirmation', id, 'CREATE', req.user.id, null, { purchaseId, acknowledgement_status }, req);
            res.status(201).json({ id, acknowledgement_status, shown_to_vendor_at: shownAt, vendor_confirmed_at: confirmedAt });
        }
    } catch (err) {
        console.error('POST acknowledgement error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
