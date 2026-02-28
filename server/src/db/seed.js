const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function seed() {
    const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (existing.c > 0) {
        console.log('Database already seeded. Skipping.');
        return;
    }

    console.log('Seeding database...');

    // --- Users ---
    const users = [
        { name: 'Ravi Kumar', email: 'store@textileco.com', phone: '9000000001', role: 'STORE_MANAGER', department: 'Cutting', password: 'store123' },
        { name: 'Arjun Singh', email: 'runner@textileco.com', phone: '9000000002', role: 'RUNNER_BOY', department: null, password: 'runner123' },
        { name: 'Priya Sharma', email: 'accounts@textileco.com', phone: '9000000003', role: 'ACCOUNTANT', department: 'Finance', password: 'accounts123' },
        { name: 'Suresh Mehta', email: 'ceo@textileco.com', phone: '9000000004', role: 'CEO', department: null, password: 'ceo123' },
        { name: 'Anita Patel', email: 'store2@textileco.com', phone: '9000000005', role: 'STORE_MANAGER', department: 'Stitching', password: 'store123' },
    ];

    const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, department)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    for (const u of users) {
        insertUser.run(uuidv4(), u.name, u.email, u.phone, bcrypt.hashSync(u.password, 10), u.role, u.department);
    }
    console.log('✓ Users seeded');

    // --- Vendors ---
    const vendors = [
        { name: 'Sharma Fabrics Pvt Ltd', contact_person: 'Ramesh Sharma', phone: '9111111111', address: 'Gandhi Nagar, Surat', gstin: '24AABCS1429B1ZB', notes: 'Main fabric supplier' },
        { name: 'Al-Noor Trimmings', contact_person: 'Salim Khan', phone: '9222222222', address: 'Dharavi, Mumbai', gstin: null, notes: 'Buttons, zippers, trims' },
        { name: 'Krishna Thread House', contact_person: 'Vijay Krishna', phone: '9333333333', address: 'Tirupur', gstin: '33AABCK7890A1ZC', notes: 'Thread supplier' },
        { name: 'Patel Lining Works', contact_person: 'Bharat Patel', phone: '9444444444', address: 'Ahmedabad', gstin: null, notes: 'Lining materials' },
        { name: 'Global Embroidery', contact_person: 'Anjali Gupta', phone: '9555555555', address: 'Ludhiana', gstin: '03AABCG1234D1ZE', notes: 'Embroidery patches and labels' },
    ];

    const insertVendor = db.prepare(`
    INSERT INTO vendors (id, name, contact_person, phone, address, gstin, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    const vendorIds = vendors.map(() => uuidv4());
    vendors.forEach((v, i) => insertVendor.run(vendorIds[i], v.name, v.contact_person, v.phone, v.address, v.gstin, v.notes));
    console.log('✓ Vendors seeded');

    // --- Buyers ---
    const buyers = [
        { name: 'H&M Group', code: 'HM001', contact_details: 'hm-buyer@hm.com', notes: 'European buyer' },
        { name: 'Zara International', code: 'ZR001', contact_details: 'procurement@zara.com', notes: 'Spanish buyer' },
        { name: 'Walmart Global Sourcing', code: 'WMT001', contact_details: 'sourcing@walmart.com', notes: 'US buyer' },
    ];

    const insertBuyer = db.prepare(`
    INSERT INTO buyers (id, name, code, contact_details, notes) VALUES (?, ?, ?, ?, ?)
  `);
    const buyerIds = buyers.map(() => uuidv4());
    buyers.forEach((b, i) => insertBuyer.run(buyerIds[i], b.name, b.code, b.contact_details, b.notes));
    console.log('✓ Buyers seeded');

    // --- Orders ---
    const orders = [
        { order_no: 'HM-2026-001', buyer_id: buyerIds[0], style: 'Men Casual Shirt', season: 'Spring 2026', start_date: '2026-01-01', end_date: '2026-03-31' },
        { order_no: 'HM-2026-002', buyer_id: buyerIds[0], style: 'Women Floral Dress', season: 'Spring 2026', start_date: '2026-01-15', end_date: '2026-04-15' },
        { order_no: 'ZR-2026-001', buyer_id: buyerIds[1], style: 'Denim Jacket', season: 'AW 2026', start_date: '2026-02-01', end_date: '2026-05-30' },
        { order_no: 'WMT-2026-001', buyer_id: buyerIds[2], style: 'Basic T-Shirt', season: 'SS 2026', start_date: '2026-01-01', end_date: '2026-06-30' },
    ];

    const insertOrder = db.prepare(`
    INSERT INTO orders (id, order_no, buyer_id, style, season, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    const orderIds = orders.map(() => uuidv4());
    orders.forEach((o, i) => insertOrder.run(orderIds[i], o.order_no, o.buyer_id, o.style, o.season, o.start_date, o.end_date));
    console.log('✓ Orders seeded');

    // --- Materials ---
    const materials = [
        { name: 'Cotton Fabric', category: 'Fabric', unit_of_measure: 'meter', default_rate: 85 },
        { name: 'Polyester Fabric', category: 'Fabric', unit_of_measure: 'meter', default_rate: 65 },
        { name: 'Denim Fabric', category: 'Fabric', unit_of_measure: 'meter', default_rate: 120 },
        { name: '4-Hole Button (White)', category: 'Trimming', unit_of_measure: 'piece', default_rate: 0.5 },
        { name: 'Metal Zipper 15cm', category: 'Trimming', unit_of_measure: 'piece', default_rate: 8 },
        { name: 'Polyester Thread (Black)', category: 'Thread', unit_of_measure: 'cone', default_rate: 120 },
        { name: 'Polyester Thread (White)', category: 'Thread', unit_of_measure: 'cone', default_rate: 120 },
        { name: 'Viscose Lining', category: 'Lining', unit_of_measure: 'meter', default_rate: 45 },
        { name: 'Brand Label', category: 'Label', unit_of_measure: 'piece', default_rate: 2 },
        { name: 'Care Label', category: 'Label', unit_of_measure: 'piece', default_rate: 1.5 },
        { name: 'Elastic (25mm)', category: 'Trimming', unit_of_measure: 'meter', default_rate: 12 },
    ];

    const insertMaterial = db.prepare(`
    INSERT INTO materials (id, name, category, unit_of_measure, default_rate)
    VALUES (?, ?, ?, ?, ?)
  `);
    materials.forEach(m => insertMaterial.run(uuidv4(), m.name, m.category, m.unit_of_measure, m.default_rate));
    console.log('✓ Materials seeded');

    // --- Petty Cash Ledger (today's entry) ---
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
    INSERT OR IGNORE INTO petty_cash_ledger (id, ledger_date, opening_balance, closing_balance, remarks)
    VALUES (?, ?, 25000, 25000, 'Opening balance – system start')
  `).run(uuidv4(), today);
    console.log('✓ Petty cash ledger initialized');

    console.log('\n✅ Seed complete! Test credentials:');
    console.log('  Store Manager : store@textileco.com  / store123');
    console.log('  Runner Boy    : runner@textileco.com / runner123');
    console.log('  Accountant    : accounts@textileco.com / accounts123');
    console.log('  CEO           : ceo@textileco.com    / ceo123');
}

seed();
