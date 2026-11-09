-- 0003: PRD v1.1 has no agent role, so no 'assigned' status.
-- Tickets left as 'assigned' from Assignment 2 become 'in_progress', with a history row explaining why.
-- The CHECK constraint on tickets.status still accepts 'assigned' (SQLite cannot alter it in place);
-- the API never writes it again, and the UI also maps it to in_progress as a safety net.
--
-- Local:      npx wrangler d1 execute helpdesk-db --local  --file=./database/migrations/0003_drop_assigned_status.sql
-- Production: run only after P1 approves (same command with --remote)

INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, source, note)
SELECT id, 'assigned', 'in_progress', NULL, 'system', 'ย้ายจากสถานะเดิม (มอบหมายแล้ว) ตาม PRD v1.1'
FROM tickets
WHERE status = 'assigned';

UPDATE tickets
SET status = 'in_progress', updated_at = datetime('now')
WHERE status = 'assigned';
