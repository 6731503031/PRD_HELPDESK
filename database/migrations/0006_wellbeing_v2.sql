-- Wellbeing (Team 16) API contract 2.0 — AI-MIGRATION-BRIEF §6, 2026-11-09.
--   npx wrangler d1 execute helpdesk-db --local  --file=./database/migrations/0006_wellbeing_v2.sql
--   npx wrangler d1 execute helpdesk-db --remote --file=./database/migrations/0006_wellbeing_v2.sql
--
-- 1) Team 16 now identifies a service by a fixed text id (e.g. srv_general_counselling) instead of a slug.
--    Store the id in a new column; the old slug column is no longer read by the code. It is kept for now
--    (the brief drops it only after the new code is live) and can be dropped later.
ALTER TABLE tickets ADD COLUMN wellbeing_service_id TEXT;

-- Old slugs → new ids. health-clinic / physiotherapy are no longer Wellbeing services → NULL.
UPDATE tickets
SET wellbeing_service_id = CASE wellbeing_service_slug
  WHEN 'counselling'        THEN 'srv_general_counselling'
  WHEN 'wellbeing-advising' THEN 'srv_general_counselling'
  ELSE NULL
END
WHERE wellbeing_service_slug IS NOT NULL;

-- 2) A category for stress, counselling and personal support, so a requester can report it.
INSERT OR IGNORE INTO ticket_categories (id, name, description) VALUES
  (6, 'Wellbeing', 'Stress, counselling and personal support (University Wellbeing)');
