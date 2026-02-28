const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'petty_cash.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Apply WAL mode and foreign keys
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA foreign_keys=ON");

// Run schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Migrations for existing DBs
try { db.exec("ALTER TABLE purchases ADD COLUMN tax_invoice_path TEXT"); } catch { }
try { db.exec("ALTER TABLE purchases ADD COLUMN invoice_type_submitted TEXT NOT NULL DEFAULT 'TAX_INVOICE'"); } catch { }

module.exports = db;
