const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'petty_cash_secret_key_2026';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
        // ACCOUNTANT is super-admin — full access to everything
        if (req.user.role === 'ACCOUNTANT') return next();
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET };
