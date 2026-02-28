const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

function auditLog(entityType, entityId, action, userId, oldValues, newValues, req) {
    try {
        db.prepare(`
      INSERT INTO audit_log (id, entity_type, entity_id, action, performed_by_user_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            uuidv4(),
            entityType,
            entityId,
            action,
            userId || null,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            req ? (req.ip || req.connection?.remoteAddress || null) : null,
            req ? (req.headers?.['user-agent'] || null) : null
        );
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

function notify(userId, title, message, link) {
    try {
        db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, link)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, title, message, link || null);
    } catch (err) {
        console.error('Notification error:', err.message);
    }
}

module.exports = { auditLog, notify };
