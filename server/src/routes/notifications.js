const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticateToken, (req, res) => {
    const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    const unreadCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c;
    res.json({ notifications: notifs, unreadCount });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticateToken, (req, res) => {
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
    res.json({ success: true });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticateToken, (req, res) => {
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    res.json({ success: true });
});

module.exports = router;
