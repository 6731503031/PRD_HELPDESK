#!/usr/bin/env node
/**
 * Pretend to be Team 10: send a signed maintenance.status_changed webhook.
 * Owner: P3. Use it to test before Team 10 is live, and for the demo.
 *
 *   MAINTENANCE_WEBHOOK_SECRET=dev-secret npm run mock:maintenance -- WO-0045 in_progress
 *   ... -- WO-0045 in_progress --url http://127.0.0.1:8787/api/v1/webhooks/maintenance
 *   ... -- WO-0045 in_progress --bad-signature      (expect 401)
 *   ... -- WO-0045 in_progress --event-id same-id   (send twice → second is a duplicate)
 *
 * The secret must equal the Worker's MAINTENANCE_WEBHOOK_SECRET (.dev.vars locally).
 */
import { createHmac, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = ['--url', '--event-id', '--correlation-id'];
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
const [workOrderId = 'WO-0045', status = 'in_progress'] = positional;
const url = flag('--url') ?? 'http://127.0.0.1:8787/api/v1/webhooks/maintenance';
const secret = process.env.MAINTENANCE_WEBHOOK_SECRET;
if (!secret) {
  console.error('Set MAINTENANCE_WEBHOOK_SECRET first (same value as the Worker).');
  process.exit(1);
}

const now = new Date();
const body = JSON.stringify({
  eventId: flag('--event-id') ?? randomUUID(),
  type: 'maintenance.status_changed',
  occurredAt: now.toISOString(),
  source: 'maintenance',
  subject: `work-order:${workOrderId}`,
  data: { workOrderId, status, previousStatus: null, changedAt: now.toISOString() },
});
const ts = String(Math.floor(now.getTime() / 1000));
const signature = args.includes('--bad-signature')
  ? 'deadbeef'
  : createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
const correlationId = flag('--correlation-id') ?? `team14-t10-mock-${Date.now()}`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Timestamp': ts, 'X-Signature': signature, 'X-Correlation-Id': correlationId },
  body,
});
console.log(`POST ${url}`);
console.log(`X-Correlation-Id: ${correlationId}`);
console.log(`→ ${res.status} ${await res.text()}`);
