const express = require('express');
const router = express.Router();
const db = require('../db/db');
const ExcelJS = require('exceljs');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Helper: apply common filters
function applyFilters(sql, params, q) {
    if (q.from) { sql += ' AND date_col>=?'; params.push(q.from); }
    if (q.to) { sql += ' AND date_col<=?'; params.push(q.to); }
    return sql;
}

// 1. Daily Petty Cash Summary  GET /api/reports/daily-summary
router.get('/daily-summary', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const { from, to } = req.query;
    let sql = `SELECT py.payment_date as date,
    COUNT(DISTINCT py.purchase_id) as num_purchases,
    SUM(py.paid_amount) as total_paid,
    GROUP_CONCAT(DISTINCT mr.department) as departments
    FROM payments py
    LEFT JOIN purchases p ON py.purchase_id=p.id
    LEFT JOIN material_requests mr ON p.material_request_id=mr.id
    WHERE 1=1`;
    const params = [];
    if (from) { sql += ' AND py.payment_date>=?'; params.push(from); }
    if (to) { sql += ' AND py.payment_date<=?'; params.push(to); }
    sql += ' GROUP BY py.payment_date ORDER BY py.payment_date DESC';

    const rows = db.prepare(sql).all(...params);

    // Merge with ledger data
    const ledger = db.prepare('SELECT * FROM petty_cash_ledger ORDER BY ledger_date DESC').all();
    const ledgerMap = {};
    ledger.forEach(l => ledgerMap[l.ledger_date] = l);

    const result = rows.map(r => ({ ...r, ...(ledgerMap[r.date] || {}) }));
    res.json(result);
});

// 2. Vendor-wise Purchase Report  GET /api/reports/vendor-summary
router.get('/vendor-summary', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const { from, to, vendor_id } = req.query;
    let sql = `SELECT v.id as vendor_id, v.name as vendor_name, v.phone,
    COUNT(p.id) as num_invoices,
    SUM(p.total_invoice_amount) as total_amount,
    AVG(p.total_invoice_amount) as avg_amount
    FROM purchases p
    LEFT JOIN vendors v ON p.vendor_id=v.id
    WHERE p.status NOT IN ('REJECTED')`;
    const params = [];
    if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
    if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
    if (vendor_id) { sql += ' AND p.vendor_id=?'; params.push(vendor_id); }
    sql += ' GROUP BY v.id ORDER BY total_amount DESC';
    res.json(db.prepare(sql).all(...params));
});

// 3. Buyer/Order-wise Material Cost  GET /api/reports/buyer-order
router.get('/buyer-order', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const { from, to, buyer_id, order_id } = req.query;
    let sql = `SELECT b.name as buyer_name, o.order_no, o.style,
    m.name as material_name, m.category,
    SUM(pl.quantity) as total_qty, m.unit_of_measure,
    SUM(pl.amount) as total_cost,
    COUNT(DISTINCT p.id) as num_purchases
    FROM purchase_lines pl
    LEFT JOIN purchases p ON pl.purchase_id=p.id
    LEFT JOIN material_requests mr ON p.material_request_id=mr.id
    LEFT JOIN buyers b ON mr.buyer_id=b.id
    LEFT JOIN orders o ON mr.order_id=o.id
    LEFT JOIN materials m ON pl.material_id=m.id
    WHERE p.status NOT IN ('REJECTED')`;
    const params = [];
    if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
    if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
    if (buyer_id) { sql += ' AND mr.buyer_id=?'; params.push(buyer_id); }
    if (order_id) { sql += ' AND mr.order_id=?'; params.push(order_id); }
    sql += ' GROUP BY b.id, o.id, m.id ORDER BY b.name, o.order_no, total_cost DESC';
    res.json(db.prepare(sql).all(...params));
});

// 4. Runner Boy Performance  GET /api/reports/runner-performance
router.get('/runner-performance', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const { from, to } = req.query;
    let sql = `SELECT u.id, u.name as runner_name,
    COUNT(p.id) as num_purchases,
    SUM(p.total_invoice_amount) as total_amount,
    AVG(p.total_invoice_amount) as avg_amount
    FROM purchases p
    LEFT JOIN users u ON p.runner_boy_user_id=u.id
    WHERE p.status NOT IN ('REJECTED') AND u.role='RUNNER_BOY'`;
    const params = [];
    if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
    if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
    sql += ' GROUP BY u.id ORDER BY total_amount DESC';
    res.json(db.prepare(sql).all(...params));
});

// 5. Outstanding / Partially Paid  GET /api/reports/outstanding
router.get('/outstanding', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const { from, to, vendor_id } = req.query;
    let sql = `SELECT p.id, mr.request_no, p.invoice_no, p.invoice_date,
    v.name as vendor_name, u.name as runner_name,
    b.name as buyer_name, o.order_no,
    p.total_invoice_amount,
    COALESCE((SELECT SUM(paid_amount) FROM payments WHERE purchase_id=p.id),0) as total_paid,
    p.total_invoice_amount - COALESCE((SELECT SUM(paid_amount) FROM payments WHERE purchase_id=p.id),0) as balance,
    p.status
    FROM purchases p
    LEFT JOIN material_requests mr ON p.material_request_id=mr.id
    LEFT JOIN vendors v ON p.vendor_id=v.id
    LEFT JOIN users u ON p.runner_boy_user_id=u.id
    LEFT JOIN buyers b ON mr.buyer_id=b.id
    LEFT JOIN orders o ON mr.order_id=o.id
    WHERE p.status IN ('APPROVED','PARTIALLY_PAID','INVOICE_SUBMITTED','UNDER_REVIEW')`;
    const params = [];
    if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
    if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
    if (vendor_id) { sql += ' AND p.vendor_id=?'; params.push(vendor_id); }
    sql += ' ORDER BY p.invoice_date ASC';
    res.json(db.prepare(sql).all(...params));
});

// GET /api/reports/dashboard  (CEO KPI cards + chart data)
router.get('/dashboard', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), (req, res) => {
    const { from, to } = req.query;
    const dateFilter = from && to ? `AND p.invoice_date BETWEEN '${from}' AND '${to}'` : '';

    const totalRequests = db.prepare('SELECT COUNT(*) as c FROM material_requests').get().c;
    const pendingPurchases = db.prepare("SELECT COUNT(*) as c FROM purchases WHERE status IN ('INVOICE_SUBMITTED','UNDER_REVIEW')").get().c;
    const approvedUnpaid = db.prepare("SELECT COUNT(*) as c FROM purchases WHERE status IN ('APPROVED','PARTIALLY_PAID')").get().c;
    const totalPaid = db.prepare(`SELECT COALESCE(SUM(paid_amount),0) as t FROM payments py LEFT JOIN purchases p ON py.purchase_id=p.id WHERE 1=1 ${dateFilter.replace(/p\.invoice_date/g, 'py.payment_date')}`).get().t;
    const totalInvoiced = db.prepare(`SELECT COALESCE(SUM(total_invoice_amount),0) as t FROM purchases p WHERE status NOT IN ('REJECTED') ${dateFilter}`).get().t;

    // Monthly trend (last 6 months)
    const monthlyTrend = db.prepare(`
    SELECT strftime('%Y-%m', py.payment_date) as month,
    SUM(py.paid_amount) as total_paid, COUNT(*) as num_payments
    FROM payments py
    GROUP BY strftime('%Y-%m', py.payment_date)
    ORDER BY month DESC LIMIT 6`).all().reverse();

    // Top vendors
    const topVendors = db.prepare(`
    SELECT v.name, SUM(p.total_invoice_amount) as total
    FROM purchases p LEFT JOIN vendors v ON p.vendor_id=v.id
    WHERE p.status NOT IN ('REJECTED')
    GROUP BY v.id ORDER BY total DESC LIMIT 5`).all();

    // Status breakdown
    const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM purchases GROUP BY status`).all();

    res.json({ totalRequests, pendingPurchases, approvedUnpaid, totalPaid, totalInvoiced, monthlyTrend, topVendors, statusBreakdown });
});

// GET /api/reports/export/:type  (export to Excel)
router.get('/export/:type', authenticateToken, requireRole('ACCOUNTANT', 'CEO'), async (req, res) => {
    const { type } = req.params;
    const { from, to, vendor_id, buyer_id, order_id } = req.query;

    let rows = [];
    let sheetName = type;
    let columns = [];

    if (type === 'daily-summary') {
        let sql = `SELECT py.payment_date as Date, COUNT(DISTINCT py.purchase_id) as "Purchases", SUM(py.paid_amount) as "Total Paid (₹)"
      FROM payments py WHERE 1=1`;
        const params = [];
        if (from) { sql += ' AND py.payment_date>=?'; params.push(from); }
        if (to) { sql += ' AND py.payment_date<=?'; params.push(to); }
        sql += ' GROUP BY py.payment_date ORDER BY py.payment_date DESC';
        rows = db.prepare(sql).all(...params);
    } else if (type === 'vendor-summary') {
        const params = [];
        let sql = `SELECT v.name as Vendor, COUNT(p.id) as Invoices, SUM(p.total_invoice_amount) as "Total (₹)", AVG(p.total_invoice_amount) as "Avg (₹)"
      FROM purchases p LEFT JOIN vendors v ON p.vendor_id=v.id WHERE p.status NOT IN ('REJECTED')`;
        if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
        if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
        sql += ' GROUP BY v.id ORDER BY "Total (₹)" DESC';
        rows = db.prepare(sql).all(...params);
    } else if (type === 'outstanding') {
        const params = [];
        let sql = `SELECT mr.request_no as "Request No", p.invoice_no as "Invoice No", p.invoice_date as Date,
      v.name as Vendor, b.name as Buyer, o.order_no as Order,
      p.total_invoice_amount as "Invoice (₹)", COALESCE((SELECT SUM(paid_amount) FROM payments WHERE purchase_id=p.id),0) as "Paid (₹)",
      p.total_invoice_amount - COALESCE((SELECT SUM(paid_amount) FROM payments WHERE purchase_id=p.id),0) as "Balance (₹)", p.status as Status
      FROM purchases p
      LEFT JOIN material_requests mr ON p.material_request_id=mr.id
      LEFT JOIN vendors v ON p.vendor_id=v.id
      LEFT JOIN buyers b ON mr.buyer_id=b.id
      LEFT JOIN orders o ON mr.order_id=o.id
      WHERE p.status IN ('APPROVED','PARTIALLY_PAID','INVOICE_SUBMITTED','UNDER_REVIEW')`;
        if (from) { sql += ' AND p.invoice_date>=?'; params.push(from); }
        if (to) { sql += ' AND p.invoice_date<=?'; params.push(to); }
        rows = db.prepare(sql).all(...params);
    } else {
        return res.status(400).json({ error: 'Unknown report type' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    if (rows.length > 0) {
        sheet.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 20 }));
        sheet.getRow(1).font = { bold: true };
        rows.forEach(r => sheet.addRow(r));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
});

module.exports = router;
