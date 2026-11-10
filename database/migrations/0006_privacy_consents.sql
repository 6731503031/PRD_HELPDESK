-- 0006: PDPA consent log (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562).
--
-- One row per action, never updated or deleted: it is the evidence of WHEN a person accepted (or withdrew)
-- WHICH version of the privacy notice (PDPA s.19: the controller must be able to show consent was given).
-- The current state of a person = their newest row. The notice text is in frontend/src/lib/privacy.ts.
--
--   npx wrangler d1 execute helpdesk-db --local  --file=./database/migrations/0006_privacy_consents.sql
--   npx wrangler d1 execute helpdesk-db --remote --file=./database/migrations/0006_privacy_consents.sql

CREATE TABLE IF NOT EXISTS privacy_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,                 -- Identity id (static directory or guest >= 1000)
  notice_version TEXT NOT NULL,             -- e.g. '1.0'
  action TEXT NOT NULL CHECK (action IN ('accepted', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_privacy_consents_user ON privacy_consents(user_id, id);
