-- =====================================================================
-- Migration 0002 — Final features (PRD v1.0)
-- For the EXISTING database (local or remote) that already has the
-- Assignment 2 schema + 0001_add_wellbeing_slug.
--
--   npm run db:local:migrate
--   npm run db:remote:migrate      (production — run ONCE)
--
-- A fresh database does not need this: schema.sql already contains it.
-- =====================================================================

-- Categories: active/deactivated state (PRD §10.1, Admin)
ALTER TABLE ticket_categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Maintenance link + last known status (PRD §6)
ALTER TABLE tickets ADD COLUMN maintenance_work_order_id TEXT;
ALTER TABLE tickets ADD COLUMN maintenance_status TEXT;
ALTER TABLE tickets ADD COLUMN maintenance_status_at TEXT;

-- Escalation marker (PRD §14)
ALTER TABLE tickets ADD COLUMN escalated_at TEXT;

-- AI triage suggestion kept on the ticket for the agent (PRD §8.1, FR-10) — advisory only
ALTER TABLE tickets ADD COLUMN ai_category_id INTEGER;
ALTER TABLE tickets ADD COLUMN ai_priority TEXT;
ALTER TABLE tickets ADD COLUMN ai_route TEXT;
ALTER TABLE tickets ADD COLUMN ai_source TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets(status, priority, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_work_order
  ON tickets(maintenance_work_order_id) WHERE maintenance_work_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by INTEGER,
  source TEXT NOT NULL DEFAULT 'helpdesk',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_history_ticket ON ticket_status_history(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS domain_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending','delivered','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_status ON domain_events(delivery_status, created_at);
