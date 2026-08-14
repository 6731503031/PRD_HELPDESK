# Acceptance Criteria — Helpdesk MVP

**Role:** QA + product engineer
**Format:** Given/When/Then (Gherkin-style)
**Coverage:** NFR-13 (7 required tests) + business rules + permission matrix
**Audience:** ใครเขียน test ใช้เอกสารนี้เป็น checklist
**Version:** 0.1 (draft, lock before sprint 2)

---

## Legend

- **AC** = Acceptance Criterion
- **[NFR-13]** = required by NFR-13 (at least 7 — เรามี 16)
- **[BR-xx]** = driven by business rule
- **[FR-xx]** = driven by functional requirement
- **Role gate**: ถ้า test ต้อง role เฉพาะ → mark ใน Setup

---

## 1. Core domain (NFR-13 required)

### AC-1 — Create ticket **[NFR-13] [FR-02] [FR-03]**

**Setup:** seed user `Requester: Nok` (logged in), categories `[it, facility, academic]`

**Given** Nok อยู่ที่หน้า Create Ticket
**When** Nok กรอก
- subject = "Projector in Room 204 is broken"
- description = "No display when connecting HDMI"
- category_id = "facility"
- priority = "Medium"
- suggested_at_create = false

**And** กด Submit

**Then:**
- Response 201 with `id` = `T-000001` (or next monotonic)
- `status` = `Open`, `assignee_id` = null
- `requester_id` = Nok's user id
- `created_at` = `updated_at` = now() (DB time)
- `events` outbox มี row ใหม่ `event_type = 'ticket.created'`, `aggregate_id = T-000001`, payload ตรงตาม schema §8.1
- RLS check: Nok `SELECT` เห็น ticket นี้, user อื่น (Requester) ไม่เห็น

---

### AC-2 — Ownership visibility **[NFR-13] [BR-02]**

**Setup:** seed two Requesters (Nok, New); seed one Agent (Anan); Nok สร้าง ticket T-001

**Given** ticket T-001 มี `requester_id = Nok`
**When** New ยิง `GET /api/tickets/T-001`
**Then:** 404 NOT_FOUND (RLS hides — ไม่บอกว่ามีอยู่)

**And** when Anan ยิง `GET /api/tickets/T-001`
**Then:** 200 with full ticket data

**And** when Nok ยิง `GET /api/tickets/T-001`
**Then:** 200 with full ticket data ของตัวเอง

---

### AC-3 — Assignment **[NFR-13] [FR-09] [BR-01]**

**Setup:** seed T-001 with status=Open, assignee=null

**Given** Anan (Agent) login
**When** Anan `POST /api/tickets/T-001/assign` with `{ assignee_id: Anan.id }`
**Then:**
- Response 200, `status` = `Assigned`, `assignee_id` = Anan.id
- `events` outbox มี row `event_type = 'ticket.assigned'`
- `ticket.created_at` ไม่เปลี่ยน, `updated_at` = now()

**And** when Anan assigns to New (Role=Requester)
**Then:** 422 BUSINESS_RULE_VIOLATED (assignee ต้องเป็น Agent/Admin — DataModel §11)

**And** when Anan assigns ticket ที่ status = `Closed`
**Then:** 400 INVALID_STATE_TRANSITION (Terminal state)

---

### AC-4 — Add comment **[NFR-13] [FR-06] [FR-11] [BR-06]**

**Setup:** T-001 with Anan assigned

**Given** Anan login
**When** Anan `POST /api/tickets/T-001/comments` with `{ body: "Looked at it, cable was loose", visibility: "Internal" }`
**Then:**
- Response 201, comment id = `C-000001`
- `visibility` = `Internal`
- `events` outbox ไม่มี row ใหม่ (comments ไม่ใช่ state transition — BR-10 applies เฉพาะ ticket)

**And** when Nok (Requester) `GET /api/tickets/T-001`
**Then:** `comments[]` ไม่มี comment Internal

**And** when Anan `GET /api/tickets/T-001`
**Then:** `comments[]` มี comment Internal

**And** when Nok `POST /api/tickets/T-001/comments` with `{ visibility: "Internal" }`
**Then:** 403 FORBIDDEN (Requester ห้าม internal)

---

### AC-5 — Resolve ticket **[NFR-13] [FR-13] [BR-01]**

**Setup:** T-001 status=InProgress, assignee=Anan

**Given** Anan login
**When** Anan `POST /api/tickets/T-001/resolve` with `{ resolution_note: "Replaced HDMI cable" }`
**Then:**
- Response 200, `status` = `Resolved`, `resolved_at` = now()
- `resolution_note` saved
- `events` outbox มี row `event_type = 'ticket.resolved'`

**And** when Nok `POST /api/tickets/T-001/resolve`
**Then:** 403 FORBIDDEN (Requester can't resolve)

**And** when Anan tries without `resolution_note`
**Then:** 400 VALIDATION_ERROR (BR-13 DataModel §11)

**And** when Anan tries to resolve a `Closed` ticket
**Then:** 400 INVALID_STATE_TRANSITION

---

### AC-6 — Maintenance link + status sync **[NFR-13] [FR-12] [FR-14] [BR-08]**

**Setup:** T-001 status=InProgress, `maintenance_work_order_id = null`

**Given** Anan login
**When** Anan `POST /api/tickets/T-001/link-maintenance` with `{ work_order_id: "WO-2024-0042" }`
**Then:**
- Response 200, `maintenance_work_order_id = "WO-2024-0042"`
- `events` outbox มี row `event_type = 'ticket.work_order_linked'`, `previous_work_order_id = null`

**And** when Anan links again with `{ work_order_id: "WO-2024-0099" }`
**Then:**
- `maintenance_work_order_id = "WO-2024-0099"`
- `previous_work_order_id = "WO-2024-0042"` in event payload (BR-08 — record previous)

**And** when external Maintenance system POSTs `/api/webhooks/maintenance` with valid HMAC:
```json
{
  "work_order_id": "WO-2024-0099",
  "status": "Completed",
  "occurred_at": "..."
}
```
**Then:**
- T-001 `status` = `Resolved`
- `events` outbox มี row `event_type = 'ticket.status_changed'`, `source = "maintenance"`

**And** when external POSTs with bad HMAC:
**Then:** 401 UNAUTHENTICATED

**And** when external POSTs for `work_order_id` ที่ unlink ไปแล้ว
**Then:** 200, no-op (DataModel §6 edge case)

---

### AC-7 — Escalation event **[NFR-13] [FR-15] [BR-09]**

**Setup:** seed T-001 with `priority = 'Urgent'`, `status = 'Open'`, `assignee_id = null`, `created_at = now() - 2 hours`, `escalated_at = null`

**Given** Vercel cron runs (escalation check)
**When** cron query:
```sql
SELECT id FROM tickets
WHERE priority='Urgent' AND status='Open'
  AND assignee_id IS NULL
  AND created_at < now() - interval '1 hour'
  AND escalated_at IS NULL
```
**Then:**
- T-001 returned
- After cron processes: `escalated_at = now()`, `events` outbox has row `event_type = 'ticket.escalated'`, payload ตรง §8.4

**And** (idempotency) when cron runs again 1 min later
**Then:** T-001 not returned (`escalated_at IS NULL` guard)

**And** when priority = `High` (not Urgent) + unassigned + 2 hours
**Then:** NOT escalated (BR-09 — only Urgent)

**And** when priority = `Urgent` + assigned to Anan
**Then:** NOT escalated (BR-09 — must be unassigned)

---

## 2. Additional business rules

### AC-8 — Edit window (BR-03)

**Setup:** T-001 status=Open, requester=Nok, no agent edit yet

**Given** Nok login
**When** Nok `PATCH /api/tickets/T-001` with `{ description: "Updated text" }`
**Then:** 200, `description` updated

**And** when Anan (Agent) updates `priority`
**Then:** ticket now has agent_edit flag = true (or detect via event log)

**And** (after agent edit) when Nok tries to `PATCH /api/tickets/T-001` with `{ description: "..." }`
**Then:** 400 EDIT_WINDOW_EXPIRED (BR-03 — requester can only comment after agent touches)

---

### AC-9 — Reopen within 7 days (BR-05)

**Setup:** T-001 status=Resolved, `resolved_at = now() - 3 days`

**Given** Nok (Requester, owner) login
**When** Nok `POST /api/tickets/T-001/reopen`
**Then:** 200, `status` = `Open`, `resolved_at = null`

**And** when Nok reopens ticket ที่ `resolved_at = now() - 8 days`
**Then:** 400 REOPEN_WINDOW_EXPIRED

**And** when Nok tries to reopen T-002 (other user's ticket)
**Then:** 404 NOT_FOUND (RLS)

---

### AC-10 — Auto-close after 7 days (BR-05)

**Setup:** T-001 status=Resolved, `resolved_at = now() - 8 days`

**Given** Vercel cron runs (auto-close job)
**When** cron query:
```sql
SELECT id FROM tickets
WHERE status = 'Resolved' AND resolved_at < now() - interval '7 days'
```
**Then:**
- T-001 returned
- After processing: `status` = `Closed`, `closed_at = now()`

**And** (terminal) when Anan tries to `PATCH /api/tickets/T-001` with `{ description: "..." }`
**Then:** 400 INVALID_STATE_TRANSITION (BR-01 — Closed is terminal)

---

### AC-11 — Public vs Internal comment visibility (BR-06)

**Setup:** T-001 with 2 comments:
- C-001: Public, "User reply"
- C-002: Internal, "Agent note"

**Given** Nok (owner) login
**When** Nok `GET /api/tickets/T-001`
**Then:** `comments[]` มีแค่ C-001 (C-002 ถูก filter)

**And** when Anan (Agent) `GET /api/tickets/T-001`
**Then:** `comments[]` มีทั้ง C-001 และ C-002

**And** when Admin `GET /api/tickets/T-001`
**Then:** `comments[]` มีทั้ง C-001 และ C-002

---

### AC-12 — Permission matrix (BR-04)

**Setup:** T-001 status=Open, requester=Nok

**Given** ทดสอบ role gates:

| Action | Nok (Requester) | Anan (Agent) | Admin |
|---|---|---|---|
| `GET /api/tickets/me` | ✅ | ✅ | ✅ |
| `GET /api/tickets` (queue) | ❌ 403 | ✅ | ✅ |
| `PATCH` priority | ❌ 403 | ✅ | ✅ |
| `PATCH` category | ❌ 403 | ✅ | ✅ |
| `POST /assign` | ❌ 403 | ✅ | ✅ |
| `POST /resolve` | ❌ 403 | ✅ | ✅ |
| `POST /link-maintenance` | ❌ 403 | ✅ | ✅ |
| `POST /comments` visibility=Internal | ❌ 403 | ✅ | ✅ |
| `GET /api/admin/counts` | ❌ 403 | ✅ | ✅ |
| `POST /api/categories` | ❌ 403 | ❌ 403 | ✅ |

**Then:** ทุก cell ในตารางต้อง match ตามที่ระบุ

---

### AC-13 — Monotonic ID (BR-12)

**Setup:** empty DB

**Given** Nok สร้าง 3 tickets ติดกัน
**When** ตรวจ IDs ที่ได้
**Then:** IDs = `T-000001`, `T-000002`, `T-000003` (sequential, no gaps allowed by transaction)

**And** when ticket T-000002 ถูก hard-delete (Admin)
**Then:** T-000003 ยังคง id = T-000003 (BR-12 — never reuse)

---

### AC-14 — Every transition emits exactly one event (BR-10)

**Setup:** T-001 status=Open

**Given** sequence: create → assign → resolve → reopen → assign
**When** ตรวจ `events` outbox สำหรับ T-001
**Then:** มี event 5 row, แต่ละ row มี `event_type` ตามนี้:
1. `ticket.created`
2. `ticket.assigned`
3. `ticket.resolved`
4. (no event for reopen — BR-10 ambiguous, see Q1) — *ถ้าตัดสินใจ emit `ticket.reopened` ให้เพิ่ม test นี้*
5. `ticket.assigned`

**And** no `ticket.updated` events (we don't emit generic updates)

---

### AC-15 — Optimistic concurrency (DataModel §10)

**Setup:** T-001 with `updated_at = T0`

**Given** Anan and Admin โหลด ticket พร้อมกัน (เห็น `updated_at = T0`)
**When** Anan `PATCH /api/tickets/T-001` with `{ priority: "High", expected_updated_at: "T0" }`
**Then:** 200, `updated_at = T1`

**And** when Admin `PATCH /api/tickets/T-001` with `{ priority: "Urgent", expected_updated_at: "T0" }` (stale)
**Then:** 409 VERSION_CONFLICT (Admin client should refresh + retry)

---

### AC-16 — Notification Hub integration (FR-16)

**Setup:** mock Notification Hub URL `http://localhost:9999/notify`, mock receiver counts POSTs

**Given** T-001 created
**When** outbox publisher runs
**Then:** mock receiver ได้รับ 1 POST with payload ตรง §8.1 ภายใน 30 s

**And** when T-001 resolved
**Then:** mock receiver ได้รับอีก 1 POST with payload §8.3

**And** when Notification Hub ล่ม (mock returns 500)
**Then:** outbox row ยังอยู่ (ไม่ถูก mark published), retry on next poll

---

## 3. Non-functional smoke tests

### AC-17 — Capacity (NFR-02)

**Setup:** seed 10,000 tickets, 100 users

**When** Anan `GET /api/tickets?status=Open&sort=priority_desc,created_at_asc`
**Then:** p95 response < 2000 ms

**And** when 50 concurrent users (k6 load test) `GET /api/tickets/me`
**Then:** p95 response < 2000 ms, 0 failed requests

---

### AC-18 — Local dev one-command (NFR-07)

**When** รัน `supabase start && npm run dev` ใน fresh clone
**Then:** ภายใน 60 วินาที:
- Postgres on `localhost:54322`
- Supabase Studio on `localhost:54323`
- Next.js on `localhost:3000`
- `GET /api/health` returns 200

---

### AC-19 — Secrets hygiene (NFR-04, CON-11)

**When** scan `git ls-files` for env patterns
**Then:** 0 matches for: `API_KEY=`, `SECRET=`, `PASSWORD=`, `TOKEN=`, `sk_`, `pk_live`
- (`.env.example` allowed if values are placeholders)

---

### AC-20 — No secrets in User table (NFR-04)

**When** `\d users` in psql
**Then:** columns = `id, display_name, email, role, created_at, last_seen_at` only
- ไม่มี `password`, `password_hash`, `oauth_token`, `refresh_token`

---

## 4. Negative tests (defense in depth)

### AC-21 — SQL/NoSQL injection

**Given** Nok login
**When** Nok `POST /api/tickets` with `subject = "'; DROP TABLE tickets; --"`
**Then:**
- 201 with subject saved as-is (raw string)
- DB sanity check: `SELECT count(*) FROM tickets` = 1 (table ไม่หาย)

---

### AC-22 — RLS bypass attempt

**Given** Nok login (Requester role)
**When** Nok ใช้ service role key (ถ้า leak) เรียก DB directly
**Then:** assume service role bypasses RLS by design — this is a server-key leak, NOT a RLS bug
- (Document: service role must NEVER reach client. Lint rule: `SUPABASE_SERVICE_ROLE_KEY` only in `process.env` accessed server-side)

---

### AC-23 — Maintenance webhook replay

**Given** valid webhook POST received at T0
**When** same payload POSTed again at T0 + 1s
**Then:** second call is idempotent — no duplicate `ticket.status_changed` events
- (Implementation: store `event_id` from external payload, or use `occurred_at` + `work_order_id` as dedup key)

---

## 5. Out-of-scope (must NOT be tested in MVP)

Per `requirement.md` §6 and `Problem.md` §8, these are NOT in MVP — don't write tests for them yet:

- ❌ File attachments
- ❌ LLM suggestions
- ❌ SLA timers (other than Urgent escalation)
- ❌ Multi-language
- ❌ Mobile native
- ❌ Bulk operations
- ❌ Custom RBAC
- ❌ Knowledge base / FAQ
- ❌ CSAT surveys
- ❌ Real-time chat

---

## 6. Coverage matrix

| AC# | Title | Requirement | NFR-13 count |
|---|---|---|---|
| AC-1 | Create ticket | FR-02, FR-03 | ✅ 1 |
| AC-2 | Ownership visibility | BR-02 | ✅ 2 |
| AC-3 | Assignment | FR-09, BR-01 | ✅ 3 |
| AC-4 | Add comment | FR-06, FR-11, BR-06 | ✅ 4 |
| AC-5 | Resolve ticket | FR-13, BR-01 | ✅ 5 |
| AC-6 | Maintenance link + sync | FR-12, FR-14, BR-08 | ✅ 6 |
| AC-7 | Escalation event | FR-15, BR-09 | ✅ 7 |
| AC-8 | Edit window | BR-03 | extra |
| AC-9 | Reopen within 7 d | BR-05 | extra |
| AC-10 | Auto-close after 7 d | BR-05 | extra |
| AC-11 | Public vs Internal | BR-06 | extra |
| AC-12 | Permission matrix | BR-04, §4 | extra |
| AC-13 | Monotonic ID | BR-12 | extra |
| AC-14 | Every transition emits | BR-10 | extra |
| AC-15 | Optimistic concurrency | DataModel §10 | extra |
| AC-16 | Notification Hub | FR-16 | extra |
| AC-17 | Capacity | NFR-02 | extra |
| AC-18 | Local dev one-command | NFR-07 | extra |
| AC-19 | Secrets hygiene | NFR-04, CON-11 | extra |
| AC-20 | No secrets in DB | NFR-04 | extra |
| AC-21 | SQL injection | defense | extra |
| AC-22 | RLS bypass awareness | defense | extra |
| AC-23 | Webhook replay | defense | extra |

**NFR-13 satisfied:** AC-1 through AC-7 (= 7 tests minimum required)

---

## 7. Open questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Reopen → emit `ticket.reopened` event? | product | AC-14 |
| Q2 | Notification Hub mock — npm package vs curl script? | backend | AC-16 |
| Q3 | Auto-close cron — separate from escalation cron? | backend | AC-10 |
| Q4 | K6 load test in CI หรือ manual? | DevOps | AC-17 |
| Q5 | RLS policy test framework — pgTAP หรือ integration test? | backend | AC-2, AC-12 |

---

## 8. Changelog

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-08-14 | Initial draft หลังเลือก Option A — 23 ACs ครอบ 7 required + 16 extra |

---

*ทุก AC ที่ marked ✅ ใน Coverage matrix ต้อง pass ก่อน merge ขึ้น main*
