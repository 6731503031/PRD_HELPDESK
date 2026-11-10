-- 0007: referrals to Wellbeing (Team 16) — see backend/src/modules/wellbeing/referral.ts
-- Safe to run more than once. Run it BEFORE setting WELLBEING_REFERRALS = 'on'.
--   npm run db:local:referrals    /    npm run db:remote:referrals
--
-- Holds no personal data: `ref` is random and is the only id Team 16 sees; the requester is found via ticket_id.
CREATE TABLE IF NOT EXISTS wellbeing_referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  ref TEXT NOT NULL UNIQUE,                        -- "hd-" + 32 random hex characters
  service_id TEXT,                                 -- Team 16 service suggested (srv_…), may be NULL
  status TEXT NOT NULL CHECK (status IN ('sent','approved','declined','cancelled','withdrawn')),
  wellbeing_id TEXT,                               -- Team 16's own id for the referral, if they return one
  consent_at TEXT NOT NULL,                        -- when the requester ticked the referral consent (ISO 8601)
  status_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wellbeing_referrals_ticket ON wellbeing_referrals(ticket_id, id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_referrals_status ON wellbeing_referrals(status);
