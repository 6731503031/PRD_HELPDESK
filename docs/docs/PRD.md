# Product Requirements Document (PRD)
# Helpdesk Platform — Team 14

**Version:** 1.1 Final  
**Status:** Final / Submission Candidate  
**Changes from 1.0:** two roles only (Requester, Admin); no Agent role and no ticket assignment; technology direction updated to the stack actually built (§17); a ticket has one chat between the Requester and the Admin, and **internal notes were cut**; sign-in uses a documented Identity stub with a self-declared display name (§20.1).  
**Product:** Helpdesk Platform  
**Team:** Team 14

## 1. Product Overview

### 1.1 Purpose
The Helpdesk Platform provides a structured way for students and staff to create, route, track, communicate about, and resolve support requests.

The platform gives every support request a clear Ticket identity, owner, status, history, and integration path with other university platforms.

### 1.2 Problem Statement
Student and staff support requests can be difficult to track when they are handled through separate channels such as email, chat, in-person requests, or informal messages.

The Helpdesk Platform addresses this by providing:
- One structured place to create support tickets.
- A clear ticket status and ownership model.
- An admin dashboard for support operations.
- Chat on each ticket between the requester and the Admin.
- Integration with the Maintenance platform without duplicating Maintenance data.
- Events that other university platforms can consume.
- AI-assisted triage with a deterministic fallback.

### 1.3 Product Goal
Create a reliable Helpdesk domain that allows a requester to submit a support request, allows a Helpdesk admin to triage and resolve it, and allows other university platforms to integrate through stable APIs and events.

### 1.4 Core Product Principle
> **Helpdesk owns the Ticket domain. Other university platforms own their own domains.**

Helpdesk should reference external domain data rather than duplicating it.

## 2. Users and Roles

### Requester
Students, faculty, and staff who need support.

Capabilities:
- Sign in through Identity.
- Create a ticket.
- View their own tickets.
- View ticket status and history.
- Chat with the Admin on their own tickets.
- Track resolution.

### Admin
The Helpdesk administrator. The platform has two roles only (Requester and Admin); there is no separate Agent role, so tickets are not assigned to individual staff.

Capabilities:
- Manage categories (add, deactivate).
- View the Admin Dashboard of all tickets and basic ticket counts.
- Triage tickets: change category, priority, and status.
- Chat with the requester on a ticket.
- Send a repair to Maintenance (Team 10) from the ticket page; the returned work-order ID is linked automatically (backup: link an ID by hand).
- Resolve tickets.

Physical repair work is done by the Maintenance platform (Team 10) through its own work orders; the Admin links the ticket and confirms the result.

### External Platform Stakeholders
- Identity
- Maintenance
- Notification Hub
- Security & Compliance
- Analytics

## 3. Scope

### In Scope
- Create Ticket
- My Tickets
- Ticket Detail / Status
- Admin Dashboard
- Ticket chat (requester and Admin)
- Ticket resolution
- Maintenance work-order linking
- Basic Admin category management
- Basic Admin ticket counts
- Identity integration
- REST API
- AI-assisted category, priority, and route suggestion
- Deterministic fallback rules
- Maintenance status-change integration
- Outbound domain events
- Notification integration
- Security and authorization
- Automated testing

### Out of Scope for MVP
- Native iOS/Android applications
- Real-time chat
- Email-to-ticket ingestion
- LINE/Messenger/WhatsApp ticket ingestion
- Full enterprise workflow engine
- Microservices/Kubernetes deployment
- Full analytics dashboard implementation inside Helpdesk
- Helpdesk-owned Maintenance work-order records
- Helpdesk-owned authentication credentials
- Autonomous AI decisions without human control

## 4. Core User Journey

```text
Requester
   |
   v
Sign in through Identity
   |
   v
Create Ticket
   |
   v
AI suggests Category + Priority + Route
   |
   +---- AI unavailable? ----> Fallback Rules
   |
   v
Ticket Created
   |
   v
Admin Dashboard
   |
   v
Triage (category, priority, status)
   |
   v
Work / Chat with requester
   |
   +---- Optional ----> Link Maintenance Work Order
   |
   v
Resolve
   |
   v
Requester sees updated status
```

## 5. Functional Requirements

### FR-01 — Identity Login
Users shall authenticate through the university Identity platform. Helpdesk shall not own or store user passwords.

### FR-02 — User Context
Helpdesk shall receive enough identity context to determine user identity, role, and permissions.

### FR-03 — Create Ticket
A logged-in requester shall be able to create a ticket with at least subject, description, category, and urgency. The system shall generate a unique Ticket ID.

### FR-04 — Ticket Created Event
After successful ticket creation, Helpdesk shall publish `ticket.created`.

### FR-05 — My Tickets
A requester shall be able to view tickets they created, including Ticket ID, subject, category, priority, status, and last update.

### FR-06 — Ticket Detail
A requester shall be able to open their own ticket and view ticket details, current status, status history, chat messages, and resolution information when available.

### FR-07 — Ownership
A requester shall not be able to view another requester's private ticket. The Admin may access all tickets.

### FR-08 — Admin Dashboard
The Admin shall be able to view tickets requiring support handling, with counts by status. The list should support sorting by priority and age/creation time.

### FR-09 — Assignment (removed in 1.1)
Not required. With a single staff role there is nobody to assign to; the Admin handles every ticket.

### FR-10 — Triage
The Admin shall be able to review and change category, priority, and status. The Admin's final decision overrides AI suggestions.

### FR-11 — Ticket Chat
Requesters and the Admin shall be able to exchange messages on a ticket: one conversation per ticket, shown as a chat. A requester can read and write only in the chat of their own tickets; the Admin can do so on every ticket. Real-time push is out of scope (§2): new messages appear by periodic refresh. The chat is between the Requester and the Admin only; the Maintenance team (Team 10) is never part of it.

### FR-12 — Internal Comments (removed in 1.1)
Not required. Every message on a ticket is visible to both the Requester and the Admin.

### FR-13 — Resolve Ticket
The Admin shall be able to resolve a ticket with an optional resolution note. The system shall publish `ticket.resolved`.

## 6. Maintenance Integration

### 6.1 Ownership Boundary
Maintenance owns Maintenance Work Orders. Helpdesk does not copy the Maintenance work-order record into the Helpdesk domain.

Helpdesk stores only:

`maintenance_work_order_id`

### 6.2 Send or Link Work Order
**Main way (send).** From the ticket page the Admin checks the repair text (title and description, pre-filled from the ticket and editable so personal details can be removed) and sends it. Helpdesk calls Maintenance `POST /api/v1/work-orders` with `ticketRef`, `title`, `description`, `location` (typed by the Admin, since Helpdesk tickets have no location field) and `category` (one of Maintenance's five: `Plumbing`, `Electrical`, `HVAC`, `Safety`, `Not sure`), then links the returned work-order ID to the ticket. Only Facility tickets can be sent. The Admin never has to open the Maintenance system.

**Backup way (link).** If the Admin already has a work-order ID from Maintenance, they can link it by hand. Helpdesk checks it with `GET /api/v1/work-orders/{id}` first.

Either way, the Admin first triages the ticket and starts the work (status In progress); an Open ticket cannot be sent or linked. A ticket may reference at most one active Maintenance work-order ID, a work-order ID belongs to one ticket only, and no personal data (names, emails, phone numbers) is sent.

### 6.3 Incoming Maintenance Event
Helpdesk shall consume `maintenance.status_changed`.

```text
Maintenance
    |
    | maintenance.status_changed
    v
Helpdesk Webhook
    |
    v
Verify event
    |
    v
Find Ticket by linked Work Order ID
    |
    v
Update Ticket status
    |
    v
Publish relevant Helpdesk event
```

## 7. Event-Driven Integration

### 7.1 Required Outbound Events
- `ticket.created`
- `ticket.escalated`
- `ticket.resolved`

These events are intended for downstream platform consumers including Notification Hub, Security & Compliance, and Analytics.

### 7.2 Additional Domain Events
The implementation may publish supporting lifecycle events such as:
- `ticket.status_changed`
- `ticket.work_order_linked`

These are supporting events and are not presented as the three core events explicitly required by the original Helpdesk brief.

### 7.3 Event Principle
REST API answers: **"Do this."**  
Events communicate: **"This happened."**

## 8. AI-Assisted Triage

### 8.1 Purpose
AI is used to assist the first stage of ticket triage. The AI provides recommendations that the requester or Admin can review and override.

### 8.2 AI Inputs
The AI may use:
- Subject
- Description
- Urgency
- Available Helpdesk categories
- Available routing options

### 8.3 AI Outputs
The AI shall propose:
1. Category
2. Priority
3. Route

Example:

```text
Ticket:
"Air conditioner in classroom B-204 is not working."

AI suggestion:
Category: Facility
Priority: High
Route: Maintenance
```

These are suggestions, not final decisions.

### 8.4 Human-in-the-Loop
The system must allow the requester/Admin to override AI suggestions. The Admin's final choice becomes the authoritative ticket data.

### 8.5 Fallback
If the AI service is unavailable, times out, returns invalid output, or cannot provide a useful suggestion, the system shall fall back to deterministic rules based on category matching, urgency, and defined keyword/routing rules.

```text
AI unavailable
      |
      v
Keyword + urgency rules
      |
      +--> Category
      +--> Priority
      +--> Route
```

### 8.6 AI Safety and Reliability
- AI suggestions are non-binding.
- Validate AI output against allowed categories, priorities, and routes.
- AI cannot bypass authorization.
- AI does not own ticket state.
- Human users remain responsible for final triage decisions.
- The fallback remains usable when AI is unavailable.

## 9. API Contract

### 9.1 Required Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/tickets` | Create a ticket |
| GET | `/tickets/me` | List requester's tickets |
| GET | `/tickets/{id}` | Get ticket details |
| PATCH | `/tickets/{id}` | Update allowed ticket fields |
| GET / POST | `/tickets/{id}/comments` | Read / send messages in the ticket chat |
| POST | `/tickets/{id}/resolve` | Resolve a ticket |

### 9.2 Supporting Integration Endpoints
Implementation may expose:
- `POST /tickets/{id}/send-maintenance`
- `POST /tickets/{id}/link-maintenance`
- `POST /webhooks/maintenance`

### 9.3 AI Assistance Endpoint
Implementation may expose:

`POST /tickets/suggest`

It accepts ticket intake information and returns validated suggestions for category, priority, and route. It must not directly bypass authorization or finalize sensitive state.

## 10. Data Model

### 10.1 Helpdesk-Owned Entities

**Ticket** — id, requester_id, category_id, subject, description, priority, status, maintenance_work_order_id, resolution_note, timestamps.

**Category** — id, name, active/deactivated state.

**Comment** (chat message) — id, ticket_id, author_id, content, timestamp.

### 10.2 User Reference
Helpdesk may maintain a local identity representation/reference for requester and comment author. Authentication credentials remain owned by Identity.

### 10.3 External Maintenance Reference
Helpdesk stores `maintenance_work_order_id` and does not duplicate Maintenance's work-order fields.

## 11. Data Ownership

| Domain | Owner | Helpdesk Relationship |
|---|---|---|
| Authentication credentials | Identity | External identity source |
| Ticket | Helpdesk | Owned |
| Category | Helpdesk | Owned |
| Comment | Helpdesk | Owned |
| Maintenance Work Order | Maintenance | External reference only |
| Notification delivery | Notification Hub | External consumer/service |
| Analytics records | Analytics | Downstream consumer |

> **Each platform domain owns its own data. Helpdesk integrates through contracts and references rather than duplicating another platform's records.**

## 12. Architecture

```text
                         University Platform
                                |
        +-----------------------+-----------------------+
        |                       |                       |
    Identity                 Maintenance          Notification Hub
        |                       |                       |
        | SSO                   | status event        | events
        v                       v                       ^
+-------------------------------------------------------------+
|                    Helpdesk Platform                         |
|                                                             |
|  Web UI                                                     |
|     |                                                       |
|     v                                                       |
|  API / Application Logic                                    |
|     |                                                       |
|     +---- AI Triage                                         |
|     |                                                       |
|     +---- Fallback Rules                                    |
|     |                                                       |
|     v                                                       |
|  Helpdesk Data Store                                        |
|                                                             |
|  Ticket / Category / Comment                                |
+-------------------------------------------------------------+
        |
        +---------------------> Analytics
        |
        +---------------------> Security & Compliance
```

The architecture demonstrates domain ownership, contract-first APIs, authentication delegation, event-driven integration, external webhooks, AI-assisted capability, and security boundaries without unnecessary microservices.

## 13. Security and Trust Boundaries

### Authentication
Identity owns authentication credentials. Helpdesk shall not store passwords or Identity-owned authentication secrets.

### Authorization
- Requester → own tickets
- Admin → all tickets, triage, chat, Maintenance link, resolve, categories

### Maintenance Webhook Security
Incoming Maintenance events must be authenticated/verified before they are trusted. HMAC or an equivalent agreed mechanism may be used.

### Data Protection
Sensitive user/ticket information shall be access-controlled. The platform should collect only information necessary for the support journey.

### Secrets
Secrets must be stored in environment/configuration management and never committed to source control.

## 14. Ticket Lifecycle

```text
Open
  |
  v
InProgress
  |
  v
Resolved
  |
  v
Closed
```

**As built (1.1):** people see three steps: Open, In progress, Resolved. The Admin's "resolve" action (FR-13) moves a ticket to Resolved and the progress line then shows every step as finished. `Closed` stays in the data model as an internal end state (for later archiving): no screen or action moves a ticket to it in 1.1, and a Closed ticket is displayed as Resolved. A Resolved ticket can be re-opened to In progress by the Admin.

### Escalation
A ticket becomes eligible for escalation when:

```text
Priority = Urgent
AND Status = Open (Admin has not started it)
AND Waiting > 1 hour
```

Then `ticket.escalated` is published.

## 15. Business Rules

- **BR-01:** A requester can access their own tickets; the Admin can access all tickets.
- **BR-02:** Only the Admin can change category, priority, status, and the Maintenance link. A requester may fix the title and description of their own ticket while it is still Open.
- **BR-03:** (removed in 1.1) There are no internal notes; the chat of a ticket is visible to both sides.
- **BR-04:** Helpdesk stores only the Maintenance Work Order ID and does not duplicate the Maintenance record.
- **BR-05:** AI suggestions are advisory; the requester/Admin makes the final decision.
- **BR-06:** If AI cannot provide a valid recommendation, deterministic category/urgency rules are used.
- **BR-07:** Urgent tickets still Open (not started) and waiting more than one hour trigger `ticket.escalated`.
- **BR-08:** Important state changes must produce the agreed platform events.

## 16. Non-Functional Requirements

### Performance
- Target p95 API response time under 2 seconds under expected MVP load.
- Support the expected university-scale MVP workload.
- Keep Admin Dashboard queries responsive.

### Accessibility
- Semantic HTML
- Keyboard-accessible controls
- Labeled inputs
- Responsive web interface

### Availability
The MVP is best-effort and does not claim a 24/7 enterprise SLA.

### Maintainability
- Clear project structure
- Centralized UI strings
- Documented setup
- Versioned API/data contracts
- Automated tests

### Cost
Prefer the team's agreed free-tier infrastructure for the MVP where practical.

## 17. Technology Direction

Implementation as built (1.1):
- Frontend: React + TypeScript + Vite, served as static assets by the same Worker
- Backend/API: Cloudflare Workers + Hono (REST under `/api/v1`)
- Database: Cloudflare D1 (SQLite)
- AI: Workers AI binding, with deterministic fallback rules
- Scheduled jobs: Cron Trigger every 15 minutes (escalation)
- Authentication: documented Identity stub (§20) until the university Identity is available
- Hosting: Cloudflare free tier (one deployment for UI + API + DB + AI + cron)
- Testing: Vitest unit tests + an end-to-end smoke script, run in GitHub Actions CI

Why not Next.js + PostgreSQL (the 1.0 direction): one Cloudflare deployment already covers hosting, database, AI, and scheduled escalation on the free tier, so the team does not have to run and connect separate services.

Technology choices are implementation decisions and must not change the domain ownership or platform contracts defined in this PRD.

## 18. Testing and Quality

At least seven automated tests are required:
1. Create ticket
2. Ticket ownership/access control
3. Admin-only triage (requesters cannot change status/priority)
4. Comment (ticket chat between requester and Admin)
5. Resolve
6. Maintenance link
7. Escalation event

Additional recommended tests:
- AI suggestion validation
- AI fallback behavior
- Chat access: another requester cannot read a ticket's chat
- Maintenance webhook verification
- Duplicate event handling
- Unauthorized ticket access
- Invalid AI output
- Event publishing failure behavior

## 19. Acceptance Criteria

The MVP is functionally complete when:
- A requester can authenticate.
- A requester can create a ticket.
- A unique Ticket ID is generated.
- AI can provide category, priority, and route suggestions.
- Fallback rules work when AI is unavailable.
- A requester can view their own tickets.
- The Admin can access the dashboard of all tickets.
- The Admin can change category/priority/status.
- The Admin can manage categories.
- A requester and the Admin can chat on a ticket; another requester cannot read it.
- A Maintenance Work Order can be linked by ID.
- `maintenance.status_changed` can update the linked ticket.
- `ticket.created` is published.
- `ticket.escalated` is published when the escalation rule is met.
- `ticket.resolved` is published when a ticket is resolved.
- Required downstream consumers can receive the required events.
- Unauthorized users cannot access another requester's ticket.
- At least seven required automated tests pass.

## 20. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Identity integration unavailable | Use a documented development stub while preserving the Identity contract (§20.1) |
| AI unavailable | Deterministic fallback rules |
| AI produces invalid values | Validate against allowed categories/priorities/routes |
| Maintenance integration changes | Keep integration behind a stable webhook/API contract |
| Unauthorized ticket access | Enforce authorization at application and data layers |
| Event delivery failure | Use a reliable event publishing strategy and observable failures |
| Scope becomes too large | Keep MVP focused on Ticket-domain ownership and required integrations |

### 20.1 Identity stub as built (1.1)

Until the university Identity is available, sign-in is a stub that verifies nothing:

- **Requester:** clicks "เข้าสู่ระบบ" and, the first time only, gives a display name (and an optional contact email). The server issues a guest id (1000 and up) with the role `customer` only; the browser remembers it, so the next click goes straight in. The Admin role can never be created this way.
- **Admin:** opens a separate link (`/#/staff`) and clicks once. The link is not shown on the requester page.
- Helpdesk stores no password. The display name and contact email are self-declared and never verified.

Known limitations (to be stated when presenting): anyone with the Admin link can sign in as Admin; a requester who clears the browser data or changes device becomes a new guest and cannot reach earlier tickets; request headers can be forged. Real sign-in replaces only `identity.ts` and `auth.ts` on the server and the sign-in screen; the rest of the system keeps using the same user id and role.

## 21. Future Improvements

Potential post-MVP improvements include:
- More advanced LLM/RAG-based triage
- SLA automation
- Additional intake channels
- Mobile applications
- Rich attachments
- Additional staff roles and ticket assignment, if the Helpdesk grows
- Real sign-in through the university Identity / SSO (replaces the §20.1 stub)
- A dedicated Messages inbox with last-message preview and unread counts
- Internal notes for the Admin, if the team needs them
- Advanced analytics dashboards
- More configurable workflows
- More sophisticated AI routing
- Knowledge-base/self-service support

These improvements should not weaken the core principle of human oversight and domain ownership.

## 22. Final Product Definition

The Helpdesk Platform is a **Ticket-domain platform**, not a replacement for every university service.

Its responsibility is to:
1. Receive support requests.
2. Create and manage Tickets.
3. Assist triage using AI.
4. Provide a deterministic fallback.
5. Track status and ownership by requester.
6. Support communication through the ticket chat.
7. Link to external Maintenance work orders.
8. Resolve tickets.
9. Publish platform events.
10. Provide stable contracts for other university platforms.

The platform deliberately avoids owning Identity credentials, Maintenance work-order records, Notification delivery infrastructure, and Analytics records.

> **Helpdesk owns the Ticket domain. AI assists triage, humans remain in control, and other university platforms communicate through stable contracts and events.**
