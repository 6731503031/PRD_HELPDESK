# API Contract — Helpdesk MVP

**Role:** API designer
**Source of truth:** `requirement.md` (FR), `DataModel.md` (schema), `architecture.md` (stack)
**Audience:** frontend dev, backend dev, integration teams
**Version:** 0.1 (draft, lock before sprint 2)

---

## 1. Conventions

### 1.1 Base URL

```
Dev:     http://localhost:3000
Prod:    https://helpdesk-mfu.vercel.app
```

### 1.2 Auth

- **ทุก endpoint ยกเว้น** `/api/auth/*`, `/api/webhooks/*`, `/api/health` ต้องมี JWT
- Header: `Authorization: Bearer <jwt>`
- JWT ออกโดย Supabase Auth → verify ใน Route Handler → `auth.uid()` ใช้ใน RLS policy
- Role (`Requester` / `Agent` / `Admin`) มาจาก `users.role` table ผ่าน custom JWT claim (ตั้งใน Auth Hook)

### 1.3 Common request headers

| Header | Required | Notes |
|---|---|---|
| `Authorization` | ✅ (except whitelist) | `Bearer <jwt>` |
| `Content-Type` | ✅ for POST/PATCH | `application/json` |
| `Idempotency-Key` | ❌ | Optional retry-safety, MVP ไม่ enforce |

### 1.4 Common response shape

**Success**
```json
{
  "data": { ... },
  "meta": { "request_id": "req_abc123", "timestamp": "2026-08-14T15:00:00Z" }
}
```

**Error** (HTTP 4xx/5xx)
```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Cannot transition from Closed to Resolved.",
    "details": { "from": "Closed", "to": "Resolved" },
    "request_id": "req_abc123"
  }
}
```

### 1.5 Error codes (canonical)

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input ผิด schema |
| 400 | `INVALID_STATE_TRANSITION` | BR-01 violated |
| 400 | `EDIT_WINDOW_EXPIRED` | BR-03 (Agent touched ticket → requester edit หมดสิทธิ์) |
| 400 | `REOPEN_WINDOW_EXPIRED` | BR-05 (เกิน 7 วัน) |
| 401 | `UNAUTHENTICATED` | ไม่มี JWT / JWT หมดอายุ |
| 403 | `FORBIDDEN` | JWT valid แต่ role ไม่พอ (RLS หรือ app-level check) |
| 404 | `NOT_FOUND` | Resource ไม่มี หรือไม่มีสิทธิ์เห็น (ไม่บอกว่า "มีอยู่แต่ห้ามดู") |
| 409 | `VERSION_CONFLICT` | Optimistic concurrency — `updated_at` mismatch |
| 409 | `DUPLICATE` | Unique constraint violated (เช่น category name) |
| 422 | `BUSINESS_RULE_VIOLATED` | rule อื่นๆ ที่ไม่ใช่ state transition |
| 429 | `RATE_LIMITED` | (future) |
| 500 | `INTERNAL_ERROR` | server-side bug |
| 503 | `EXTERNAL_DEPENDENCY_DOWN` | Notification Hub / Identity ล่ม |

### 1.6 Pagination

`GET` list endpoints ใช้ cursor-based pagination:

```
?limit=50&cursor=eyJ0IjoxNzAwMDAwMDAwfQ
```

Response:
```json
{
  "data": [...],
  "meta": {
    "next_cursor": "eyJ0IjoxNzAwMDAwMTAwfQ",
    "has_more": true
  }
}
```

ค่า default: `limit=50`, max `limit=200`

### 1.7 Timestamps

- **รูปแบบ:** ISO 8601 UTC, `2026-08-14T15:00:00.000Z`
- **แหล่งที่มา:** DB (`now()`) เท่านั้น — **client ห้ามส่ง timestamp มาเอง** (DataModel §10)

### 1.8 IDs

| Resource | Format | Example |
|---|---|---|
| Ticket | `T-` + 6-digit zero-padded sequential | `T-000123` |
| Comment | `C-` + 6-digit zero-padded sequential | `C-000456` |
| User | UUID (ตรงกับ Identity service) | `a1b2c3d4-...` |
| Category | slug (lowercase, dash) | `it-support`, `facility` |

Monotonic counter ใช้ Postgres sequence หรือ `nextval` (ดู §7 — ไม่ใช่ UUID เพราะ BR-12 ต้อง monotonic)

---

## 2. Authentication

### 2.1 Login flow (Supabase Auth)

```
Browser → /login → Supabase Auth UI (OIDC redirect)
                              ↓
                       Identity provider
                              ↓
Browser ← JWT (stored in httpOnly cookie)
```

**ใน dev:** Supabase Auth ใช้ email magic-link / OAuth provider ที่ Supabase มีให้
**ใน prod:** callback URL ชี้ไป campus Identity (OIDC)

### 2.2 Logout

`POST /api/auth/logout` — clear Supabase session

### 2.3 Get current user

```
GET /api/auth/me
→ 200 { id, display_name, email, role }
```

ใช้ตอน app boot เพื่อเช็ค role + cache user info

---

## 3. Ticket endpoints

### 3.1 `POST /api/tickets` — Create ticket

**FR-02, FR-03, FR-07**

Request:
```json
{
  "subject": "Projector in Room 204 is broken",
  "description": "No display when connecting HDMI...",
  "category_id": "facility",
  "priority": "Medium",
  "suggested_at_create": true
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `subject` | string | ✅ | length 1–200 |
| `description` | string | ✅ | length 1–5000 |
| `category_id` | string | ✅ | must exist in `categories` AND `is_active = true` |
| `priority` | enum | ✅ | `Low` \| `Medium` \| `High` \| `Urgent` |
| `suggested_at_create` | bool | ❌ | `true` = user ยอมรับ suggestion, `false`/omitted = user override |

Response `201`:
```json
{
  "data": {
    "id": "T-000123",
    "requester_id": "a1b2c3d4-...",
    "assignee_id": null,
    "category_id": "facility",
    "subject": "...",
    "description": "...",
    "priority": "Medium",
    "status": "Open",
    "maintenance_work_order_id": null,
    "resolution_note": null,
    "created_at": "2026-08-14T15:00:00.000Z",
    "updated_at": "2026-08-14T15:00:00.000Z",
    "resolved_at": null,
    "closed_at": null,
    "escalated_at": null,
    "comment_count": 0
  }
}
```

**Side effects:**
- Insert `tickets` row
- Insert `events` outbox row (`ticket.created`)
- Insert `users` row if first login (handled by auth callback)

**Errors:**
- `400 VALIDATION_ERROR` — schema mismatch
- `403 FORBIDDEN` — ไม่ใช่ Requester/Agent/Admin (shouldn't happen)
- `404 NOT_FOUND` — `category_id` ไม่มีใน active categories

---

### 3.2 `GET /api/tickets/me` — My tickets

**FR-04**

Query: `?status=Open,Assigned&limit=50`

Response `200`:
```json
{
  "data": [
    {
      "id": "T-000123",
      "subject": "...",
      "status": "Open",
      "priority": "Medium",
      "category_id": "facility",
      "category_name": "Facility",
      "created_at": "...",
      "updated_at": "...",
      "comment_count": 0
    }
  ],
  "meta": { "next_cursor": null, "has_more": false }
}
```

**Behavior:** filter `requester_id = auth.uid()` — enforced by RLS

---

### 3.3 `GET /api/tickets` — Agent queue

**FR-08**

Role: Agent, Admin

Query:
- `?status=Open` (default: `Open,Assigned,InProgress`)
- `?priority=Urgent,High` (filter)
- `?category_id=facility`
- `?sort=priority_desc,created_at_asc` (default)
- `?assignee_id=me` (filter to assigned to me)
- `?limit=50`

Response: same shape as §3.2 แต่:
- มี field `assignee_id` + `assignee_display_name` (join)
- `requester_display_name` ด้วย (join)
- RLS policy ให้ Agent/Admin อ่านได้ทั้งหมด

---

### 3.4 `GET /api/tickets/{id}` — Ticket detail

**FR-05**

Response `200`:
```json
{
  "data": {
    "id": "T-000123",
    "requester": { "id": "...", "display_name": "Nok", "email": "..." },
    "assignee": null,
    "category": { "id": "facility", "name": "Facility" },
    "subject": "...",
    "description": "...",
    "priority": "Medium",
    "status": "Open",
    "maintenance_work_order_id": null,
    "resolution_note": null,
    "created_at": "...",
    "updated_at": "...",
    "resolved_at": null,
    "closed_at": null,
    "escalated_at": null,
    "comments": [
      {
        "id": "C-000456",
        "author": { "id": "...", "display_name": "Anan" },
        "body": "...",
        "visibility": "Public",
        "created_at": "..."
      }
    ],
    "comment_count": 1
  }
}
```

**Visibility rules:**
- `comments[]` กรองตาม `visibility` (BR-06): requester เห็นแค่ `Public`
- `maintenance_work_order_id` เห็นเฉพาะ Agent/Admin
- `assignee` เห็นเฉพาะ Agent/Admin

**Errors:**
- `404 NOT_FOUND` — ไม่มี ticket หรือไม่มีสิทธิ์ (RLS hides)

---

### 3.5 `PATCH /api/tickets/{id}` — Update ticket

**FR-09, FR-10, FR-12, BR-03**

Request: **partial update** (any subset)
```json
{
  "subject": "Projector...",
  "description": "Updated text",
  "category_id": "it",
  "priority": "High",
  "assignee_id": "agent-uuid",
  "maintenance_work_order_id": "WO-2024-0042",
  "resolution_note": "Replaced bulb",
  "expected_updated_at": "2026-08-14T15:00:00.000Z"
}
```

| Field | Who can update | Notes |
|---|---|---|
| `subject`, `description` | Requester (own, while `Open` and no agent edit, BR-03) / Agent / Admin | |
| `category_id`, `priority` | Agent / Admin only | |
| `assignee_id` | Agent / Admin only | |
| `maintenance_work_order_id` | Agent / Admin only | BR-08 single value |
| `resolution_note` | Agent / Admin only (required when `status` → `Resolved`) | |
| `expected_updated_at` | optional but recommended | Optimistic concurrency (DataModel §10) |

**Notes:**
- `status` ไม่เปลี่ยนผ่าน endpoint นี้ — มี endpoint เฉพาะ (assign, resolve, reopen) — บังคับให้ transition ผ่าน dedicated path
- ถ้า `assignee_id` เปลี่ยน → emit `ticket.assigned` event (ไม่ใช่ `ticket.updated`)

**Errors:**
- `400 EDIT_WINDOW_EXPIRED` — requester แก้ ticket ที่ Agent แตะแล้ว
- `400 INVALID_STATE_TRANSITION` — เปลี่ยน field ที่ขัด BR-01
- `403 FORBIDDEN` — role ไม่พอ
- `409 VERSION_CONFLICT` — `expected_updated_at` mismatch → client ต้อง refresh + retry

---

### 3.6 `POST /api/tickets/{id}/assign` — Assign ticket

**FR-09**

เป็น endpoint แยก เพื่อ:
- บังคับ transition `Open → Assigned` (BR-01)
- emit `ticket.assigned` event
- กันไม่ให้ assign ไป Requester (FK must point to Agent/Admin)

Request:
```json
{
  "assignee_id": "agent-uuid",
  "expected_updated_at": "..."
}
```

Response `200`:
```json
{
  "data": { "id": "T-000123", "status": "Assigned", "assignee_id": "agent-uuid", "updated_at": "..." }
}
```

**Errors:**
- `400 INVALID_STATE_TRANSITION` — จาก `Resolved` หรือ `Closed` (reopen ใช้ endpoint แยก)
- `422 BUSINESS_RULE_VIOLATED` — `assignee_id` มี role = Requester

---

### 3.7 `POST /api/tickets/{id}/resolve` — Resolve ticket

**FR-13**

Request:
```json
{
  "resolution_note": "Replaced HDMI cable, tested with 2 laptops.",
  "expected_updated_at": "..."
}
```

Response `200`:
```json
{
  "data": {
    "id": "T-000123",
    "status": "Resolved",
    "resolved_at": "...",
    "resolution_note": "...",
    "updated_at": "..."
  }
}
```

**Effects:**
- status → `Resolved`, `resolved_at = now()`
- emit `ticket.resolved` event
- ถ้า `resolved_at` + 7 วัน < now() (background) → auto-`Closed` (BR-01, BR-05)

**Errors:**
- `400 VALIDATION_ERROR` — `resolution_note` ว่าง
- `400 INVALID_STATE_TRANSITION` — จาก `Closed` (terminal)
- `409 VERSION_CONFLICT`

---

### 3.8 `POST /api/tickets/{id}/reopen` — Reopen ticket

**BR-05**

ใช้ได้เฉพาะ:
- ticket อยู่ใน `Resolved`
- `now() - resolved_at ≤ 7 days`
- โดย requester (own), Agent, Admin

Request:
```json
{ "expected_updated_at": "..." }
```

Response `200`:
```json
{
  "data": { "id": "T-000123", "status": "Open", "resolved_at": null, "updated_at": "..." }
}
```

**Errors:**
- `400 REOPEN_WINDOW_EXPIRED` — เกิน 7 วัน
- `400 INVALID_STATE_TRANSITION` — จากสถานะอื่นที่ไม่ใช่ `Resolved`

---

### 3.9 `POST /api/tickets/{id}/link-maintenance` — Link work-order

**FR-12**

Request:
```json
{
  "work_order_id": "WO-2024-0042",
  "expected_updated_at": "..."
}
```

Response `200`:
```json
{
  "data": {
    "id": "T-000123",
    "maintenance_work_order_id": "WO-2024-0042",
    "previous_work_order_id": null,
    "updated_at": "..."
  }
}
```

**Effects:**
- `maintenance_work_order_id` overwritten (BR-08 — at most one)
- emit `ticket.work_order_linked` event (payload includes `previous_work_order_id`)
- Agent/Admin only

---

### 3.10 `POST /api/tickets/suggest` — Categories suggestion

**FR-07**

Request:
```json
{
  "subject": "Projector broken",
  "description": "No display when connecting HDMI..."
}
```

Response `200`:
```json
{
  "data": {
    "category_id": "facility",
    "priority": "Medium",
    "rule_trace": [
      { "rule": "keyword:projector", "matched": true, "category": "facility" },
      { "rule": "no_display => High", "matched": false, "priority": "High" }
    ]
  }
}
```

**Note:** non-binding (BR-07) — client ต้องแสดง suggestion ให้ user override ได้

---

## 4. Comments endpoints

### 4.1 `POST /api/tickets/{id}/comments` — Add comment

**FR-06, FR-11**

Request:
```json
{
  "body": "Tried with another cable, still no display.",
  "visibility": "Public"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `body` | string | ✅ | length 1–5000, plain text |
| `visibility` | enum | ✅ | `Public` \| `Internal` (Agent/Admin only — BR-06) |

Response `201`:
```json
{
  "data": {
    "id": "C-000456",
    "ticket_id": "T-000123",
    "author": { "id": "...", "display_name": "Anan" },
    "body": "...",
    "visibility": "Public",
    "created_at": "..."
  }
}
```

**Errors:**
- `403 FORBIDDEN` — visibility=Internal + role=Requester
- `404 NOT_FOUND` — ticket ไม่มี/ไม่มีสิทธิ์

---

## 5. Admin endpoints

### 5.1 `GET /api/admin/counts` — Basic counts

**FR-17**

Role: Agent, Admin

Response `200`:
```json
{
  "data": {
    "total_tickets": 1234,
    "open": 45,
    "resolved_today": 12,
    "by_category": [
      { "category_id": "facility", "name": "Facility", "count": 23 },
      { "category_id": "it", "name": "IT Support", "count": 22 }
    ]
  }
}
```

---

### 5.2 Categories CRUD

**FR-18**

| Method | Endpoint | Notes |
|---|---|---|
| `GET` | `/api/categories` | list active (Anyone) |
| `GET` | `/api/categories?include_inactive=true` | Admin only |
| `POST` | `/api/categories` | Admin: `{ id, name, description? }` |
| `PATCH` | `/api/categories/{id}` | Admin: rename, update description |
| `DELETE` | `/api/categories/{id}` | Admin: soft-delete (`is_active = false`) |

Unique constraint: `name` unique among active (`UNIQUE INDEX ... WHERE is_active`).

---

## 6. Webhook endpoints

### 6.1 `POST /api/webhooks/maintenance` — Receive maintenance event

**FR-14**

**Auth:** HMAC signature in `X-Signature` header
```
X-Signature: sha256=<hex digest of body using MAINTENANCE_WEBHOOK_SECRET>
```

Request:
```json
{
  "work_order_id": "WO-2024-0042",
  "status": "Completed",
  "previous_status": "InProgress",
  "occurred_at": "2026-08-14T15:00:00.000Z"
}
```

Response `200`:
```json
{
  "data": { "ticket_id": "T-000123", "new_status": "Resolved", "applied_at": "..." }
}
```

**Behavior:**
1. Verify HMAC → 401 if invalid
2. Find ticket by `work_order_id` → 200 with `ticket_id: null` if not found (idempotent)
3. **Guard:** if link has since been changed/cleared → 200 with no-op
4. Update ticket status + emit `ticket.status_changed` event (source=`maintenance`)
5. 200 on success

**Errors:**
- `401 UNAUTHENTICATED` — bad signature
- `400 VALIDATION_ERROR` — bad payload

---

## 7. Health & ops

### 7.1 `GET /api/health`

Response `200`:
```json
{
  "data": {
    "status": "ok",
    "db": "ok",
    "version": "0.1.0",
    "uptime_seconds": 3600
  }
}
```

ใช้สำหรับ Vercel cron ping + uptime check

---

## 8. Event payloads (outbound)

ทุก event publish ผ่าน `events` outbox table (DataModel §7) — schema ตัวนี้

### 8.1 `ticket.created`

```json
{
  "event_id": "evt_abc123",
  "event_type": "ticket.created",
  "occurred_at": "2026-08-14T15:00:00.000Z",
  "aggregate_id": "T-000123",
  "payload": {
    "ticket_id": "T-000123",
    "requester_id": "a1b2c3d4-...",
    "category_id": "facility",
    "priority": "Medium",
    "subject": "Projector broken",
    "created_at": "2026-08-14T15:00:00.000Z"
  }
}
```

**Consumers:** Notification Hub (FR-16), Analytics

### 8.2 `ticket.assigned`

```json
{
  "event_id": "evt_def456",
  "event_type": "ticket.assigned",
  "occurred_at": "...",
  "aggregate_id": "T-000123",
  "payload": {
    "ticket_id": "T-000123",
    "assignee_id": "agent-uuid",
    "assigned_by": "agent-uuid",
    "previous_assignee_id": null,
    "assigned_at": "..."
  }
}
```

**Consumers:** Notification Hub (FR-16)

### 8.3 `ticket.resolved`

```json
{
  "event_id": "evt_ghi789",
  "event_type": "ticket.resolved",
  "occurred_at": "...",
  "aggregate_id": "T-000123",
  "payload": {
    "ticket_id": "T-000123",
    "resolved_by": "agent-uuid",
    "resolution_note": "Replaced bulb",
    "resolved_at": "..."
  }
}
```

**Consumers:** Notification Hub (FR-16), Analytics

### 8.4 `ticket.escalated`

```json
{
  "event_id": "evt_jkl012",
  "event_type": "ticket.escalated",
  "occurred_at": "...",
  "aggregate_id": "T-000123",
  "payload": {
    "ticket_id": "T-000123",
    "priority": "Urgent",
    "created_at": "...",
    "age_minutes": 67
  }
}
```

**Consumers:** Notification Hub, Analytics

### 8.5 `ticket.status_changed` (from maintenance)

```json
{
  "event_id": "evt_mno345",
  "event_type": "ticket.status_changed",
  "occurred_at": "...",
  "aggregate_id": "T-000123",
  "payload": {
    "ticket_id": "T-000123",
    "from_status": "Assigned",
    "to_status": "Resolved",
    "source": "maintenance",
    "work_order_id": "WO-2024-0042",
    "reason": "Maintenance reported completion"
  }
}
```

### 8.6 `ticket.work_order_linked`

```json
{
  "event_id": "evt_pqr678",
  "event_type": "ticket.work_order_linked",
  "occurred_at": "...",
  "aggregate_id": "T-000123",
  "payload": {
    "ticket_id": "T-000123",
    "work_order_id": "WO-2024-0042",
    "previous_work_order_id": null,
    "linked_by": "agent-uuid"
  }
}
```

### 8.7 Common envelope

ทุก event payload มี envelope เดียวกัน:
```json
{
  "event_id": "evt_xxxxxxxx",
  "event_type": "ticket.created",
  "event_version": 1,
  "occurred_at": "ISO 8601",
  "aggregate_id": "T-000123",
  "payload": { ... }
}
```

`event_id` ใช้สำหรับ idempotency ฝั่ง consumer (consumer เก็บ seen `event_id` ไว้ใน TTL window)

---

## 9. RLS policy sketch

RLS policies เขียนเป็น `CREATE POLICY` แยกตาม table — ดู `requirement.md` §4 permission matrix เป็น source of truth

ตัวอย่าง (ไม่ใช่ final SQL, แค่ให้เห็นภาพ):

```sql
-- tickets: read
CREATE POLICY "ticket_read" ON tickets FOR SELECT USING (
  -- Requester: own tickets only
  (requester_id = auth.uid())
  OR
  -- Agent / Admin: all
  ((auth.jwt() ->> 'role') IN ('Agent', 'Admin'))
);

-- tickets: insert
CREATE POLICY "ticket_insert" ON tickets FOR INSERT WITH CHECK (
  requester_id = auth.uid()
  AND (auth.jwt() ->> 'role') IN ('Requester', 'Agent', 'Admin')
);

-- tickets: update (multi-rule, enforced via +app check)
CREATE POLICY "ticket_update" ON tickets FOR UPDATE USING (
  -- base: own or agent
  (requester_id = auth.uid())
  OR ((auth.jwt() ->> 'role') IN ('Agent', 'Admin'))
) WITH CHECK (
  -- branch logic ขึ้นกับ field → ต้องเขียน trigger + RLS combo
  -- ดู DataModel §11
  true
);

-- comments: read (filter visibility)
CREATE POLICY "comment_read" ON comments FOR SELECT USING (
  visibility = 'Public'
  OR (auth.jwt() ->> 'role') IN ('Agent', 'Admin')
  OR EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = comments.ticket_id
    AND t.requester_id = auth.uid()
  )
);
```

---

## 10. Open questions

| # | Question | Owner | Due |
|---|---|---|---|
| Q1 | `Idempotency-Key` ไหม? — MVP ไม่ใส่, แต่ควร reserve header | backend | sprint 2 |
| Q2 | Cursor format — `created_at` หรือ `id`? — ใช้ `id` (monotonic) | backend | sprint 2 |
| Q3 | Realtime subscription ใน agent queue? — defer | team | post-MVP |
| Q4 | Soft-delete category ตอน referenced → block? หรือ force? | product | sprint 1 |
| Q5 | `resolution_note` edit-after-resolve? — ไม่ (append-only) | product | ✔ locked |

---

## 11. Changelog

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-08-14 | Initial draft หลังเลือก Option A |

---

*ทุก breaking change ต้อง bump version + เขียน migration guide ก่อน sprint kickoff*
