-- Helpdesk D1 Schema (Assignment 2: Ticket CRUD)
-- Run: wrangler d1 execute helpdesk-db --local --file=./schema.sql
--   or: wrangler d1 execute helpdesk-db --remote --file=./schema.sql

PRAGMA foreign_keys = ON;

-- =====================================================
-- Ticket Categories (parent of TICKETS)
-- =====================================================
CREATE TABLE IF NOT EXISTS ticket_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- ⚠️ Identity (users) ไม่อยู่ใน Helpdesk domain (PRD §10.2)
-- =====================================================
-- Helpdesk ไม่ own authentication credentials หรือ user profile
-- customer_id / assigned_agent_id อ้างอิง Identity ภายนอก (campus SSO)
-- Verify ใน application layer ผ่าน src/identity.ts (stub)
-- ไม่มี FK constraint เพราะ Helpdesk ไม่รู้จัก user table ของ Identity
-- =====================================================

-- =====================================================
-- Tickets — ตารางหลักที่ assignment นี้โฟกัส
-- =====================================================
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,           -- human-readable เช่น "TKT-00001"
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','assigned','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','urgent')),
  category_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,                 -- FK (logical) → Identity.user
  assigned_agent_id INTEGER,                    -- FK (logical) → Identity.user
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id)
  -- ไม่มี FK ไปยัง Identity: customer_id / assigned_agent_id เป็น logical ref เท่านั้น
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_agent ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);

-- =====================================================
-- Tags + TICKET_TAGS (junction ตาม schema ของทีม)
-- =====================================================
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ticket_tags (
  ticket_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (ticket_id, tag_id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =====================================================
-- Seed data — categories + tags เท่านั้น
-- Users seed อยู่ใน src/identity.ts (USER_DIRECTORY) — Helpdesk ไม่ own
-- =====================================================
INSERT OR IGNORE INTO ticket_categories (id, name, description) VALUES
  (1, 'Network',  'Network connectivity / Wi-Fi / VPN issues'),
  (2, 'Hardware', 'Computer, printer, peripheral hardware problems'),
  (3, 'Software', 'Application bugs, installation, license issues'),
  (4, 'Account',  'Login, password, MFA, account access'),
  (5, 'Facility', 'Classroom, building, facility issues');

INSERT OR IGNORE INTO tags (id, name) VALUES
  (1, 'urgent'), (2, 'bug'), (3, 'hardware'),
  (4, 'software'), (5, 'network');
