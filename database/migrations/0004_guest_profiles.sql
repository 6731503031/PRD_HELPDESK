-- 0004: anonymous requesters ("guests") + no internal notes (PRD v1.1).
--
-- 1) user_profiles: a guest picks a display name (and optional contact email) on first sign-in.
--    Guest ids start at 1000 so they never collide with the static Identity stub directory (ids 1-6).
--    Guests are always role 'customer' — the admin is never created from here.
-- 2) Internal notes are cut from the PRD: delete any that exist. The `visibility` column stays
--    (SQLite cannot safely drop a CHECK-constrained column); the API no longer reads or writes it.
--
-- Local:      npx wrangler d1 execute helpdesk-db --local  --file=./database/migrations/0004_guest_profiles.sql
-- Production: run only after P1 approves (same command with --remote) — it DELETES internal notes.

CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

DELETE FROM ticket_comments WHERE visibility = 'internal';
