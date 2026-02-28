-- =========================================================
-- Petty Cash Management System – SQLite Schema
-- =========================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('STORE_MANAGER','RUNNER_BOY','ACCOUNTANT','CEO')),
  department  TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  gstin          TEXT,
  ledger_code    TEXT,
  notes          TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Buyers
CREATE TABLE IF NOT EXISTS buyers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  code           TEXT UNIQUE,
  contact_details TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  order_no    TEXT NOT NULL UNIQUE,
  buyer_id    TEXT NOT NULL REFERENCES buyers(id),
  style       TEXT,
  season      TEXT,
  remarks     TEXT,
  start_date  TEXT,
  end_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED','CANCELLED')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Materials / Items master
CREATE TABLE IF NOT EXISTS materials (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'piece',
  default_rate REAL,
  notes        TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Material Requests (header)
CREATE TABLE IF NOT EXISTS material_requests (
  id                    TEXT PRIMARY KEY,
  request_no            TEXT NOT NULL UNIQUE,
  requested_by_user_id  TEXT NOT NULL REFERENCES users(id),
  department            TEXT,
  buyer_id              TEXT REFERENCES buyers(id),
  order_id              TEXT REFERENCES orders(id),
  preferred_vendor_id   TEXT REFERENCES vendors(id),
  requested_date        TEXT NOT NULL DEFAULT (date('now')),
  expected_purchase_date TEXT,
  status                TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','PENDING_PURCHASE','IN_PROGRESS','COMPLETED','CANCELLED')),
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Material Request Lines
CREATE TABLE IF NOT EXISTS material_request_lines (
  id                  TEXT PRIMARY KEY,
  material_request_id TEXT NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  material_id         TEXT REFERENCES materials(id),
  description         TEXT,
  quantity            REAL NOT NULL DEFAULT 1,
  expected_rate       REAL,
  expected_amount     REAL,
  remarks             TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id                  TEXT PRIMARY KEY,
  material_request_id TEXT NOT NULL REFERENCES material_requests(id),
  runner_boy_user_id  TEXT NOT NULL REFERENCES users(id),
  vendor_id           TEXT REFERENCES vendors(id),
  invoice_no          TEXT,
  invoice_date        TEXT,
  total_invoice_amount REAL NOT NULL DEFAULT 0,
  invoice_file_path   TEXT,
  tax_invoice_path    TEXT,
  invoice_type_submitted TEXT NOT NULL DEFAULT 'TAX_INVOICE'
    CHECK(invoice_type_submitted IN ('PROVISIONAL','TAX_INVOICE')),
  notes               TEXT,
  accountant_comment  TEXT,
  status              TEXT NOT NULL DEFAULT 'INVOICE_SUBMITTED'
    CHECK(status IN ('INVOICE_SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID','PARTIALLY_PAID','PAID_TAX_INVOICE_PENDING','COMPLETED')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Purchase Lines
CREATE TABLE IF NOT EXISTS purchase_lines (
  id          TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  material_id TEXT REFERENCES materials(id),
  description TEXT,
  quantity    REAL NOT NULL DEFAULT 1,
  rate        REAL NOT NULL DEFAULT 0,
  amount      REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id                     TEXT PRIMARY KEY,
  purchase_id            TEXT NOT NULL REFERENCES purchases(id),
  payment_date           TEXT NOT NULL,
  payment_method         TEXT NOT NULL CHECK(payment_method IN ('Cash','UPI','BankTransfer','Cheque','Other')),
  paid_amount            REAL NOT NULL,
  reference_no           TEXT,
  payment_proof_file_path TEXT,
  notes                  TEXT,
  created_by_user_id     TEXT NOT NULL REFERENCES users(id),
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Petty Cash Ledger
CREATE TABLE IF NOT EXISTS petty_cash_ledger (
  id              TEXT PRIMARY KEY,
  ledger_date     TEXT NOT NULL UNIQUE,
  opening_balance REAL NOT NULL DEFAULT 0,
  total_inflow    REAL NOT NULL DEFAULT 0,
  total_outflow   REAL NOT NULL DEFAULT 0,
  closing_balance REAL NOT NULL DEFAULT 0,
  remarks         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id                  TEXT PRIMARY KEY,
  entity_type         TEXT NOT NULL,
  entity_id           TEXT NOT NULL,
  action              TEXT NOT NULL,
  performed_by_user_id TEXT REFERENCES users(id),
  performed_at        TEXT NOT NULL DEFAULT (datetime('now')),
  old_values          TEXT,
  new_values          TEXT,
  ip_address          TEXT,
  user_agent          TEXT
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  link        TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vendor Confirmations (Runner Boy acknowledges payment shown to vendor)
CREATE TABLE IF NOT EXISTS vendor_confirmations (
  id                    TEXT PRIMARY KEY,
  purchase_id           TEXT NOT NULL REFERENCES purchases(id),
  runner_user_id        TEXT NOT NULL REFERENCES users(id),
  acknowledgement_status TEXT NOT NULL DEFAULT 'NOT_ACKNOWLEDGED'
    CHECK(acknowledgement_status IN ('NOT_ACKNOWLEDGED','SHOWN_TO_VENDOR','VENDOR_CONFIRMED')),
  shown_to_vendor_at    TEXT,
  vendor_confirmed_at   TEXT,
  runner_remark         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(purchase_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mr_requested_by ON material_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_mr_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_mr_buyer ON material_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mr_order ON material_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_mr ON purchases(material_request_id);
CREATE INDEX IF NOT EXISTS idx_purchases_runner ON purchases(runner_boy_user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_payments_purchase ON payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_vc_purchase ON vendor_confirmations(purchase_id);
CREATE INDEX IF NOT EXISTS idx_vc_runner ON vendor_confirmations(runner_user_id);
