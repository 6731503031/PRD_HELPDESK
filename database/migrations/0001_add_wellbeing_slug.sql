-- A5: Wellbeing (Team 16) integration
-- Adds a stable reference to a public Wellbeing service catalogue entry.
-- Deliberately NOT a case_id/appointment_id/wellbeing_record_id — the contract
-- forbids linking a ticket to a private Wellbeing case (see Integration Contract §2).
--
-- Run: wrangler d1 execute helpdesk-db --local --file=./migrations/0001_add_wellbeing_slug.sql
--   or: wrangler d1 execute helpdesk-db --remote --file=./migrations/0001_add_wellbeing_slug.sql

ALTER TABLE tickets ADD COLUMN wellbeing_service_slug TEXT;
