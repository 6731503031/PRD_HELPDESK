-- =====================================================================
-- Helpdesk D1 schema — FULL (fresh database)
-- PRD v1.0 §10 Data Model + §6 Maintenance + §7 Events
--
-- Fresh local DB:    npm run db:local:fresh
-- Existing DB (prod): DO NOT run this file — run migrations/0002_final_features.sql
--
-- Naming note: PRD uses subject / requester_id / assignee_id.
-- This schema keeps the Assignment 2 names title / customer_id / assigned_agent_id
-- (same meaning) so existing data and Postman tests keep working.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Categories (PRD §10.1: id, name, active/deactivated state)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Identity (users) is NOT owned by Helpdesk (PRD §10.2, §11).
-- customer_id / assigned_agent_id / author_id are logical references to
-- Identity — no FK, no users table. See src/core/identity.ts (stub).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Tickets (PRD §10.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,              -- "TKT-00012", derived from id
  title TEXT NOT NULL,                             -- PRD: subject
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','assigned','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','urgent')),
  category_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,                    -- PRD: requester_id (Identity ref)
  assigned_agent_id INTEGER,                       -- PRD: assignee_id (Identity ref)
  resolution_note TEXT,
  wellbeing_service_slug TEXT,                     -- A5 Team 16: public catalogue slug only
  maintenance_work_order_id TEXT,                  -- PRD §6.1: the ONLY Maintenance data we store
  maintenance_status TEXT,                         -- last status received via webhook (display only)
  maintenance_status_at TEXT,
  escalated_at TEXT,                               -- PRD §14: set once when ticket.escalated is published
  ai_category_id INTEGER,                          -- PRD §8: triage suggestion kept for the agent (advisory only)
  ai_priority TEXT,
  ai_route TEXT,                                   -- helpdesk | maintenance | it_support | wellbeing
  ai_source TEXT,                                  -- 'ai' | 'fallback'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_agent    ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_queue    ON tickets(status, priority, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_work_order
  ON tickets(maintenance_work_order_id) WHERE maintenance_work_order_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Status history (PRD FR-06: requester can view status history)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by INTEGER,                              -- Identity ref; NULL = system/Maintenance
  source TEXT NOT NULL DEFAULT 'helpdesk',         -- 'helpdesk' | 'maintenance' | 'system'
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_history_ticket ON ticket_status_history(ticket_id, created_at);

-- ---------------------------------------------------------------------
-- Comments (PRD §10.1: id, ticket_id, author_id, content, visibility, timestamp)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,                      -- Identity ref
  content TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id, created_at);

-- ---------------------------------------------------------------------
-- Inbound webhook dedupe (PRD §18: duplicate event handling)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,                            -- 'maintenance'
  type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Outbound events / outbox (PRD §7: ticket.created / escalated / resolved)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domain_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,                           -- "ticket:TKT-00012"
  payload TEXT NOT NULL,                           -- JSON envelope
  delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending','delivered','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_status ON domain_events(delivery_status, created_at);

-- ---------------------------------------------------------------------
-- Tags (Assignment 2 — kept)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------
INSERT OR IGNORE INTO ticket_categories (id, name, description) VALUES
  (1, 'Network',  'Network connectivity / Wi-Fi / VPN issues'),
  (2, 'Hardware', 'Computer, printer, peripheral hardware problems'),
  (3, 'Software', 'Application bugs, installation, license issues'),
  (4, 'Account',  'Login, password, MFA, account access'),
  (5, 'Facility', 'Classroom, building, facility issues');

INSERT OR IGNORE INTO tags (id, name) VALUES
  (1, 'urgent'), (2, 'bug'), (3, 'hardware'), (4, 'software'), (5, 'network');
