# Tests & Coverage Snapshot

เอกสารนี้บันทึกผล **full Vitest suite ที่รันจริง** และแยก tests ที่ pass ออกจาก test cases ที่ถูก skip. ผลทดสอบเป็น snapshot ของ source ปัจจุบัน ไม่ได้ยืนยัน feature ที่ implementation ยังเป็น TODO

## 1. คำสั่งและผลเต็ม suite

Root [`package.json`](../../package.json:13) กำหนด `npm test` ให้รัน `vitest run`.

ผลจาก `npm test`:

| Test file | Passed | Skipped | Failed | หมายเหตุ |
|---|---:|---:|---:|---|
| [`backend/test/ai.test.ts`](../../backend/test/ai.test.ts) | 12 | 0 | 0 | AI/fallback/privacy/endpoint และ Wellbeing matcher |
| [`backend/test/comments.test.ts`](../../backend/test/comments.test.ts) | 10 | 0 | 0 | comment validation, system messages, guest profile rules |
| [`backend/test/config.test.ts`](../../backend/test/config.test.ts) | 2 | 0 | 0 | `portalUrl` accepts/rejects |
| [`backend/test/escalation.test.ts`](../../backend/test/escalation.test.ts) | 1 | 3 | 0 | envelope passes; escalation rule suite skipped |
| [`backend/test/maintenance.test.ts`](../../backend/test/maintenance.test.ts) | 32 | 0 | 0 | HMAC, payload validation, mapping, mock/REST client |
| [`backend/test/tickets.rules.test.ts`](../../backend/test/tickets.rules.test.ts) | 10 | 2 | 0 | create/access/resolve rules pass; lifecycle cases skipped |
| **Total** | **67** | **5** | **0** | **6/6 test files passed** |

## 2. Skipped test cases

### Ticket lifecycle — 2 skipped

In [`backend/test/tickets.rules.test.ts`](../../backend/test/tickets.rules.test.ts:74), `describe.skip('Lifecycle ...')` contains:

1. **`follows Open → InProgress → Resolved → Closed`** — intends to assert the allowed forward transitions.
2. **`never reopens a closed ticket`** — intends to reject `closed → open` and `closed → in_progress`.

The test comment says to remove `.skip` after `canTransition()` is implemented. Current [`canTransition(from, to)`](../../backend/src/modules/tickets/rules.ts:126) returns `true` for every pair, so these requirements are **not verified** and the code currently does not enforce the intended lifecycle

### Escalation — 3 skipped

In [`backend/test/escalation.test.ts`](../../backend/test/escalation.test.ts:28), `describe.skip` contains:

1. Escalate urgent tickets that remain open for more than one hour.
2. Do not escalate before the one-hour threshold.
3. Do not escalate started, non-urgent, or already-escalated tickets.

These are expected requirements only. Current [`isEscalationDue(ticket, now)`](../../backend/src/modules/events/escalation.ts:23) returns `false`, and [`runEscalation(env)`](../../backend/src/modules/events/escalation.ts:38) returns `{ escalated: 0 }` without querying D1

## 3. What passing tests exercise

- **AI:** deterministic keyword fallback, allowed AI output, rejected invalid values, explicit urgency precedence, model response extraction/privacy, no-binding fallback, and `POST /tickets/suggest` response/validation. The API contract test mounts a small Hono app with fake D1 rather than a real D1 instance.
- **Comments:** pure content limits, repair message stage mapping, automatic author identity, profile validation and guest id range. This file does not contain a comments HTTP/D1 route integration test.
- **Config:** `portalUrl()` string trimming and allowed HTTP(S) shape. It does not test the complete `/config` route/runtime binding.
- **Escalation/events:** event envelope construction/privacy check passes. The actual due-rule cases are skipped.
- **Maintenance:** HMAC helper/signature checks, whole envelope/ID/repair input validation, Work Order status mapping, mock mode and REST client request/result behavior using fake fetch. It does not test the full webhook route/D1 transaction against a real database.
- **Ticket rules:** create validation, unique-readable number format, requester/admin visibility/field allowlists and resolve checks. It does not exercise the whole ticket routes against a real D1 database.

## 4. Coverage gaps visible from test inventory

The workspace has no dedicated test file for frontend React rendering, browser routing/polling, Admin routes, full reference routes, full auth routes/middleware, or a real D1 schema/route integration run. A search also found no test for `getCatalogue()` cache/retry/degraded behavior. These are coverage observations from the current `backend/test/` inventory; they do not prove that no external/manual testing exists

## 5. Other validation run during documentation

- `npm run typecheck` — passed; executes backend and frontend TypeScript compiler checks.
- Local Markdown-link checker — all relative file links in `docs/code-explanation/` resolve.
- SQL migrations/schema were **not executed**; no local/remote D1 database was inspected or changed.
- No external Maintenance/Wellbeing API or event hub was called.

The per-file source analysis state is maintained in [`DOCUMENTATION_PROGRESS.md`](DOCUMENTATION_PROGRESS.md)
