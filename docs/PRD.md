# Product Requirements Document (PRD)
# Helpdesk Platform — Team 14

**Version:** 1.0 Final  
**Status:** Final / Submission Candidate  
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
- An agent queue for support operations.
- Public and internal comments.
- Integration with the Maintenance platform without duplicating Maintenance data.
- Events that other university platforms can consume.
- AI-assisted triage with a deterministic fallback.

### 1.3 Product Goal
Create a reliable Helpdesk domain that allows a requester to submit a support request, allows agents to triage and resolve it, and allows other university platforms to integrate through stable APIs and events.

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
- Add public comments.
- Track resolution.

### Agent
Helpdesk/support staff who handle tickets.

Capabilities:
- View the Agent Queue.
- Triage tickets.
- Assign tickets.
- Change category and priority.
- Add public or internal comments.
- Link a ticket to a Maintenance work-order ID.
- Resolve tickets.

### Admin
Helpdesk administrators.

Capabilities:
- All Agent capabilities.
- Manage categories.
- View basic ticket counts.
- Perform restricted administrative operations.

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
- Agent Queue
- Ticket assignment
- Public comments
- Internal comments
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
Agent Queue
   |
   v
Triage
   |
   v
Assign
   |
   v
Work / Comments
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
A requester shall be able to open their own ticket and view ticket details, current status, status history, comments, and resolution information when available.

### FR-07 — Ownership
A requester shall not be able to view another requester's private ticket. Agents and Admins may access tickets according to their authorized role.

### FR-08 — Agent Queue
An Agent shall be able to view tickets requiring support handling. The queue should support sorting by priority and age/creation time.

### FR-09 — Assignment
An Agent shall be able to assign a ticket to themselves or another authorized Agent.

### FR-10 — Triage
An Agent shall be able to review and change category, priority, and assignee. The Agent's final decision overrides AI suggestions.

### FR-11 — Public Comments
Requesters and authorized Agents shall be able to add public comments to a ticket.

### FR-12 — Internal Comments
Agents/Admins shall be able to add internal comments. Internal comments shall not be visible to Requesters.

### FR-13 — Resolve Ticket
An authorized Agent/Admin shall be able to resolve a ticket with an optional resolution note. The system shall publish `ticket.resolved`.

## 6. Maintenance Integration

### 6.1 Ownership Boundary
Maintenance owns Maintenance Work Orders. Helpdesk does not copy the Maintenance work-order record into the Helpdesk domain.

Helpdesk stores only:

`maintenance_work_order_id`

### 6.2 Link Work Order
An authorized Agent shall be able to link a Helpdesk Ticket to an existing Maintenance Work Order ID. A ticket may reference at most one active Maintenance work-order ID.

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
- `ticket.assigned`
- `ticket.status_changed`
- `ticket.work_order_linked`

These are supporting events and are not presented as the three core events explicitly required by the original Helpdesk brief.

### 7.3 Event Principle
REST API answers: **"Do this."**  
Events communicate: **"This happened."**

## 8. AI-Assisted Triage

### 8.1 Purpose
AI is used to assist the first stage of ticket triage. The AI provides recommendations that a user or Agent can review and override.

### 8.2 AI Inputs
The AI may use:
- Subject
- Description
- Urgency
- Available Helpdesk categories
- Available routing/assignment options

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
The system must allow the requester/Agent to override AI suggestions. The Agent's final choice becomes the authoritative ticket data.

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
| POST | `/tickets/{id}/assign` | Assign a ticket |
| POST | `/tickets/{id}/comments` | Add a comment |
| POST | `/tickets/{id}/resolve` | Resolve a ticket |

### 9.2 Supporting Integration Endpoints
Implementation may expose:
- `POST /tickets/{id}/link-maintenance`
- `POST /webhooks/maintenance`

### 9.3 AI Assistance Endpoint
Implementation may expose:

`POST /tickets/suggest`

It accepts ticket intake information and returns validated suggestions for category, priority, and route. It must not directly bypass authorization or finalize sensitive state.

## 10. Data Model

### 10.1 Helpdesk-Owned Entities

**Ticket** — id, requester_id, assignee_id, category_id, subject, description, priority, status, maintenance_work_order_id, resolution_note, timestamps.

**Category** — id, name, active/deactivated state.

**Comment** — id, ticket_id, author_id, content, visibility, timestamp.

### 10.2 User Reference
Helpdesk may maintain a local identity representation/reference for requester, assignee, and comment author. Authentication credentials remain owned by Identity.

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
- Agent → authorized ticket management
- Admin → administrative operations

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
Assigned
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

### Escalation
A ticket becomes eligible for escalation when:

```text
Priority = Urgent
AND Status = Open
AND No Assignee
AND Waiting > 1 hour
```

Then `ticket.escalated` is published.

## 15. Business Rules

- **BR-01:** A requester can access their own tickets; Agents/Admins can access according to role.
- **BR-02:** Only authorized Agents/Admins can change assignee, category, priority, status, Maintenance link, and internal comments.
- **BR-03:** Internal comments are not visible to Requesters.
- **BR-04:** Helpdesk stores only the Maintenance Work Order ID and does not duplicate the Maintenance record.
- **BR-05:** AI suggestions are advisory; the authorized user/Agent makes the final decision.
- **BR-06:** If AI cannot provide a valid recommendation, deterministic category/urgency rules are used.
- **BR-07:** Urgent, Open, unassigned tickets waiting more than one hour trigger `ticket.escalated`.
- **BR-08:** Important state changes must produce the agreed platform events.

## 16. Non-Functional Requirements

### Performance
- Target p95 API response time under 2 seconds under expected MVP load.
- Support the expected university-scale MVP workload.
- Keep Agent Queue queries responsive.

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

Current implementation direction:
- Frontend: Next.js + TypeScript + Tailwind
- Backend/API: Next.js Route Handlers
- Database: PostgreSQL through the team's selected managed platform
- Authentication: university Identity integration
- Hosting: team's agreed deployment platform
- Testing: unit/integration/E2E tests as appropriate

Technology choices are implementation decisions and must not change the domain ownership or platform contracts defined in this PRD.

## 18. Testing and Quality

At least seven automated tests are required:
1. Create ticket
2. Ticket ownership/access control
3. Assignment
4. Comment
5. Resolve
6. Maintenance link
7. Escalation event

Additional recommended tests:
- AI suggestion validation
- AI fallback behavior
- Internal comment visibility
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
- An Agent can access the queue.
- An Agent can assign a ticket.
- An Agent can change category/priority.
- Public and internal comments work with correct visibility.
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
| Identity integration unavailable | Use a documented development stub while preserving the Identity contract |
| AI unavailable | Deterministic fallback rules |
| AI produces invalid values | Validate against allowed categories/priorities/routes |
| Maintenance integration changes | Keep integration behind a stable webhook/API contract |
| Unauthorized ticket access | Enforce authorization at application and data layers |
| Event delivery failure | Use a reliable event publishing strategy and observable failures |
| Scope becomes too large | Keep MVP focused on Ticket-domain ownership and required integrations |

## 21. Future Improvements

Potential post-MVP improvements include:
- More advanced LLM/RAG-based triage
- SLA automation
- Additional intake channels
- Mobile applications
- Rich attachments
- Real-time agent collaboration
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
5. Assign and track ownership.
6. Support communication through comments.
7. Link to external Maintenance work orders.
8. Resolve tickets.
9. Publish platform events.
10. Provide stable contracts for other university platforms.

The platform deliberately avoids owning Identity credentials, Maintenance work-order records, Notification delivery infrastructure, and Analytics records.

> **Helpdesk owns the Ticket domain. AI assists triage, humans remain in control, and other university platforms communicate through stable contracts and events.**
