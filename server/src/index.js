require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize DB (runs schema on first start)
require('./db/db');

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/master', require('./routes/master'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/purchases/:purchaseId/acknowledgement', require('./routes/acknowledgement'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/files', require('./routes/files'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Petty Cash API running on http://localhost:${PORT}`);
});
