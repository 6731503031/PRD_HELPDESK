# PRD — Helpdesk (Team 14)

## Purpose
Create, route, track, and resolve support tickets for student and staff requests.

## Scope
Screens: create ticket, my ticket status, agent queue. Entities: Ticket, Category, Priority, Assignee, Comment. REST: `POST /tickets`, `GET /tickets/me`, `GET /tickets/{id}`, `PATCH /tickets/{id}`, `POST /tickets/{id}/assign`, `POST /tickets/{id}/comments`, `POST /tickets/{id}/resolve`.

## Integrations
Consume Identity and `maintenance.status_changed`; accept a linked work-order ID instead of copying repair records. Publish `ticket.created`, `ticket.escalated`, and `ticket.resolved` to Notification Hub, Security & Compliance, and Analytics.

## AI and quality
AI proposes category, priority, and route; fallback uses category/urgency rules. Tests (minimum 7): create, ownership, assignment, comment, resolve, maintenance link, escalation event.
