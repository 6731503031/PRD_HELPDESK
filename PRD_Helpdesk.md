# Product Requirements Document — Helpdesk Platform (Team 14)

| Field | Value |
|---|---|
| **Version** | 1.0 (Template-aligned) |
| **Date** | 2026-08-14 |
| **Status** | Implementation-ready |
| **Approved Stack** | Vercel + Supabase + Next.js (per `ADR-001-stack.md`) |
| **Source docs** | `PRD_Helpdesk.md`, `Problem.md`, `requirement.md`, `DataModel.md`, `architecture.md`, `ADR-001-stack.md`, `api_contract.md`, `acceptance_criteria.md` |

> **Reading guide.** This PRD follows the team's required template. Each section lists the essentials and points to the source doc for full detail. When this PRD and a source doc disagree, the source doc wins.

---

## 1. Product Overview

### Product Name
**Helpdesk Platform** (working title: Helpdesk MFU)

### Problem Statement
Students and staff at MFU have no single, structured, trackable channel to report issues and follow them through to resolution. Requests scatter across email, LINE groups, in-person visits, and ad-hoc DMs. The result: requests get lost, nobody owns the issue end-to-end, there is no shared status, no SLA, and no audit trail. Cross-team coordination (e.g., Helpdesk ↔ Maintenance) is manual and error-prone.

### Target Users
- **Primary — Requesters:** students, faculty, staff who need to report and track issues.
- **Primary — Agents:** Helpdesk staff / front-line support who triage, assign, and resolve.
- **Secondary — Admins:** Helpdesk lead who manages categories and views basic counts.
- **Stakeholder — Integrators:** Maintenance, Notification, Identity, Analytics teams (consume events; not direct users).

### Product Goal
Give every request a **ticket identity, an owner, a status, and an event stream** that other systems can subscribe to. One place to report, one way to track, one trail to audit.

**Success indicators:**
- No "lost" tickets — every request has a Ticket ID + audit trail.
- Agents triage without channel-switching (queue + comments + status in one place).
- Cross-team handoff to Maintenance works via linked work-order ID (no copy-paste).
- Compliance can reconstruct any ticket's history from event log.

---

## 2. Scope

### In Scope

- Web app with primary screens: **Create Ticket**, **My Tickets**, **Agent Queue** (plus Ticket Detail, Admin Counts, Category Manager).
- **Rules-based suggestion engine** for category + priority (keyword + urgency signals). User can override.
- **Event publisher** for `ticket.created / assigned / escalated / resolved / status_changed / work_order_linked`.
- **Two thin integrations**:
  - Consume `maintenance.status_changed` (webhook in).
  - Consume Identity service for login (OIDC).
- **Async comments** (no real-time chat).
- **English-only UI** with strings centralized.
- **Permission enforcement at DB** via Postgres Row Level Security.
- **Notifications** via existing Notification Hub (no SMTP/SMS of our own).

### Out of Scope

| Area | Excluded |
|---|---|
| **Intake** | Email parser, LINE/Messenger/WhatsApp bot, phone/voice logging, chatbot |
| **Triage** | LLM-based suggestions, SLA timers (except Urgent 1-hour auto-escalation), custom workflows, round-robin, auto-reply templates |
| **UX** | Native mobile apps, multi-language UI, file attachments, rich-text editor, real-time chat, dark mode |
| **Reporting** | Dashboards (only basic counts), CSAT/NPS, agent performance metrics |
| **Permissions** | Custom RBAC beyond 3 roles, bulk ops, ticket templates, public KB/FAQ |
| **Compliance** | Fine-grained audit-log UI, configurable retention, PDPA export tooling, pentest |
| **Platform** | Multi-tenant, public REST API for 3rd parties, webhooks for arbitrary subscribers |

---

## 3. User Roles

### User (Requester)
- **Who:** Students, faculty, staff.
- **Can:** Create tickets, view own tickets, add public comments, edit own ticket while `Open` (and no Agent has touched it), reopen own resolved ticket within 7 days.
- **Cannot:** View other people's tickets, assign, change priority/category, resolve, link work-orders, post internal comments, manage categories.
- **Auth:** via campus Identity service (SSO). Helpdesk stores no passwords.

### Agent
- **Who:** Helpdesk staff / front-line support.
- **Can:** Everything Requester can + view all tickets, change priority/category, assign tickets, link Maintenance work-orders, mark resolved, add internal comments, view basic counts.
- **Cannot:** Manage categories, hard-delete tickets.
- **Auth:** same Identity service; role assigned out-of-band (seed/Identity group).

### Admin
- **Who:** Helpdesk lead.
- **Can:** Everything Agent can + manage categories (add/rename/deactivate), hard-delete tickets within retention window (with recorded reason).
- **Cannot:** (nothing in MVP — full privileges).
- **Auth:** same Identity service; role assigned out-of-band.

---

## 4. User Journey

### Requester — Main Journey

1. **Log in** at `https://helpdesk.mfu.ac.th` via campus Identity (SSO). Browser stores session cookie.
2. **Click "Create Ticket"** on home page. Form: subject, description, category (dropdown), urgency (dropdown).
3. **See suggestion** for category + priority from rules engine (non-binding — user can override).
4. **Submit.** System returns Ticket ID (e.g., `T-000123`). Redirected to ticket detail.
5. **Receive notifications** automatically on `ticket.assigned` and `ticket.resolved` via Notification Hub (email/LINE/push — depending on user pref).
6. **Track** in "My Tickets" — see all own tickets with status, last updated, category, comment count.
7. **Add comment** or **reopen** if resolved within 7 days.

### Agent — Main Journey

1. **Log in** as Agent. Landing page is Agent Queue (sorted by priority + age).
2. **Triage** — open a ticket: read description, suggested category, public comments.
3. **Act** — assign (self or another Agent), change priority/category, link a Maintenance work-order ID, add internal comment.
4. **Resolve** — add resolution note, click Resolve. Status flips to `Resolved`. Notification Hub fans out to requester.
5. **Audit** — full event log per ticket reconstructs every state change.

### Cross-team — Main Journey

1. Agent links `T-000123` to Maintenance work-order `WO-2024-0042`.
2. Maintenance technician works on the work-order. When their status changes, they POST `maintenance.status_changed` to our webhook.
3. Webhook handler verifies HMAC, looks up ticket by work-order ID, updates ticket status, publishes `ticket.status_changed` event.
4. Requester sees status update on their ticket without manual notification.

---

## 5. Functional Requirements

| ID | Requirement |
|---|---|
| **FR-01** | User logs in through campus Identity (SSO). Helpdesk stores no passwords. |
| **FR-02** | Logged-in user can create a ticket with subject, description, category, urgency. System returns unique Ticket ID. |
| **FR-03** | System publishes `ticket.created` event on creation (ticket ID, requester ID, category, priority, timestamp). |
| **FR-04** | User can view My Tickets — every ticket they created — with status, last update, category. |
| **FR-05** | User can open one of their own tickets to see full details, status history, comment thread. |
| **FR-06** | User can add a public comment to their own ticket (plain text). |
| **FR-07** | System suggests a category and priority at creation using rules engine. User may override. |
| **FR-08** | Agent can open Agent Queue — all tickets sortable by priority + age. |
| **FR-09** | Agent can assign a ticket to themselves or another Agent. |
| **FR-10** | Agent can change a ticket's priority and category. |
| **FR-11** | Agent can add internal comments (visible to Agents/Admins only) in addition to public comments. |
| **FR-12** | Agent can link a ticket to an existing Maintenance work-order ID. |
| **FR-13** | Agent can mark a ticket Resolved with optional resolution note. System publishes `ticket.resolved`. |
| **FR-14** | When system receives `maintenance.status_changed` for a linked work-order, update ticket status and publish status-change event. |
| **FR-15** | System publishes `ticket.escalated` when priority = Urgent and unassigned for > 1 hour. |
| **FR-16** | System notifies requester via Notification Hub on `ticket.created`, `ticket.assigned`, `ticket.resolved`. |
| **FR-17** | Admin can view basic count summary: total, open, resolved today, by category. |
| **FR-18** | Admin can manage list of categories (add, rename, deactivate). Priorities are a fixed enum. |

---

## 6. Non-Functional Requirements

### NFR-01 Performance

- p95 response time **< 2 s** for all endpoints under load (NFR-02).
- Sustain **200 tickets/day** and **50 concurrent active users** without degradation.
- Agent Queue query (sort by priority + age, join category + user) responds < 500 ms.
- Latest 2 versions of Chrome, Edge, Firefox, Safari supported (NFR-08).
- Responsive layout down to **360 px** width.
- Accessibility: semantic HTML, keyboard-navigable forms, labels for inputs. WCAG 2.1 AA not targeted but no blockers (NFR-09).

### NFR-02 Security

- HTTPS only (NFR-04). HTTP → HTTPS redirect.
- No passwords stored in Helpdesk (delegated to Identity, NFR-04).
- No secrets in repo (CON-11). `.env.example` has placeholders only.
- Permission matrix enforced at DB via Postgres RLS — API bugs cannot bypass (BR-02).
- Webhooks authenticated via HMAC (`X-Signature: sha256=<hex>`).
- JWT short-lived (1 h); refresh via Supabase.
- Rate limit per IP (post-MVP).
- Only data needed for journey collected (NFR-05). No tracking pixels, no 3rd-party analytics.
- `User.email`, `User.display_name`, `Ticket.description` treated as PII/confidential — access controlled, not exported.
- Structured logs include ticket ID, actor ID, action, timestamp (NFR-06). Greppable.

### NFR-03 Availability

- Best-effort. Documented in README. **No 24/7 SLA claim** (NFR-03).
- Single-region deployment (Vercel + Supabase — auto multi-region backup).
- Postgres daily backup (Supabase Free tier: 7-day PITR for paid, manual backup for free).
- Frontend: Vercel CDN, 99.9% uptime.
- DB: Supabase Free, no SLA but historical uptime > 99.5%.
- No disaster recovery drill in MVP (documented assumption — release early).

### NFR-04 Cost

- **Total infra cost = 0 THB/month** sustained (NFR-01, CON-03).
- Only free-tier services used:
  - Vercel Hobby: 100 GB bandwidth/month, 6 k build minutes/month, 10 s function timeout.
  - Supabase Free: 500 MB DB, 1 GB storage, 2 GB egress, 50 k MAU, 2 projects.
- ~365 MB/year at 200 tickets/day — fits in 500 MB cap with ~27% headroom.
- No paid SaaS during MVP. If a tier upgrade is unavoidable, **escalate** before paying.

### NFR-05 Portability & Maintainability

- Local dev runs on a fresh laptop with **one command** (`supabase start` + `next dev`, NFR-07).
- README explains how to run, test, and seed data (NFR-11).
- Code style enforced by linter (ESLint + Prettier).
- All dependencies MIT/Apache/BSD (CON-10).
- All UI strings centralized for future translation (NFR-10).
- Schema is plain Postgres; Supabase is OSS → self-hostable later if needed.

### NFR-06 Data & Compliance

- Tickets + comments retained **≥ 1 academic year** (NFR-12). Older: archive or delete per documented policy.
- One academic year = ~9 months active + 3 months archive.
- No GDPR/PDPA export tooling in MVP (out-of-scope).
- Audit trail via event log (BR-10) — sufficient for compliance review.

### NFR-07 Testability

- **Minimum 7 automated tests** (NFR-13) covering: create, ownership, assignment, comment, resolve, maintenance link, escalation event.
- See `acceptance_criteria.md` for full 23 ACs (7 mandatory + 16 extra).
- Local + CI test runs in < 5 min.

---

## 7. Business Rules

| ID | Rule |
|---|---|
| **BR-01** | Ticket lifecycle: `Open → Assigned → InProgress → Resolved → Closed`. **`Closed` is terminal.** |
| **BR-02** | Only the original requester (or Agent/Admin) may view a ticket. Agents/Admins may view any. |
| **BR-03** | Requester may edit content **only while `Open`** AND no Agent has touched it. After Agent edit, requester can only comment. |
| **BR-04** | Only Agent/Admin may change: assignee, priority, category, internal comments, linked work-order, status. |
| **BR-05** | Requester may reopen a `Resolved` ticket within **7 days** of resolution. After 7 days, ticket auto-`Closed` and cannot be reopened. |
| **BR-06** | Public comments visible to requester. Internal comments visible to Agents/Admins only. Requester never sees internal. |
| **BR-07** | Category + priority suggestions from rules engine are **non-binding**. User/Agent has final say. |
| **BR-08** | A ticket may be linked to **at most one** Maintenance work-order ID. Replacing the link records the previous ID in the event payload. |
| **BR-09** | Escalation: if priority = Urgent AND status = Open AND no assignee for > 1 hour, system publishes `ticket.escalated`. No auto-escalation for other priorities. |
| **BR-10** | Every state transition publishes **exactly one** event. No silent state changes. |
| **BR-11** | User cannot delete own ticket. Only Admin may hard-delete, only within retention window, only with recorded reason. |
| **BR-12** | Ticket IDs are opaque, monotonically increasing strings, safe in URLs and notifications. Never reused. |

---

*(continued — Data Model, Architecture, Technology Stack, API/Interfaces, Security, Error Handling, Deployment, Constraints, Risks, Acceptance Criteria, Future Improvements)*

---

## 8. Data Model

**Source of truth:** `DataModel.md` (full field-by-field schema, CRUD matrices, capacity math, sensitive data handling).

### User

Local cache of identity + role. **No password, token, or refresh_token stored** (NFR-04).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | ✅ | PK; equals Identity service's user id |
| `display_name` | string | ✅ | Cached from Identity; refreshed on every login |
| `email` | string | ✅ | Cached from Identity; used for notifications |
| `role` | enum | ✅ | `Requester` \| `Agent` \| `Admin` |
| `created_at` | timestamp | ✅ | First time we saw this user |
| `last_seen_at` | timestamp | ✅ | Updated on every successful login |

**Relationships:**
- `User 1—N Ticket` (as requester)
- `User 1—N Ticket` (as assignee, nullable)
- `User 1—N Comment` (as author)

### Category

Lookup table for ticket classification. Managed by Admin.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | PK; slug (e.g., `it`, `facility`, `academic`) |
| `name` | string | ✅ | Human-readable label; **unique among active** |
| `description` | string | ❌ | One-line tooltip |
| `is_active` | boolean | ✅ | Soft-delete flag |
| `created_at` | timestamp | ✅ | — |
| `updated_at` | timestamp | ✅ | — |

**Relationships:** `Category 1—N Ticket`.

### Ticket

The core record.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | PK; `T-NNNNNN` monotonic, never reused (BR-12) |
| `requester_id` | FK → User | ✅ | Immutable |
| `assignee_id` | FK → User | ❌ | Nullable; must be Agent/Admin when set |
| `category_id` | FK → Category | ✅ | Must be active at write time |
| `subject` | string ≤ 200 | ✅ | — |
| `description` | text ≤ 5000 | ✅ | Plain text |
| `priority` | enum | ✅ | `Low` \| `Medium` \| `High` \| `Urgent` |
| `status` | enum | ✅ | `Open` \| `Assigned` \| `InProgress` \| `Resolved` \| `Closed` |
| `maintenance_work_order_id` | string | ❌ | Single value; replacing records previous in event (BR-08) |
| `resolution_note` | text | ❌ | Required when status → `Resolved` |
| `created_at` | timestamp | ✅ | Immutable; DB-generated |
| `updated_at` | timestamp | ✅ | Bumped on any field change |
| `resolved_at` | timestamp | ❌ | Set on transition to `Resolved` |
| `closed_at` | timestamp | ❌ | Set on transition to `Closed` |
| `escalated_at` | timestamp | ❌ | Set on `ticket.escalated` (BR-09); idempotent guard |

**Relationships:** Ticket ⨝ User (requester), ⨝ User (assignee), ⨝ Category, ⨝ Comment, ⨝ Ticket (self-edge by work-order string id).

### Comment

Append-only thread per ticket. **No edit, no delete** in MVP (BR-11 + NFR-05 audit rationale).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | PK; `C-NNNNNN` monotonic |
| `ticket_id` | FK → Ticket | ✅ | — |
| `author_id` | FK → User | ✅ | Immutable |
| `body` | text ≤ 5000 | ✅ | Plain text |
| `visibility` | enum | ✅ | `Public` (visible to requester) \| `Internal` (Agents/Admins only — BR-06) |
| `created_at` | timestamp | ✅ | Immutable |

### Event (outbox)

Implementation-only — every state transition publishes exactly one event (BR-10). Not part of the domain model; an implementation pattern.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | PK |
| `event_type` | string | ✅ | `ticket.created`, `ticket.assigned`, `ticket.escalated`, etc. |
| `aggregate_id` | string | ✅ | Ticket ID |
| `payload` | json | ✅ | Full event body |
| `created_at` | timestamp | ✅ | — |
| `published_at` | timestamp | ❌ | Set after broker confirms delivery |

**Publisher:** separate process polls unsent rows, ships to Notification Hub. MVP fallback: synchronous publish + log on failure (documented limitation).

### Entity Relationship Diagram

```
User      1—N  Ticket   (as requester)
User      1—N  Ticket   (as assignee, nullable)
User      1—N  Comment  (as author)
Category  1—N  Ticket
Ticket    1—N  Comment
Ticket    N—1  Category
Ticket    N—1  User    (requester_id, FK)
Ticket    N—1  User    (assignee_id, FK nullable)
```

### Key Constraints

- **Enums:** DB-level CHECK constraints on `priority`, `status`, `visibility`, `role`.
- **Foreign keys:** `ON DELETE RESTRICT` for requester, category, comment→ticket, comment→author; `ON DELETE SET NULL` for assignee (Agent leaves → ticket becomes unassigned, not orphaned).
- **State machine:** enforced in code + DB trigger (BR-01). Allowed transitions listed in `DataModel.md` §11.
- **Optimistic concurrency:** `updated_at` check on every PATCH (loser gets 409 + refresh).
- **Timestamps:** all UTC, generated by DB (`now()`), never by client.
- **Unique indexes:** `Ticket.id` (PK), `Comment.id` (PK), `Category.name` unique among active (`UNIQUE INDEX ... WHERE is_active`).

### Capacity Math

```
200 tickets/day × ~5 KB × 365 days ≈ 365 MB/year
Free tier: 500 MB → fits with ~27% headroom
```

---

## 9. Architecture

### Architecture Overview

**One Next.js web app on Vercel, one managed Supabase Postgres database, three thin HTTP edges for external systems.** No microservices, no message broker, no separate worker fleet. Maintenance jobs run via Vercel Cron (escalation every 15 min, auto-close daily). Authorization enforced at the DB via Postgres Row Level Security — a bug in any API endpoint cannot bypass the permission matrix. All timestamps are DB-generated UTC. All integrations are swappable stubs (Identity, Notification Hub, Maintenance).

### Architecture Diagram

```
                     ┌──────────────────────────────┐
                     │        Browser (SPA)         │
                     │   Next.js + Tailwind + React │
                     └──────────────┬───────────────┘
                                    │ HTTPS + JWT
                                    ▼
                     ┌──────────────────────────────┐
                     │       Vercel (free)          │
                     │  ┌────────────────────────┐  │
                     │  │ Next.js Route Handlers │  │
                     │  └────────┬───────────────┘  │
                     │  ┌────────▼───────────────┐  │
                     │  │  Webhook handler       │  │
                     │  │  /api/webhooks/main    │  │
                     │  └────────┬───────────────┘  │
                     │  ┌────────▼───────────────┐  │
                     │  │  Vercel Cron           │  │
                     │  │  - escalation (15min)  │  │
                     │  │  - auto-close (2 AM)   │  │
                     │  └────────┬───────────────┘  │
                     └───────────┼──────────────────┘
                                 │ SQL (PostgREST / pg client)
                                 ▼
                     ┌──────────────────────────────┐
                     │      Supabase (free)         │
                     │  ┌────────────────────────┐  │
                     │  │  Postgres + RLS        │  │
                     │  │  (source of truth)      │  │
                     │  └────────────────────────┘  │
                     │  ┌────────────────────────┐  │
                     │  │  Supabase Auth (JWT)   │  │
                     │  └────────────────────────┘  │
                     │  ┌────────────────────────┐  │
                     │  │  Storage (reserved,    │  │
                     │  │  unused in MVP)        │  │
                     │  └────────────────────────┘  │
                     └──────────────────────────────┘

  External (contracts):
  ┌────────────────┐  ┌────────────────────┐  ┌────────────────────┐
  │ Identity (OIDC)│  │ Notification Hub   │  │ Maintenance        │
  │ SSO for users  │  │ Receives ticket.*  │  │ POSTs status_changed│
  └────────────────┘  └────────────────────┘  └────────────────────┘
```

### Components

#### Frontend
- **Stack:** Next.js 14+ App Router, React, TypeScript, Tailwind.
- **Screens:** Create Ticket, My Tickets, Ticket Detail, Agent Queue, Admin Counts, Category Manager.
- **Responsibilities:** UI rendering, client-side form validation, JWT bearer attachment on fetch.
- **Does NOT own:** authentication, persistence, authorization.

#### Backend
- **Stack:** Next.js Route Handlers (`app/api/.../route.ts`) on Node runtime.
- **Endpoints:** ~13 endpoints (see §11).
- **Responsibilities:** request validation, orchestration, publishing events, calling out to Notification Hub.
- **Does NOT own:** direct DB writes that should be policy-gated (go via RLS-aware queries).

#### Database
- **Stack:** Supabase Postgres 15 (managed).
- **Schema:** migrations in `supabase/migrations/`. First migration ports permission matrix → RLS policies.
- **Triggers:** state-machine guard (`BEFORE UPDATE` on `tickets.status`), `updated_at` BUMP triggers.
- **Outbox:** `events` table for BR-10 event publishing.
- **Responsibilities:** source of truth; enforces FKs, CHECK, state-machine guard, permission matrix via policies.

#### Authentication
- **Stack:** Supabase Auth configured as OIDC client of campus Identity in prod.
- **In dev:** Supabase Auth standalone (email magic-link / OAuth provider).
- **JWT:** signed by Supabase, short-lived (1 h), contains `role` claim via custom Auth Hook.
- **Session:** httpOnly cookie, never accessible to JS.
- **Role promotion:** via seed script or external Identity group sync.

#### Storage
- **Stack:** Supabase Storage (1 GB free).
- **Status:** Reserved for future use. **Unused in MVP** (no file attachments in scope).

#### External Services
- **Identity** (SSO): source of truth for credentials. OIDC handshake; we issue JWT after callback.
- **Notification Hub** (HTTP): receives our `ticket.*` events. Fan-out to email/LINE/push.
- **Maintenance** (HTTP webhook): sends `maintenance.status_changed`. HMAC-signed.
- **Analytics** (downstream HTTP): consumes `ticket.*` events for trends/dashboards.

---

## 10. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) + TypeScript + Tailwind + React | Most-taught stack for students; AI code-assist support; one-command dev; team familiarity |
| **Backend** | Next.js Route Handlers (Node runtime) | Same project as frontend; no separate service to deploy; matches CON-04 (no microservices) |
| **Database** | Supabase Postgres 15 | Schema fits 1:1 (FK, CHECK, enum, partial unique, joins); RLS enforces permission matrix; free tier fits capacity |
| **Auth** | Supabase Auth (OIDC client) | One-command setup; native JWT issuer; easy to integrate with campus Identity via OIDC; gracefully stubs in dev |
| **AuthZ** | Postgres Row Level Security (RLS) | Same DB; policies map requirement.md §4 1:1; bug in API cannot bypass permissions |
| **Hosting (FE)** | Vercel Hobby (free) | Git-push deploy; preview URLs; 100 GB bandwidth/month |
| **Hosting (DB)** | Supabase Free | 500 MB DB, 2 projects, 50 k MAU — fits capacity |
| **Local dev** | `supabase start` (Docker) + `next dev` | One-command dev (NFR-07); matches Postgres 1:1 with prod |
| **Cron** | Vercel Cron | Free; no separate worker fleet (CON-04); covers BR-09 escalation + auto-close |
| **Webhook (in)** | Next.js Route Handler + HMAC | No extra service; constant-time compare |
| **Event (out)** | `events` outbox table + sync publisher | Avoids lost events on crash; BR-10; documented fallback |
| **Storage** | Supabase Storage | Reserved, unused in MVP |
| **Email/Notifications** | Notification Hub (external) | We don't run SMTP/SMS (CON-05) |
| **Migrations** | `supabase migration new` + SQL files | Versioned, reviewable in PR |
| **Linting** | ESLint + Prettier | Standard Next.js setup |
| **Tests** | Vitest (unit) + Playwright (E2E) + pgTAP (RLS) | Fast unit + real browser + DB-level |
| **CI/CD** | GitHub Actions | Free for public repos; preview env on PR |

> Decision recorded in `ADR-001-stack.md`. Alternatives (Cloudflare + D1, Firebase) explicitly considered and rejected — see ADR for rationale.

---

## 11. API / Interfaces

**Source of truth:** `api_contract.md` (full request/response schemas, error codes, RLS sketch).

### Base URL
- Dev: `http://localhost:3000`
- Prod: `https://helpdesk-mfu.vercel.app`

### Auth
- All endpoints except `/api/auth/*`, `/api/webhooks/*`, `/api/health` require `Authorization: Bearer <jwt>`.

### Endpoint Inventory

| ID | Method | Endpoint | Role | Purpose |
|---|---|---|---|---|
| API-01 | `POST` | `/api/auth/logout` | Any | Clear session |
| API-02 | `GET`  | `/api/auth/me` | Any | Current user + role |
| API-03 | `POST` | `/api/tickets` | Req/Agent/Admin | FR-02 create ticket |
| API-04 | `GET`  | `/api/tickets/me` | Any | FR-04 my tickets |
| API-05 | `GET`  | `/api/tickets` | Agent/Admin | FR-08 agent queue |
| API-06 | `GET`  | `/api/tickets/{id}` | Own/Agent/Admin | FR-05 ticket detail |
| API-07 | `PATCH`| `/api/tickets/{id}` | Own (limited) / Agent/Admin | Edit content / priority / category / assignee / work-order |
| API-08 | `POST` | `/api/tickets/{id}/assign` | Agent/Admin | FR-09 assign |
| API-09 | `POST` | `/api/tickets/{id}/resolve` | Agent/Admin | FR-13 resolve |
| API-10 | `POST` | `/api/tickets/{id}/reopen` | Own / Agent/Admin | BR-05 reopen ≤7d |
| API-11 | `POST` | `/api/tickets/{id}/link-maintenance` | Agent/Admin | FR-12 link work-order |
| API-12 | `POST` | `/api/tickets/{id}/comments` | Own / Agent/Admin | FR-06/11 add comment |
| API-13 | `POST` | `/api/tickets/suggest` | Any | FR-07 rules-engine suggestion |
| API-14 | `GET`  | `/api/admin/counts` | Agent/Admin | FR-17 basic counts |
| API-15 | `GET`  | `/api/categories` | Any | List active categories |
| API-16 | `POST`/`PATCH`/`DELETE` | `/api/categories[/{id}]` | Admin | FR-18 manage categories |
| API-17 | `POST` | `/api/webhooks/maintenance` | External (HMAC) | FR-14 receive status change |
| API-18 | `GET`  | `/api/health` | Open | Liveness check |

### Response Envelope

```json
// success
{ "data": { ... }, "meta": { "request_id": "...", "timestamp": "..." } }

// error
{ "error": { "code": "...", "message": "...", "details": {...}, "request_id": "..." } }
```

### Events (outbound)

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

**Event types:** `ticket.created`, `ticket.assigned`, `ticket.resolved`, `ticket.escalated`, `ticket.status_changed`, `ticket.work_order_linked`.

### Pagination

Cursor-based: `?limit=50&cursor=<opaque>`. Default `limit=50`, max `limit=200`.

### ID Formats

| Resource | Format | Example |
|---|---|---|
| Ticket | `T-` + 6-digit | `T-000123` |
| Comment | `C-` + 6-digit | `C-000456` |
| User | UUID | `a1b2c3d4-...` |
| Category | slug | `it-support`, `facility` |

---

*(continued — Security, Error Handling, Deployment, Constraints, Risks, Acceptance Criteria, Future Improvements)*

---

## 12. Security

### Authentication

- **Identity is the source of truth** for credentials. Helpdesk stores **no passwords, no tokens, no refresh tokens** (NFR-04).
- Users log in via campus Identity (SSO). In dev, Supabase Auth standalone (email magic-link / OAuth).
- **JWT issued by Supabase Auth** at callback. Short-lived (1 h). Contains `role` claim via custom Auth Hook.
- Session stored in **httpOnly cookie** — inaccessible to JS.
- `POST /api/auth/logout` clears session. `GET /api/auth/me` returns current user + role for app boot.

### Authorization

- **Permission matrix (requirement.md §4) enforced at DB via Postgres RLS.** A bug in any API endpoint cannot bypass "Requesters only see own tickets" (BR-02).
- RLS policies keyed off `auth.uid()` and `role` JWT claim.
- Endpoints perform **additional app-level checks** for transitions that RLS can't express in SQL (e.g., BR-03 edit window, BR-05 reopen window).
- Requesters querying a ticket they don't own get `404 NOT_FOUND` — RLS hides existence (don't reveal whether a resource exists).
- `comments.visibility = 'Internal'` filtered by RLS — Requesters never see internal comments (BR-06).

### Data Protection

- **In transit:** HTTPS only (NFR-04). HTTP → HTTPS redirect enforced by Vercel. `Strict-Transport-Security` header.
- **At rest:** Supabase Postgres uses encrypted storage (AES-256 on free tier).
- **In repo:** no secrets (CON-11). `.env.example` has placeholders only. Verified by AC-19 (grep for `API_KEY=*** `SECRET=*** `PASSWORD=*** `TOKEN=*** `sk_`, `pk_live`).
- **Server only:** `SUPABASE_SERVICE_ROLE_KEY` accessed only in Route Handlers; lint rule prevents import in client components.
- **PII handling:** `User.email`, `User.display_name`, `Ticket.description` treated as PII/confidential. Not in API list responses. Not exported to 3rd-party analytics.
- **Privacy:** no tracking pixels, no analytics scripts, no IP address storage, no device fingerprinting (NFR-05).
- **Webhook:** HMAC signature on every inbound webhook (`X-Signature: sha256=<hex>`). Constant-time compare. Replay protection via dedup on `work_order_id + occurred_at` (AC-23).
- **Input handling:** all inputs validated at API boundary (zod schema). SQL injection impossible by design (parameterized queries via Supabase client). Body size limits on webhook endpoint (10 KB) to prevent DoS.

### Threat Model (lightweight)

| Threat | Mitigation |
|---|---|
| Stolen JWT | Short expiry (1 h); refresh via Supabase; `role` claim server-signed |
| Privilege escalation via RLS bug | Code review every `CREATE POLICY`; AC-2 + AC-12 tests |
| Webhook spoofing | HMAC + secret rotation |
| Service-role key leak | Server-only; lint rule; CI grep guard |
| Data exfiltration by ex-Admin | Role demotion triggers JWT refresh on next login |
| DoS via huge payloads | Body size limits; per-IP rate limit (post-MVP) |

---

## 13. Error Handling

### Expected Errors

| HTTP | Code | When | Client action |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Input schema mismatch | Show field-level errors |
| 400 | `INVALID_STATE_TRANSITION` | BR-01 violated | Disable the action button; show reason |
| 400 | `EDIT_WINDOW_EXPIRED` | BR-03 — Agent touched ticket → requester can't edit | Hide edit form; offer comment instead |
| 400 | `REOPEN_WINDOW_EXPIRED` | BR-05 — > 7 days | Disable reopen button |
| 401 | `UNAUTHENTICATED` | No/expired JWT | Redirect to login |
| 403 | `FORBIDDEN` | Role insufficient | Show generic "not allowed" message |
| 404 | `NOT_FOUND` | Resource missing OR RLS hides | "Ticket not found" — don't reveal existence |
| 409 | `VERSION_CONFLICT` | `updated_at` mismatch | Refresh ticket + retry |
| 409 | `DUPLICATE` | Unique constraint | Show "name already exists" |
| 422 | `BUSINESS_RULE_VIOLATED` | Other rule fail | Show specific message |
| 429 | `RATE_LIMITED` | (post-MVP) | Backoff + retry |
| 500 | `INTERNAL_ERROR` | Server bug | Generic "try again later"; log full server-side |
| 503 | `EXTERNAL_DEPENDENCY_DOWN` | Notification Hub / Identity down | Show "notification delayed" but accept the action |

### Failure Scenarios

#### Notification Hub down
- **Symptom:** `POST /notify` returns 5xx or times out.
- **Behavior:** Outbox row stays in `events` table with `published_at = NULL`. Publisher retries on next poll (5 min interval).
- **User impact:** Ticket creation succeeds; requester receives notification late (or not at all within session). Action still returns 201 to user.
- **Runbook:** `SELECT count(*) FROM events WHERE published_at IS NULL` → if > 100 sustained, escalate.

#### Identity service down
- **Symptom:** OIDC handshake fails.
- **Behavior:** Login flow returns 503. Already-logged-in users with valid JWT keep working.
- **User impact:** New users can't log in; existing users unaffected.
- **Runbook:** Switch to Supabase Auth standalone for the demo if campus Identity is offline (documented in `architecture.md` §10).

#### Maintenance webhook signature invalid
- **Symptom:** HMAC mismatch.
- **Behavior:** Return 401. **Do not** log the body (avoid storing secrets in logs).
- **User impact:** Event not processed. Maintenance team retries.
- **Runbook:** Maintenance team rotates `MAINTENANCE_WEBHOOK_SECRET`; both sides update.

#### Database unreachable
- **Symptom:** Postgres connection fails.
- **Behavior:** All endpoints return 503. Health check `/api/health` returns 500.
- **User impact:** Full outage. Vercel routes to a static "service unavailable" page via error boundary.
- **Runbook:** Check Supabase status page; restore from backup if data loss.

#### Cron job fails
- **Symptom:** Vercel Cron returns non-2xx.
- **Behavior:** Vercel auto-retries up to 3 times. Monitor logs.
- **User impact:** Escalation or auto-close delayed by a few minutes. No data loss.
- **Runbook:** Re-run manually via `curl` to cron URL.

#### Optimistic concurrency conflict
- **Symptom:** 409 `VERSION_CONFLICT` returned to one of two concurrent edits.
- **Behavior:** Client refreshes ticket, displays merged result, allows user to retry.
- **User impact:** Zero data loss; one user retries.

---

## 14. Deployment

### Development

**One-command local dev (NFR-07):**

```bash
# one-time
git clone <repo>
cd helpdesk-mfu
npm install
npx supabase init

# every day — 2 terminals
# terminal 1
npx supabase start
# → Postgres + Auth + Studio on Docker

# terminal 2
npm run dev
# → Next.js on localhost:3000
```

**Migration workflow:**

```bash
npx supabase migration new <name>
# write SQL → supabase/migrations/<timestamp>_<name>.sql
npx supabase db push            # apply to local
npx supabase db reset           # reset + migrate + seed
```

**Seed data:** `supabase/seed.sql` ships with 3 demo users (one per role), 5 categories, and 2 sample tickets.

**Day-1 task (R5 in `architecture.md` §13):** port `requirement.md` §4 permission matrix → `CREATE POLICY` in the first migration. **Do not** defer.

### Production

| Step | Where | How |
|---|---|---|
| Push code | GitHub | `git push` |
| Deploy frontend | Vercel | Auto on push to `main`; preview URLs per PR |
| Apply schema | Supabase | `supabase db push --linked` from CI |
| Set env vars | Vercel dashboard | See env list below |
| Configure OIDC | Supabase dashboard | Add campus Identity as external OIDC provider |
| Configure Cron | `vercel.json` | Escalation every 15 min, auto-close daily 02:00 |

**Environment variables (full list):**

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Anon JWT key (safe to expose — RLS protects) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Bypasses RLS for admin ops (migrations, outbox publisher) |
| `MAINTENANCE_WEBHOOK_SECRET` | Server only | HMAC secret for inbound webhooks |
| `NOTIFICATION_HUB_URL` | Server only | Outbound events endpoint |
| `NOTIFICATION_HUB_TOKEN` | Server only | Bearer for outbound auth |

**CI/CD:**
- GitHub Actions runs on every PR: lint, type-check, unit tests, integration tests.
- Migration files applied to preview Supabase project on PR open.
- Merge to `main` triggers Vercel prod deploy + Supabase migration push (manual approval gate).

**Domains:** free `*.vercel.app` for MVP. Custom domain later (still free on Vercel Hobby if owned).

---

## 15. Constraints

- **Budget:** **0 THB/month** sustained (NFR-01, CON-03). Only free-tier services. No paid SaaS during MVP. If upgrade unavoidable, **escalate before paying**.
- **Time:** **One academic semester** (~4 months, CON-02). Hard deadline at semester end.
- **Team:** **3–5 student developers** (CON-01). Must prefer familiar, well-documented stacks. Tutorials and AI code-assist support matter.
- **Free Tier:**
  - Vercel Hobby: 100 GB bandwidth/month, 6 k build minutes/month, 10 s function timeout.
  - Supabase Free: 500 MB DB, 1 GB storage, 2 GB egress, 50 k MAU, 2 projects.
  - Combined capacity fits MVP (200 tickets/day).
- **No enterprise complexity** (CON-04): no microservices, no K8s, no service mesh, no event-bus product, no message broker cluster. Monolith or 2-service split is upper bound.
- **External dependencies are contracts** (CON-05): Identity, Notification Hub, Maintenance assumed to exist. Stubs acceptable for MVP demo.
- **No LLM in request path** (CON-06): rules engine only.
- **English only** (CON-07): no Thai UI in MVP.
- **Web only** (CON-08): no native iOS/Android.
- **Data residency** (CON-09): services accessible from Thailand on free tiers.
- **License** (CON-10): MIT/Apache/BSD only. No GPL/AGPL.
- **Repo hygiene** (CON-11): no secrets, no large binaries, no committed `node_modules`.

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| External Identity not ready by demo | Medium | Use Supabase Auth in dev; document OIDC swap. Demo with stub login. |
| Supabase free-tier policy changes | High | Schema is plain Postgres; Supabase is OSS → self-hostable later. |
| Team new to RLS → policy bug | Medium | Day-1 task: port permission matrix → `CREATE POLICY`. Code review every policy. AC-12 covers all role gates. |
| Notification Hub endpoint changes shape | Medium | Wrap all outbound calls in `lib/notify.ts` with one place to update. Versioned event envelope. |
| Maintenance webhook never delivered in MVP | Low | Build consumer anyway; demo with `curl` script. |
| Outbox publisher not implemented | Medium | MVP fallback: synchronous publish + log on failure (documented). Upgrade later if time permits. |
| Free-tier quotas hit during demo | Medium | Monitor dashboards; have screenshots queued. 500 MB DB ≈ 1 year capacity. |
| Vercel cold start during live demo | Low | Pre-warm `/` 5 min before demo. |
| Two Agents assign same ticket concurrently | Low | Optimistic concurrency on `updated_at` (AC-15). Loser sees friendly conflict message. |
| Schedule slip on backend → demo with mock UI | High | Slice vertically: ship 1 happy-path (create → assign → resolve) by mid-semester, then expand. |

**Full risk register (12 items):** `architecture.md` §13 + `acceptance_criteria.md` §7.

---

## 17. Acceptance Criteria

**Source of truth:** `acceptance_criteria.md` (full Given/When/Then for all 23 ACs).

### MVP is complete when:

- [ ] **AC-1** Create ticket works — returns `T-NNNNNN`, populates `requester_id`, fires `ticket.created` event, RLS-restricted
- [ ] **AC-2** Ownership visibility holds — Requester gets 404 for other people's tickets; Agent sees all
- [ ] **AC-3** Assignment works — toggles status to `Assigned`, fires `ticket.assigned`, rejects assigning to Requester, rejects Closed
- [ ] **AC-4** Add comment works — Public/Internal visibility enforced by RLS, Requester can't post Internal
- [ ] **AC-5** Resolve ticket works — sets `status=Resolved`, `resolved_at`, requires `resolution_note`, fires `ticket.resolved`
- [ ] **AC-6** Maintenance link + status sync works — link stores work-order ID; webhook updates status; bad HMAC rejected; stale events ignored
- [ ] **AC-7** Escalation event works — fires after 1 hour for Urgent + unassigned; idempotent on second cron run; no escalation for High priority

### Additional acceptance criteria (should pass before demo):

- [ ] **AC-8** Edit window — Requester can't edit after Agent touches (BR-03)
- [ ] **AC-9** Reopen within 7 days — works; rejects after 7 days (BR-05)
- [ ] **AC-10** Auto-close after 7 days — cron flips `Resolved` → `Closed` (BR-05)
- [ ] **AC-11** Public vs Internal visibility — Requester sees only Public comments (BR-06)
- [ ] **AC-12** Permission matrix — all 15 capabilities × 3 roles from `requirement.md` §4 enforced
- [ ] **AC-13** Monotonic ticket ID — sequential, no gaps, never reused (BR-12)
- [ ] **AC-14** Every transition emits one event — `ticket.created / assigned / resolved etc.` (BR-10)
- [ ] **AC-15** Optimistic concurrency — concurrent updates → 409 + client refresh
- [ ] **AC-16** Notification Hub integration — outbound events delivered; outbox retries on failure
- [ ] **AC-17** Capacity — p95 < 2 s under 50 concurrent users; 200 tickets/day sustained (NFR-02)
- [ ] **AC-18** Local dev one-command — `supabase start` + `npm run dev` boots in < 60 s (NFR-07)
- [ ] **AC-19** Secrets hygiene — grep for `API_KEY=*** `SECRET=*** `PASSWORD=*** `TOKEN=*** `sk_`, `pk_live` returns 0 matches
- [ ] **AC-20** No secrets in DB schema — `\d users` shows no password/token columns
- [ ] **AC-21** SQL injection — `subject = "'; DROP TABLE tickets; --"` is stored as literal string
- [ ] **AC-22** RLS bypass awareness — service-role key documented as server-only
- [ ] **AC-23** Webhook replay — duplicate POSTs are idempotent

---

## 18. Future Improvements

Deferred from MVP per `requirement.md` §6 and `Problem.md` §8. **Do not implement unless explicitly re-promoted.**

### Intake
- Email-to-ticket parser
- LINE / Messenger / WhatsApp bot
- Phone / voice call logging
- Chatbot intake

### Triage & Automation
- LLM-based category / priority / routing suggestions
- SLA timers with auto-escalation (only Urgent 1-hour in MVP)
- Custom workflows per category
- Round-robin / load-balanced assignment
- Auto-reply templates

### UX
- Native mobile apps (iOS / Android)
- Multi-language UI (Thai support)
- File attachments (even one image)
- Rich-text / Markdown editor
- Real-time chat between requester and agent
- Dark mode

### Reporting & Analytics
- Dashboards with charts
- CSAT / NPS surveys
- Agent performance / leaderboard metrics
- Custom reports

### Permissions & Admin
- Custom RBAC matrix beyond 3 roles
- Bulk operations (bulk assign, bulk close)
- Ticket templates / macros
- Public knowledge base / FAQ
- Self-service user signup

### Quality & Compliance
- Fine-grained audit-log UI
- Configurable data-retention policies
- GDPR / PDPA data-export tooling
- Penetration testing / formal security audit

### Platform
- Multi-tenant separation
- Public REST API for third parties
- Webhooks for arbitrary external subscribers
- Supabase Realtime for live agent queue (checkbox feature)
- AI-assisted routing (deferred to post-MVP per Problem.md §8)

### Re-promotion Process

If a deferred item becomes relevant:
1. Write a 1-page proposal with `Problem` and `Why now?`
2. Update `requirement.md` (bump version)
3. Add to backlog for next iteration
4. Update this PRD and `problem.md` accordingly

---

*End of PRD — v1.0 (Template-aligned). Bump version on any source-doc change.*


