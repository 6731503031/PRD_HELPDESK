# PRD — Helpdesk Platform (Team 14)

| Field | Value |
|---|---|
| **Version** | 1.0 (Consolidated) |
| **Date** | 2026-08-14 |
| **Status** | Implementation-ready |
| **Owner** | Team 14, MFU |
| **Source docs** | `PRD_Helpdesk.md` (original brief), `Problem.md`, `requirement.md`, `DataModel.md`, `architecture.md`, `ADR-001-stack.md`, `api_contract.md`, `acceptance_criteria.md` |
| **Audience** | Backend, frontend, QA, integration teams |

> **About this document.** This is the **single consolidated PRD** for implementation. It summarizes all source docs and links out for full detail. Source docs remain authoritative — when this PRD and a source doc disagree, the source doc wins (and this PRD gets updated).

---

## 1. Purpose & Background

### 1.1 Why this exists

Students and staff at MFU have no single, structured, trackable channel to report issues and follow them through to resolution. Requests scatter across email, LINE groups, in-person visits, and ad-hoc DMs. The result: requests get lost, nobody owns the issue end-to-end, there is no shared status, no SLA, and no audit trail. Cross-team coordination (e.g., Helpdesk ↔ Maintenance) is manual and error-prone.

The Helpdesk platform fixes this by giving every request a **ticket identity, an owner, a status, and an event stream** that other systems can subscribe to.

### 1.2 Success criteria

- One place for students/staff to report and track requests (no more lost tickets).
- Agents have a triage queue sorted by priority + age.
- Every state transition emits exactly one event (BR-10) → Notification Hub, Security, Analytics can subscribe.
- Cross-team handoff to Maintenance works via linked work-order ID (no copy-paste).
- Audit trail exists for compliance review.

---

## 2. Users & Roles

| Role | Who | Primary need |
|---|---|---|
| **Requester** | Students, faculty, staff | One place to report; a ticket ID; visibility into status |
| **Agent** | Helpdesk staff / front-line support | Queue, prioritization, triage, assign, comment, resolve |
| **Admin** | Helpdesk lead | Oversight, basic counts, category management |

> Role assignment is performed **out-of-band** (via Identity service or seed data). Helpdesk does not implement user provisioning in MVP.

### 2.1 Personas (MVP)

- **"New-ish student Nok"** — wants to report a broken projector in Room 204 without learning a complex tool.
- **"Agent Anan"** — handles 20–40 tickets/day; needs the urgent stuff on top.

---

## 3. Scope

### 3.1 In scope (MVP)

- Web app with **3 primary screens**: Create Ticket, My Tickets, Agent Queue (+ Ticket Detail, Admin Counts, Category Manager).
- **Rules-based suggestion engine** (keyword + urgency signals) for category + priority. User can override.
- **Event publisher** for `ticket.created / escalated / resolved` (+ `assigned`, `status_changed`, `work_order_linked`).
- **Two thin integrations**:
  - Consume `maintenance.status_changed` to mirror status (webhook in).
  - Consume Identity service for login (OIDC).
- **Async comments only** (no real-time chat).
- **English-only UI**.

### 3.2 Out of scope (MVP)

| Area | Excluded |
|---|---|
| Intake | Email/LINE/Messenger/WhatsApp/Phone parsers, chatbot |
| Triage | LLM-based suggestions, SLA timers, custom workflows, round-robin, auto-reply templates |
| UX | Native mobile apps, multi-language UI, file attachments, rich-text editor, real-time chat, dark mode |
| Reporting | Dashboards (only basic counts), CSAT/NPS, agent performance metrics |
| Permissions | Custom RBAC beyond 3 roles, bulk ops, ticket templates, public KB/FAQ |
| Compliance | Fine-grained audit-log UI, configurable retention, PDPA export tooling, pentest |
| Platform | Multi-tenant, public REST API for 3rd parties, webhooks for arbitrary subscribers |

> Re-promote any of these **only** via an updated `requirement.md` and a new ADR.

---

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| **FR-01** | Log in through campus **Identity service** (SSO). Helpdesk stores no passwords. |
| **FR-02** | Logged-in user can **create a ticket** with subject, description, category, urgency. System returns unique **Ticket ID**. |
| **FR-03** | On ticket creation, system **publishes** `ticket.created` event with ticket ID, requester ID, category, priority, timestamp. |
| **FR-04** | Logged-in user can view **My Tickets** (every ticket they created) with current status, last update, category. |
| **FR-05** | Logged-in user can open one of their own tickets to see full details, status history, comment thread. |
| **FR-06** | Logged-in user can **add a comment** to their own ticket. Plain text. |
| **FR-07** | System suggests a **category** and **priority** at creation using rules engine. User may override. |
| **FR-08** | Agent can open **Agent Queue** — all tickets sortable by priority + age. |
| **FR-09** | Agent can **assign** a ticket to themselves or another Agent. |
| **FR-10** | Agent can change ticket's **priority** and **category**. |
| **FR-11** | Agent can add **internal comments** (visible to Agents/Admins only) in addition to public comments. |
| **FR-12** | Agent can **link** a ticket to existing Maintenance **work-order ID**. |
| **FR-13** | Agent can mark ticket **Resolved** with optional resolution note. System publishes `ticket.resolved`. |
| **FR-14** | When system receives `maintenance.status_changed` for a linked work-order, update ticket status + publish status-change event. |
| **FR-15** | System publishes `ticket.escalated` when ticket priority = Urgent and unassigned for > 1 hour. |
| **FR-16** | System notifies requester via **Notification Hub** on `ticket.created`, `ticket.assigned`, `ticket.resolved`. |
| **FR-17** | Admin can view basic count summary: total, open, resolved today, by category. |
| **FR-18** | Admin can manage **list of categories** (add, rename, deactivate). Priorities are a fixed enum. |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| **NFR-01** | **Cost** — total infra | **0 THB/month** sustained; free-tier only |
| **NFR-02** | **Capacity** | ≥ **200 tickets/day**, **50 concurrent active users**, p95 < **2 s** |
| **NFR-03** | **Availability** | Best-effort, documented in README; no 24/7 SLA claim |
| **NFR-04** | **Security** | HTTPS only; no passwords stored; no secrets in repo |
| **NFR-05** | **Privacy** | Only data needed for journey; no tracking pixels; no 3rd-party analytics |
| **NFR-06** | **Observability** | Structured logs include ticket ID, actor ID, action, timestamp; greppable |
| **NFR-07** | **Portability** | Run locally with **one command** (`supabase start` + `next dev`) on dev laptop |
| **NFR-08** | **Browser support** | Latest 2 versions Chrome, Edge, Firefox, Safari; responsive down to 360 px |
| **NFR-09** | **Accessibility** | Semantic HTML, keyboard-navigable forms, labels; WCAG 2.1 AA **not** targeted but no blockers |
| **NFR-10** | **Internationalization** | English only for MVP; strings centralized |
| **NFR-11** | **Maintainability** | README explains run/test/seed; code style enforced by linter |
| **NFR-12** | **Data retention** | Tickets + comments retained ≥ **1 academic year**; older records archived/deleted per documented policy |
| **NFR-13** | **Testability** | ≥ **7 automated tests** covering: create, ownership, assignment, comment, resolve, maintenance link, escalation event |

---

## 6. Business Rules

| ID | Rule |
|---|---|
| **BR-01** | Ticket lifecycle: `Open → Assigned → InProgress → Resolved → Closed`. **`Closed` is terminal**. |
| **BR-02** | Only the **original requester** (or Agent/Admin) may view a ticket. Agents/Admins may view any. |
| **BR-03** | Requester may edit content **only while `Open`** and only if no Agent has touched it. Once any Agent edits, requester can only **comment**. |
| **BR-04** | Only Agent/Admin may change: assignee, priority, category, internal comments, linked work-order, status. |
| **BR-05** | Requester may **reopen** a `Resolved` ticket within **7 days** of resolution. After 7 days ticket auto-`Closed` and cannot be reopened. |
| **BR-06** | **Public comments** visible to requester. **Internal comments** visible to Agents/Admins only. Requester never sees internal. |
| **BR-07** | Category + priority suggestions from rules engine are **non-binding**; user/Agent has final say. |
| **BR-08** | Ticket may be linked to **at most one** Maintenance work-order ID. Replacing the link records the previous ID in the event payload. |
| **BR-09** | **Escalation**: if `priority = Urgent` and `status = Open` with no assignee for **> 1 hour**, system publishes `ticket.escalated`. No auto-escalation for other priorities. |
| **BR-10** | Every state transition publishes **exactly one** event. No silent state changes. |
| **BR-11** | User cannot delete own ticket. Only Admin may hard-delete, only within retention window, only with recorded reason. |
| **BR-12** | Ticket IDs are **opaque, monotonically increasing** strings, safe in URLs and notifications. Never reused. |

---

## 7. Permission Matrix

Three roles, no custom RBAC. Enforced by **Postgres RLS** at the DB (see §10).

| Capability | Requester | Agent | Admin |
|---|:---:|:---:|:---:|
| Log in (via Identity) | ✅ | ✅ | ✅ |
| Create ticket | ✅ | ✅ | ✅ |
| View **own** tickets | ✅ | ✅ | ✅ |
| View **all** tickets | ❌ | ✅ | ✅ |
| Comment on own ticket (public) | ✅ | ✅ | ✅ |
| Internal comment | ❌ | ✅ | ✅ |
| Edit own ticket while `Open` | ✅ | ✅ | ✅ |
| Change priority / category | ❌ | ✅ | ✅ |
| Assign ticket | ❌ | ✅ | ✅ |
| Link Maintenance work-order | ❌ | ✅ | ✅ |
| Resolve ticket | ❌ | ✅ | ✅ |
| Reopen own resolved ticket (≤7 d) | ✅ | ✅ | ✅ |
| Manage categories | ❌ | ❌ | ✅ |
| View basic counts | ❌ | ✅ | ✅ |
| Hard-delete ticket | ❌ | ❌ | ✅ |

---

## 8. Constraints (from `requirement.md` §5)

| ID | Constraint |
|---|---|
| **CON-01** | Small student team (3–5 members) |
| **CON-02** | One academic semester (~4 months) |
| **CON-03** | **0 THB budget**; free-tier only |
| **CON-04** | No microservices; no K8s; no service mesh; no event-bus product; no message broker cluster |
| **CON-05** | External deps (Identity, Notification Hub, Maintenance) treated as **contracts**; stubs acceptable for MVP demo |
| **CON-06** | No LLM/AI in request path |
| **CON-07** | English only |
| **CON-08** | Web only (no native iOS/Android) |
| **CON-09** | Data must reside in services accessible from Thailand on free tiers |
| **CON-10** | Dependencies MIT/Apache/BSD only (no GPL/AGPL) |
| **CON-11** | Repo hygiene: no secrets, no large binaries, no committed node_modules |

---

*(continued in next sections — architecture, data model, API, security, deployment, risks, acceptance criteria)*

---

## 9. Architecture

**Source of truth:** `architecture.md` (full detail). **Decision record:** `ADR-001-stack.md`.

### 9.1 Stack (locked 2026-08-14)

```
Frontend  = Next.js 14+ (App Router) + TypeScript + Tailwind
Backend   = Next.js Route Handlers (Node runtime)
Database  = Supabase Postgres 15 (managed)
Auth      = Supabase Auth (OIDC client of campus Identity in prod; standalone in dev)
AuthZ     = Postgres Row Level Security (policies keyed off auth.uid() + role claim)
Events    = events outbox table + log fallback (synchronous publish)
Hosting   = Vercel Hobby (free) + Supabase Free (500 MB DB, 2 projects, 50 k MAU)
Local dev = supabase start  +  next dev
```

### 9.2 Why this stack

- **Postgres fits schema 1:1** — FK, CHECK, enum, partial unique index, queue view (3-table join) all native.
- **RLS = permission matrix in SQL** — bug in API can't bypass "Requesters only see own tickets" (BR-02).
- **Student-team familiarity** — Next.js + Postgres + Supabase has the most tutorials, SO answers, AI code-assist coverage.
- **Quota fits MVP** — 500 MB DB ≈ 1 academic year at 200 tickets/day (~365 MB).
- **One-command dev (NFR-07)** — `supabase start` brings up Postgres + Auth + Studio in Docker.
- **Migration path is clean** — schema is plain Postgres, app is plain Next.js; nothing exotic to unwind.

### 9.3 Components

| Component | Owns | Does NOT own |
|---|---|---|
| **Next.js UI** | Screens: Create Ticket, My Tickets, Ticket Detail, Agent Queue, Admin Counts, Category Manager | Auth, persistence, authorization |
| **Next.js API** | Request validation, orchestration, publishing events, calling Notification Hub | Direct DB writes that should be policy-gated |
| **Postgres + RLS** | Source of truth; enforces FKs, CHECK, state-machine guard, permission matrix via policies | Sending notifications |
| **Supabase Auth** | Issue/verify JWTs; manage sessions; OIDC dance with Identity | Role assignment beyond default `Requester` (promote via seed/Auth Hook) |
| **Vercel Cron** | Nightly: auto-close Resolved > 7 d; 15-min: escalation check for Urgent + unassigned > 1 h | Anything real-time |
| **Webhook handler** | Verify HMAC of `maintenance.status_changed`; look up ticket by work-order ID; update status (verify link still current); emit event | Sending notifications back to Maintenance |
| **External: Identity** | Real authentication in production | Anything in our domain |
| **External: Notification Hub** | Fan-out to email/LINE/push on ticket events | Anything else |
| **External: Maintenance** | Owns work-orders; tells us when they change | Our ticket state |

### 9.4 System diagram

```
Browser (Next.js SPA)
   │ HTTPS, JWT
   ▼
Vercel (free tier)
 ├─ Next.js Route Handlers (API)
 ├─ /api/webhooks/maintenance
 └─ Vercel Cron (escalation + auto-close)
   │ SQL
   ▼
Supabase (free tier)
 ├─ Postgres + RLS (source of truth)
 ├─ Auth (JWT issuer)
 └─ Storage (reserved, unused in MVP)

External (contracts):
 ├─ Identity     ← OIDC client (Supabase Auth)
 ├─ Notification Hub ← receives ticket.* events
 └─ Maintenance  ← POSTs status_changed (HMAC)
```

### 9.5 Key flows (summary)

1. **Create ticket** → SPA → `POST /api/tickets` → DB insert + events outbox row → outbox publisher → Notification Hub.
2. **Agent resolves** → SPA → `POST /api/tickets/{id}/resolve` → state-machine check → DB update + outbox row (`ticket.resolved`).
3. **Maintenance event** → webhook → HMAC verify → lookup by `work_order_id` → re-verify link still current → status update + outbox row (`ticket.status_changed`, source=`maintenance`).
4. **Escalation (BR-09)** → cron query every 15 min → for each match: set `escalated_at`, write outbox row (`ticket.escalated`). Idempotent via `escalated_at IS NULL` guard.

---

## 10. Data Model

**Source of truth:** `DataModel.md` (full schema, field types, CRUD matrices, capacity math). Summary below.

### 10.1 Entities

| # | Entity | Purpose |
|---|---|---|
| 1 | **User** | Local cache of identity + role |
| 2 | **Category** | Lookup table for ticket classification |
| 3 | **Ticket** | Core record |
| 4 | **Comment** | Append-only thread on a ticket |
| 5 | **Event (outbox)** | Implementation-only — every state transition emits exactly one (BR-10) |

```
User      1—N  Ticket   (as requester)
User      1—N  Ticket   (as assignee, nullable)
User      1—N  Comment  (as author)
Category  1—N  Ticket
Ticket    1—N  Comment
Ticket    N—1  Ticket   (linked maintenance work-order by string id, NOT FK — external system)
```

### 10.2 Key fields

| Entity | Key fields |
|---|---|
| `User` | `id` (= Identity UUID), `display_name`, `email`, `role` enum, `created_at`, `last_seen_at` — **no password/token** |
| `Category` | `id` (slug), `name` (unique among active), `description?`, `is_active`, `created_at`, `updated_at` |
| `Ticket` | `id` (`T-NNNNNN` monotonic), `requester_id` (FK), `assignee_id` (FK nullable), `category_id` (FK), `subject` (≤200), `description` (≤5000), `priority` enum, `status` enum, `maintenance_work_order_id` (string, ≤1), `resolution_note?`, `created_at`, `updated_at`, `resolved_at?`, `closed_at?`, `escalated_at?` |
| `Comment` | `id` (`C-NNNNNN` monotonic), `ticket_id` (FK), `author_id` (FK), `body` (≤5000), `visibility` enum, `created_at` |
| `Event` | `id`, `event_type`, `aggregate_id` (= ticket_id), `payload` json, `created_at`, `published_at?` |

### 10.3 Enums (DB-level CHECK)

```
Ticket.priority       IN ('Low','Medium','High','Urgent')
Ticket.status         IN ('Open','Assigned','InProgress','Resolved','Closed')
Comment.visibility    IN ('Public','Internal')
User.role             IN ('Requester','Agent','Admin')
```

### 10.4 Foreign keys & cascades

```
Ticket.requester_id  → User.id      ON DELETE RESTRICT
Ticket.assignee_id   → User.id      ON DELETE SET NULL
Ticket.category_id   → Category.id  ON DELETE RESTRICT
Comment.ticket_id    → Ticket.id    ON DELETE RESTRICT
Comment.author_id    → User.id      ON DELETE RESTRICT
```

### 10.5 State machine (BR-01, enforced in code + DB)

```
Open ──► Assigned ──► InProgress ──► Resolved ──► Closed (auto, +7d)
 │         │             │              │
 └─────────┴─────────────┘              │
         (any → Resolved allowed)       │
                                        ▼
                              Open (reopen ≤7d)
```

`Closed` is terminal. No outbound transitions.

### 10.6 Capacity check (NFR-02)

```
200 tickets/day × ~5 KB × 365 d ≈ 365 MB/year
Free tier: 500 MB → fits with ~27% headroom
```

### 10.7 Sensitive data

| Data | Handling |
|---|---|
| `User.email`, `display_name` | PII; encrypted at rest where supported; not in API list responses |
| `Ticket.description` | May contain sensitive context (academic, health); access controlled (BR-02); not exported |
| `Ticket.id` (monotonic) | Safe to log/URLs |
| `maintenance_work_order_id` | Internal-only; never shown to requester |
| Identity `User.id` | Never logged at verbose level; not in URLs |

---

## 11. API Surface

**Source of truth:** `api_contract.md` (full request/response schemas, error codes, RLS sketch).

### 11.1 Endpoint inventory

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/logout` | Any | Clear session |
| `GET`  | `/api/auth/me` | Any | Current user + role |
| `POST` | `/api/tickets` | Req/Agent/Admin | FR-02: create ticket |
| `GET`  | `/api/tickets/me` | Any | FR-04: my tickets |
| `GET`  | `/api/tickets` | Agent/Admin | FR-08: agent queue |
| `GET`  | `/api/tickets/{id}` | Own/Agent/Admin | FR-05: ticket detail |
| `PATCH`| `/api/tickets/{id}` | Own (limited) / Agent/Admin | Edit content / priority / category / assignee / work-order |
| `POST` | `/api/tickets/{id}/assign` | Agent/Admin | FR-09: assign |
| `POST` | `/api/tickets/{id}/resolve` | Agent/Admin | FR-13: resolve |
| `POST` | `/api/tickets/{id}/reopen` | Own / Agent/Admin | BR-05: reopen ≤7d |
| `POST` | `/api/tickets/{id}/link-maintenance` | Agent/Admin | FR-12: link work-order |
| `POST` | `/api/tickets/{id}/comments` | Own / Agent/Admin | FR-06/11: add comment |
| `POST` | `/api/tickets/suggest` | Any | FR-07: rules-engine suggestion |
| `GET`  | `/api/admin/counts` | Agent/Admin | FR-17: basic counts |
| `GET`  | `/api/categories` | Any | List active categories |
| `POST`/`PATCH`/`DELETE` | `/api/categories[/{id}]` | Admin | FR-18: manage categories |
| `POST` | `/api/webhooks/maintenance` | External (HMAC) | FR-14: receive status change |
| `GET`  | `/api/health` | Open | Liveness check |

### 11.2 Auth

- JWT via Supabase Auth in `Authorization: Bearer <jwt>`
- Role claim from `users.role` via custom JWT claim (Auth Hook)
- All endpoints except `/api/auth/*`, `/api/webhooks/*`, `/api/health` require auth

### 11.3 Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input schema mismatch |
| 400 | `INVALID_STATE_TRANSITION` | BR-01 violated |
| 400 | `EDIT_WINDOW_EXPIRED` | BR-03 (Agent touched ticket → requester can't edit) |
| 400 | `REOPEN_WINDOW_EXPIRED` | BR-05 (>7 d) |
| 401 | `UNAUTHENTICATED` | No/expired JWT |
| 403 | `FORBIDDEN` | JWT valid but role insufficient |
| 404 | `NOT_FOUND` | Resource missing OR RLS hides |
| 409 | `VERSION_CONFLICT` | Optimistic concurrency mismatch |
| 409 | `DUPLICATE` | Unique constraint violated |
| 422 | `BUSINESS_RULE_VIOLATED` | Other rule |
| 500 | `INTERNAL_ERROR` | Server bug |
| 503 | `EXTERNAL_DEPENDENCY_DOWN` | Notification Hub / Identity down |

### 11.4 Response envelope

```json
// success
{ "data": { ... }, "meta": { "request_id": "...", "timestamp": "..." } }

// error
{ "error": { "code": "...", "message": "...", "details": {...}, "request_id": "..." } }
```

---

## 12. Events (outbound)

All ticket state transitions publish **exactly one** event (BR-10) via the `events` outbox table. A small publisher process polls unsent rows and POSTs to Notification Hub. MVP fallback: synchronous publish + log on failure (documented known limitation).

### 12.1 Common envelope

```json
{
  "event_id": "evt_xxxxxxxx",
  "event_type": "ticket.created",
  "event_version": 1,
  "occurred_at": "2026-08-14T15:00:00.000Z",
  "aggregate_id": "T-000123",
  "payload": { ... }
}
```

### 12.2 Event types

| Event | Trigger | Key payload fields | Consumers |
|---|---|---|---|
| `ticket.created` | FR-02 | `ticket_id, requester_id, category_id, priority, subject, created_at` | Notification Hub, Analytics |
| `ticket.assigned` | FR-09 | `ticket_id, assignee_id, assigned_by, previous_assignee_id, assigned_at` | Notification Hub |
| `ticket.resolved` | FR-13 | `ticket_id, resolved_by, resolution_note, resolved_at` | Notification Hub, Analytics |
| `ticket.escalated` | FR-15 | `ticket_id, priority, created_at, age_minutes` | Notification Hub, Analytics |
| `ticket.status_changed` | FR-14 | `ticket_id, from_status, to_status, source, work_order_id, reason` | Analytics, Audit |
| `ticket.work_order_linked` | FR-12 | `ticket_id, work_order_id, previous_work_order_id, linked_by` | Analytics |

---

*(continued — security, deployment, risks, acceptance criteria, references)*

---

## 13. Security Considerations

### 13.1 Authentication

- **No passwords stored.** Identity is the source of truth for credentials (NFR-04, CON-05).
- **JWT verified on every API call.** `Authorization: Bearer <jwt>` required except whitelist.
- **JWT contains `role` claim** via Supabase Auth Hook (reads `users.role` and injects into JWT on login).
- **Session in httpOnly cookie** (Supabase default); never accessible to JS.
- **OIDC client of campus Identity** in production; Supabase Auth standalone in dev (CON-05 allows stub).

### 13.2 Authorization (RLS)

- **Permission matrix enforced at DB**, not just in API code. RLS policies map `requirement.md` §4 1:1.
- **Bug in any API endpoint can't bypass** "Requesters only see own tickets" (BR-02).
- Requesters get `404 NOT_FOUND` for tickets they don't own — **RLS hides existence** (don't reveal whether a resource exists).
- `comments.visibility = 'Internal'` filtered by RLS — Requesters never see internal comments (BR-06).

### 13.3 Secrets management

- **No secrets in repo** (CON-11). Verified by AC-19 (grep for `API_KEY=`, `SECRET=`, `PASSWORD=`, `TOKEN=`, `sk_`, `pk_live`).
- `.env.example` ships with placeholder values only.
- Real secrets in **Vercel environment variables** (dashboard) and **Supabase project settings**.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — lint rule prevents it from being imported into client components.

### 13.4 Webhook authentication

- **HMAC signature** on every `POST /api/webhooks/maintenance` — `X-Signature: sha256=<hex>` using `MAINTENANCE_WEBHOOK_SECRET`.
- **Constant-time compare** to prevent timing attacks.
- **Replay protection** — dedup on `work_order_id + occurred_at` (see AC-23).

### 13.5 Transport

- HTTPS only (NFR-04). HTTP → HTTPS redirect enforced by Vercel.
- `Strict-Transport-Security` header on all responses.

### 13.6 Privacy (NFR-05)

- **No tracking pixels**, no Google Analytics, no Facebook Pixel.
- **No IP addresses stored** — only minimal app data (DataModel §8).
- **No fingerprinting** (browser, device).
- `User.email` is PII — never in API list responses; visible to user themself + Admins only.
- `Ticket.description` treated as confidential — access controlled (BR-02).

### 13.7 Input handling

- All inputs validated at API boundary (zod schema in Route Handler).
- **SQL injection impossible by design** (parameterized queries via Supabase client). AC-21 verifies.
- Body size limits on webhook endpoint (10 KB cap) to prevent DoS.
- Plain-text comments only (no HTML) — XSS surface minimized.

### 13.8 Threat model (lightweight)

| Threat | Mitigation |
|---|---|
| Stolen JWT | Short expiry (1 h); refresh via Supabase; `role` claim can't be forged (server-signed) |
| Privilege escalation via RLS bug | Code review every `CREATE POLICY`; test in AC-2, AC-12 |
| Webhook spoofing | HMAC + secret rotation |
| Notification Hub leak (secrets in event payload) | Strip PII from event payloads (use IDs not names) |
| DoS via huge payloads | Body size limits; rate limit per IP (post-MVP) |
| Data exfiltration by ex-Admin | Admin role demotion triggers JWT refresh; future: audit log review |

---

## 14. Deployment

### 14.1 Environments

| Env | Frontend | DB | Purpose |
|---|---|---|---|
| **Local** | `localhost:3000` (`next dev`) | `localhost:54322` (`supabase start`) | Dev laptop |
| **Preview** | Vercel preview URL per PR | Supabase project (dev branch) | PR review |
| **Production** | Vercel (`*.vercel.app` or custom domain) | Supabase project (main branch) | Live users |

### 14.2 Local dev (NFR-07) — one command each in 2 terminals

```bash
# terminal 1
npx supabase start           # Postgres + Auth + Studio on :54322/:54323

# terminal 2
npm run dev                  # Next.js on :3000
```

Migrations:
```bash
npx supabase migration new <name>
# write SQL → supabase/migrations/<timestamp>_<name>.sql
npx supabase db push            # apply to local
npx supabase db push --linked   # apply to hosted
```

Seed:
```bash
# supabase/seed.sql creates 3 demo users, 5 categories, sample tickets
npx supabase db reset           # reset + migrate + seed
```

### 14.3 Production deploy

| Step | Where | How |
|---|---|---|
| Push code | GitHub | `git push` |
| Deploy app | Vercel | Auto on push to `main`; preview URLs for PRs |
| Apply schema | Supabase | `supabase db push --linked` from CI |
| Set env vars | Vercel dashboard | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `MAINTENANCE_WEBHOOK_SECRET`, `NOTIFICATION_HUB_URL` |
| Configure OIDC | Supabase dashboard | Add campus Identity as external OIDC provider (prod only) |
| Setup Cron | Vercel dashboard | `vercel.json` — escalation every 15 min, auto-close daily 02:00 |

### 14.4 Environment variables (full list)

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Anon JWT issuer key (safe to expose — RLS protects) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Bypasses RLS for admin operations (migrations, outbox publisher) |
| `MAINTENANCE_WEBHOOK_SECRET` | Server only | HMAC secret for incoming webhooks |
| `NOTIFICATION_HUB_URL` | Server only | Outbound events endpoint |
| `NOTIFICATION_HUB_TOKEN` | Server only | Bearer for outbound auth |

### 14.5 CI/CD

- **GitHub Actions** runs on every PR: lint, type-check, unit tests, integration tests.
- Migration files applied to **preview Supabase project** on PR open.
- Merge to `main` triggers Vercel prod deploy + Supabase migration push (manual approval gate).

---

## 15. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | External Identity not ready by demo | Medium | Medium | Use Supabase Auth in dev; document OIDC swap. Demo with stub login. |
| **R2** | Supabase free-tier policy changes | Low | High | Schema is plain Postgres; Supabase is OSS → self-hostable. |
| **R3** | Notification Hub endpoint changes shape | Medium | Medium | Wrap all outbound calls in `lib/notify.ts` with one place to update. Versioned event envelope (§12.1). |
| **R4** | Maintenance webhook never delivered in MVP | Medium | Low | Build consumer anyway; demo with `curl` script. |
| **R5** | Team new to RLS → policy bug | Medium | Medium | Day-1 task: port permission matrix → `CREATE POLICY`. Code review every policy. AC-12 covers all role gates. |
| **R6** | Outbox publisher not implemented | Medium | Medium | MVP fallback: synchronous publish + log on failure (documented). Upgrade later if time permits. |
| **R7** | Free-tier quotas hit during demo | Low | Medium | Monitor dashboards; have screenshots queued. 500 MB DB ≈ 1 year capacity. |
| **R8** | Vercel cold start during live demo | Low | Low | Pre-warm `/` 5 min before demo. |
| **R9** | Two Agents assign same ticket concurrently | Medium | Low | Optimistic concurrency on `updated_at` (AC-15). Loser sees friendly conflict message. |
| **R10** | Comments/edit history mess if we change "append-only" decision | Low | Medium | Locked in DataModel §5: no edit, no delete in MVP. AC-14 enforces event completeness. |
| **R11** | Team ramp-up on Next.js App Router | Medium | Medium | Pair-program first route handler. Use App Router from day 1 (avoid legacy pages dir). |
| **R12** | Schedule slip on backend → demo with mock UI | Medium | High | Slice vertically: ship 1 happy-path (create → assign → resolve) by mid-semester, then expand. |

---

## 16. Acceptance Criteria

**Source of truth:** `acceptance_criteria.md` (full Given/When/Then for all 23 ACs).

The **7 mandatory** tests per NFR-13:

| AC# | Title | Covers |
|---|---|---|
| AC-1 | Create ticket | FR-02, FR-03 |
| AC-2 | Ownership visibility | BR-02 |
| AC-3 | Assignment | FR-09, BR-01 |
| AC-4 | Add comment | FR-06, FR-11, BR-06 |
| AC-5 | Resolve ticket | FR-13, BR-01 |
| AC-6 | Maintenance link + status sync | FR-12, FR-14, BR-08 |
| AC-7 | Escalation event | FR-15, BR-09 |

Additional **16** for business rules + non-functional + defense:

| AC# | Title | Covers |
|---|---|---|
| AC-8 | Edit window (BR-03) | requester can't edit after Agent touches |
| AC-9 | Reopen within 7 days | BR-05 |
| AC-10 | Auto-close after 7 days | BR-05 |
| AC-11 | Public vs Internal visibility | BR-06 |
| AC-12 | Permission matrix (all 15 capabilities × 3 roles) | BR-04 |
| AC-13 | Monotonic ticket ID | BR-12 |
| AC-14 | Every transition emits exactly one event | BR-10 |
| AC-15 | Optimistic concurrency | DataModel §10 |
| AC-16 | Notification Hub integration | FR-16 |
| AC-17 | Capacity (p95 < 2s, 50 concurrent) | NFR-02 |
| AC-18 | Local dev one-command | NFR-07 |
| AC-19 | Secrets hygiene (grep) | NFR-04, CON-11 |
| AC-20 | No secrets in DB schema | NFR-04 |
| AC-21 | SQL injection | defense |
| AC-22 | RLS bypass awareness (service role leak) | defense |
| AC-23 | Webhook replay idempotency | defense |

> **Definition of done** for MVP: AC-1 through AC-7 **must** pass. AC-8 through AC-23 **should** pass (track as separate tickets; demo can ship without all of them).

---

## 17. Open Questions

Need team/product decision before sprint kickoff:

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Reopen → emit `ticket.reopened` event? | product | AC-14 |
| Q2 | Notification Hub mock — npm package or curl script for local dev? | backend | AC-16 |
| Q3 | Auto-close cron — separate from escalation cron or combined? | backend | AC-10, AC-7 |
| Q4 | RLS test framework — pgTAP or integration tests via Supabase client? | backend | AC-2, AC-12 |
| Q5 | `Idempotency-Key` header in MVP or defer? | backend | API retry semantics |
| Q6 | Category hard-delete behavior when tickets reference it — block, or force + reconcile? | product | migration path |
| Q7 | Comment soft-delete on hard-delete of ticket (BR-11) — cascade or preserve? | product | AC-20 |

---

## 18. Assumptions

These are **assumed true** for MVP. If any turns out false, raise immediately:

| # | Assumption | Source |
|---|---|---|
| A1 | Students will use a web form instead of LINE / email | Problem.md §7 |
| A2 | Category + priority rules are enough for v1; no LLM needed | Problem.md §7, CON-06 |
| A3 | Identity service is available, stable, documented by its team | Problem.md §7, FR-01, CON-05 |
| A4 | `maintenance.status_changed` is a real, documented webhook | Problem.md §7, FR-14, CON-05 |
| A5 | Agents will adopt a new tool | Problem.md §7 |
| A6 | Volume ≤ low hundreds/day — single-node MVP | Problem.md §7, NFR-02 |
| A7 | English-only UI acceptable for v1 | Problem.md §7, NFR-10, CON-07 |
| A8 | Notifications go through existing Notification Hub | Problem.md §7, FR-16, CON-05 |

> If A3, A4, or A8 fail, MVP demo runs with documented stubs (CON-05).

---

## 19. Out-of-Scope (deferred — do not implement)

Anything in `requirement.md` §6 or `Problem.md` §8 is **NOT** in MVP. Don't build. Don't write tests. Don't scope-creep.

If you think something should be added:
1. Write a 1-page proposal with `Problem` and `Why now?`
2. Update `requirement.md` (bump version)
3. Add to backlog for next semester

---

## 20. References (source-of-truth docs)

| Doc | What it contains |
|---|---|
| `PRD_Helpdesk.md` | Original brief (teacher-given) |
| `Problem.md` | Problem analysis, user journeys, pain points, assumptions |
| `requirement.md` | FR, NFR, BR, permission matrix, constraints, out-of-scope |
| `DataModel.md` | Entity field-by-field, CRUD, constraints, capacity math, sensitive data, duplicate risk |
| `architecture.md` | Stack options + decision, components, key flows, deployment, risk register |
| `ADR-001-stack.md` | 1-page decision record (lock the "why Supabase") |
| `present_option.md` | Option comparison + team-facing pitch |
| `api_contract.md` | Full REST + event payloads + RLS sketch + error codes |
| `acceptance_criteria.md` | All 23 ACs in Given/When/Then |

External:
- [Postgres RLS docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth + RLS guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js App Router](https://nextjs.org/docs/app)

---

*End of PRD — v1.0 (Consolidated). Bump version on any source-doc change.*

