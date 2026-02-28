const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// GET /api/files/:folder/:filename  (secure file serving)
router.get('/:folder/:filename', authenticateToken, (req, res) => {
    const { folder, filename } = req.params;
    // Prevent path traversal
    const safeName = path.basename(filename);
    const safeFolder = path.basename(folder);
    const filePath = path.join(UPLOADS_DIR, safeFolder, safeName);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
});

module.exports = router;
