# Requirements — Helpdesk MVP

**Role:** Senior Product Engineer
**Source of truth:** `Problem.md` (Problem + Users + Journey)
**Mode:** MVP — no technology chosen yet.
**Constraints in force:** student project, 1 semester, **0 THB** budget, free-tier only, no enterprise complexity.

---

## 1. Functional Requirements

| ID | Requirement |
|---|---|
| **FR-01** | A user can log in through the campus **Identity service** (SSO). The Helpdesk does not store passwords. |
| **FR-02** | A logged-in user can **create a ticket** with: subject, description, category, urgency. The system returns a unique **Ticket ID**. |
| **FR-03** | When a ticket is created, the system **publishes** a `ticket.created` event containing ticket ID, requester ID, category, priority, and timestamp. |
| **FR-04** | A logged-in user can view a list of **My Tickets** — every ticket they created — with current status, last update, and category. |
| **FR-05** | A logged-in user can open **one of their own tickets** to see full details, status history, and the comment thread. |
| **FR-06** | A logged-in user can **add a comment** to their own ticket. Comments are plain text. |
| **FR-07** | The system suggests a **category** and a **priority** at ticket-creation time using a **rules engine** (keyword + urgency signals). The user may override the suggestion before submitting. |
| **FR-08** | An **Agent** can open the **Agent Queue**: a list of all tickets sortable by priority and age. |
| **FR-09** | An Agent can **assign** a ticket to themselves or to another Agent. |
| **FR-10** | An Agent can change a ticket's **priority** and **category**. |
| **FR-11** | An Agent can add **internal comments** (visible only to Agents and Admins) in addition to public comments. |
| **FR-12** | An Agent can **link** a ticket to an existing **Maintenance work-order ID** by entering that ID. |
| **FR-13** | An Agent can mark a ticket as **Resolved**, with an optional resolution note. The system publishes `ticket.resolved`. |
| **FR-14** | When the system receives a `maintenance.status_changed` event for a linked work-order, it **updates** the corresponding ticket's status and publishes a status-change event. |
| **FR-15** | The system publishes `ticket.escalated` when a ticket's priority = Urgent and it remains unassigned for more than the escalation threshold (see BR-09). |
| **FR-16** | The system notifies the requester via the **Notification Hub** on `ticket.created`, `ticket.assigned`, and `ticket.resolved`. The Helpdesk does not send email/SMS itself. |
| **FR-17** | An **Admin** can view a basic count summary: total tickets, open, resolved today, by category. |
| **FR-18** | An Admin can manage the **list of categories** (add, rename, deactivate). Priorities are a fixed enum. |

---

## 2. Non-Functional Requirements

| ID | Requirement |
|---|---|
| **NFR-01** | **Cost:** total infra cost = **0 THB/month** sustained. Only free-tier services may be used. |
| **NFR-02** | **Capacity:** must handle at least **200 tickets/day** and **50 concurrent active users** at p95 response < 2 s. |
| **NFR-03** | **Availability:** best-effort, documented in README. No 24/7 SLA claim. |
| **NFR-04** | **Security:** all traffic over HTTPS. No passwords stored by Helpdesk (delegated to Identity). No secrets in the repository. |
| **NFR-05** | **Privacy:** only collect data needed for the journey (name, email from Identity + ticket content). No tracking pixels, no third-party analytics in the UI. |
| **NFR-06** | **Observability:** structured application logs include ticket ID, actor ID, action, and timestamp. Logs are greppable. |
| **NFR-07** | **Portability:** the app must run locally with **one command** (`docker compose up` or equivalent) on a developer laptop, no paid accounts required. |
| **NFR-08** | **Browser support:** latest two versions of Chrome, Edge, Firefox, Safari. Responsive layout down to 360 px width. |
| **NFR-09** | **Accessibility:** semantic HTML, keyboard-navigable forms, labels for inputs. WCAG 2.1 AA is **not** a target for MVP but no obvious blockers. |
| **NFR-10** | **Internationalization:** English only for MVP. All UI strings centralized for future translation. |
| **NFR-11** | **Maintainability:** README explains how to run, test, and seed data. Code style enforced by a linter. |
| **NFR-12** | **Data retention:** ticket records and comments retained for at least **one academic year**; older records may be archived or deleted per a documented policy. |
| **NFR-13** | **Testability:** at least **7 automated tests** covering: create, ownership, assignment, comment, resolve, maintenance link, escalation event — per `PRD_Helpdesk.md`. |

---

## 3. Business Rules

| ID | Rule |
|---|---|
| **BR-01** | A ticket has a fixed lifecycle: `Open → Assigned → In Progress → Resolved → Closed`. `Closed` is terminal. |
| **BR-02** | Only the **original requester** (or an Agent/Admin) may view a ticket. Agents/Admins may view any ticket. |
| **BR-03** | A requester may **edit** a ticket's content **only while it is in `Open`** and they have not yet been replaced by an Agent's edit. Once any Agent touches the ticket, the requester can only **comment**. |
| **BR-04** | Only an **Agent or Admin** may change: assignee, priority, category, internal comments, linked work-order, or status (other than auto-Close). |
| **BR-05** | A requester may **reopen** a `Resolved` ticket within **7 days** of resolution. After 7 days the ticket auto-`Closed` and cannot be reopened. |
| **BR-06** | **Public comments** are visible to the requester. **Internal comments** are visible only to Agents and Admins. The requester never sees internal comments. |
| **BR-07** | Category and priority suggestions from the rules engine are **non-binding**; the user (or Agent) always has the final say. |
| **BR-08** | A ticket may be linked to **at most one** Maintenance work-order ID at a time. Replacing the link records the previous ID in the event payload. |
| **BR-09** | **Escalation threshold:** if a ticket has priority `Urgent` and remains `Open` (no Agent assigned) for more than **1 hour**, the system publishes `ticket.escalated`. For other priorities: no auto-escalation in MVP. |
| **BR-10** | Every state transition **publishes exactly one event**. No silent state changes. |
| **BR-11** | A user cannot delete a ticket they created. Only an Admin may hard-delete, and only for records within the retention window and only with a recorded reason. |
| **BR-12** | Ticket IDs are **opaque, monotonically increasing** strings, safe to expose in URLs and notifications. |

---

## 4. Permissions / Roles

Three roles, no custom RBAC matrix (per Problem.md §8).

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

Role assignment is performed **out-of-band** (via the Identity service or seed data); the Helpdesk does not implement user provisioning in MVP.

---

## 5. Constraints

| ID | Constraint |
|---|---|
| **CON-01** | **Team:** small student team (≈ 3–5 members). |
| **CON-02** | **Timeline:** one academic semester (≈ 4 months). |
| **CON-03** | **Budget:** **0 THB**. Only free-tier services (e.g., student credits, free tiers, self-host). No paid SaaS contracts. |
| **CON-04** | **No enterprise complexity:** no microservices, no Kubernetes, no service mesh, no event bus product, no message broker cluster. A monolith or 2-service split is the upper bound. |
| **CON-05** | **External dependencies** are treated as **contracts**, not implementations: Identity, Notification Hub, and `maintenance.status_changed` are assumed to exist. If any of them is not ready, a **mock/stub** is acceptable for MVP demo, documented as such. |
| **CON-06** | **No LLM / AI model** in the request path. The rules engine is a deterministic function of the input text and category. |
| **CON-07** | **English only.** No Thai UI strings in MVP. |
| **CON-08** | **Web only.** No native iOS / Android app. Responsive web is acceptable. |
| **CON-09** | **Data residency:** all data must reside in services available on free tiers accessible from Thailand; no region-locked paid offerings. |
| **CON-10** | **License:** all dependencies must be permissive (MIT / Apache 2.0 / BSD). No GPL / AGPL. |
| **CON-11** | **Repo hygiene:** no secrets in the repository, no large binaries, no node_modules committed. |

---

## 6. Out-of-Scope (MVP)

Anything below is **deferred** unless explicitly re-promoted by a future change to this file.

### Intake
- ❌ Email-to-ticket parser
- ❌ LINE / Messenger / WhatsApp ingestion
- ❌ Phone / voice call logging
- ❌ Chatbot intake

### Triage & automation
- ❌ LLM-based category / priority / routing suggestions
- ❌ SLA timers with auto-escalation (only the Urgent 1-hour rule in BR-09)
- ❌ Custom workflows per category
- ❌ Round-robin or load-balanced assignment
- ❌ Auto-reply templates

### UX
- ❌ Native mobile apps (iOS / Android)
- ❌ Multi-language UI
- ❌ File attachments (even one image)
- ❌ Rich-text / Markdown editor (plain text + newlines only)
- ❌ Real-time chat between requester and agent (async comments only)
- ❌ Dark mode (nice-to-have, not MVP)

### Reporting & analytics
- ❌ Dashboards with charts (only the basic counts in FR-17)
- ❌ CSAT / NPS surveys
- ❌ Agent performance / leaderboard metrics
- ❌ Custom reports

### Permissions & admin
- ❌ Custom RBAC matrix beyond the three roles
- ❌ Bulk operations (bulk assign, bulk close)
- ❌ Ticket templates / macros
- ❌ Public knowledge base / FAQ
- ❌ Self-service user signup

### Quality & compliance
- ❌ Fine-grained audit-log UI (raw log retention is enough)
- ❌ Configurable data-retention policies
- ❌ GDPR / PDPA data-export tooling for end users
- ❌ Penetration testing / formal security audit

### Platform
- ❌ Multi-tenant separation
- ❌ Public REST API for third parties (only the documented integration endpoints are exposed)
- ❌ Webhooks for arbitrary external subscribers (only the documented teams)

---

## 7. Traceability (Problem ↔ Requirements)

Selected cross-references so reviewers can trace "why":

| Problem reference | Covered by |
|---|---|
| Pain P1 — Lost requests | FR-02, BR-12 (Ticket ID) |
| Pain P2 — No visibility | FR-04, FR-05, FR-16 |
| Pain P3 — No prioritization | FR-07, FR-10, FR-08 |
| Pain P4 — Manual cross-team handoff | FR-12, FR-14, BR-08 |
| Pain P5 — No historical data | NFR-12, FR-17 |
| Pain P6 — No audit trail | BR-10, NFR-06 |
| Pain P7 — Duplicate reports | FR-02 + Agent triage (FR-08) |
| Pain P8 — Channel fragmentation | FR-01, FR-02, FR-16 |
| Assumption A2 — Rules only | FR-07, CON-06 |
| Assumption A3 — Identity exists | FR-01, CON-05 |
| Assumption A4 — Maintenance webhook | FR-14, CON-05 |
| Assumption A6 — Low volume | NFR-02 |
| Assumption A7 — English only | NFR-10, CON-07 |
| Assumption A8 — Notification Hub | FR-16, CON-05 |
