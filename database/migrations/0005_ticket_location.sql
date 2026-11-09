-- 1) Where the problem is (e.g. "Building B, Room B-204"), typed by the requester when reporting.
-- Required for new tickets (checked in the API); older tickets keep NULL and still work.
-- Sent to Team 10 as the work order location (the admin can edit it before sending).
--   npx wrangler d1 execute helpdesk-db --local  --file=./database/migrations/0005_ticket_location.sql
--   npx wrangler d1 execute helpdesk-db --remote --file=./database/migrations/0005_ticket_location.sql
ALTER TABLE tickets ADD COLUMN location TEXT;

-- Team 10's repair category chosen by the admin when sending (Plumbing, Electrical, HVAC, Safety, Not sure),
-- kept so the admin can still see it after sending. NULL when not sent from Helpdesk.
ALTER TABLE tickets ADD COLUMN maintenance_category TEXT;
