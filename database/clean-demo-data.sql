-- Clean demo / test data before a presentation.   *** DELETES DATA — NOT RUN BY ANY npm SCRIPT ***
--
-- Removes every ticket of the demo accounts (ids 1, 2, 6 = Alice, Bob, Charlie) together with what hangs on them:
-- status history, chat messages, tags and outbound events. It KEEPS: categories, tags, the admin, guest profiles
-- and tickets of real guests (ids 1000 and up).
--
-- 1) Look first (read-only), on the database you mean:
--      npx wrangler d1 execute helpdesk-db --local  --command "SELECT customer_id, COUNT(*) FROM tickets GROUP BY customer_id"
--      npx wrangler d1 execute helpdesk-db --remote --command "SELECT customer_id, COUNT(*) FROM tickets GROUP BY customer_id"
-- 2) Run (local is safe to repeat; production cannot be undone — P1 must approve, ideally after `wrangler d1 export`):
--      npx wrangler d1 execute helpdesk-db --local  --file=./database/clean-demo-data.sql
--      npx wrangler d1 execute helpdesk-db --remote --file=./database/clean-demo-data.sql
--
-- Want EVERYTHING gone (all tickets, all guests)? On a local database just use `npm run db:local:fresh`.
-- Tickets already linked to a Team 10 work order are deleted too: tell Team 10 so they do not keep a dangling TKT-xxxxx.

-- Outbound events (subject looks like "ticket:TKT-00012")
DELETE FROM domain_events
WHERE subject IN (SELECT 'ticket:' || ticket_number FROM tickets WHERE customer_id IN (1, 2, 6));

-- Children first (do not rely on cascade)
DELETE FROM ticket_comments       WHERE ticket_id IN (SELECT id FROM tickets WHERE customer_id IN (1, 2, 6));
DELETE FROM ticket_status_history WHERE ticket_id IN (SELECT id FROM tickets WHERE customer_id IN (1, 2, 6));
DELETE FROM ticket_tags           WHERE ticket_id IN (SELECT id FROM tickets WHERE customer_id IN (1, 2, 6));

DELETE FROM tickets WHERE customer_id IN (1, 2, 6);

-- Webhook de-duplication ids from earlier mock runs (they belong to no ticket)
DELETE FROM processed_events;
