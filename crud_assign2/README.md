# crud_assign2 — Helpdesk Ticket CRUD

Quick reference. **อ่าน tutorial ฉบับเต็มที่ `../crud_assign2.md`**

## Architecture note

- **Identity** อยู่ภายนอก Helpdesk domain (PRD §10.2) → ดู stub ที่ `src/identity.ts`
- **Helpdesk ไม่ own `users` table** — `customer_id` / `assigned_agent_id` เป็น logical ref เท่านั้น
- เปลี่ยน Identity stub เป็นของจริง (JWT/SSO) = แก้ไฟล์เดียว (`src/identity.ts`)

## Files

| File | Purpose |
|---|---|
| `src/index.ts` | Hono app + CRUD routes |
| `src/identity.ts` | **Identity stub (PRD §10.2)** — replace ไฟล์นี้เพื่อต่อ SSO จริง |
| `schema.sql` | D1 schema + categories/tags seed (ไม่มี users table) |
| `wrangler.toml` | Cloudflare config (ต้องแก้ `database_id`) |
| `package.json` | npm scripts |
| `tsconfig.json` | TypeScript config |
| `postman_collection.json` | ใช้ import เข้า Postman |

## Quick start

```bash
npm install
wrangler login
wrangler d1 create helpdesk-db        # เอา database_id ไปใส่ wrangler.toml
npm run db:local                       # สร้าง tables + seed
npm run dev                            # รันที่ http://127.0.0.1:8787
```

## Deploy (OPTIONAL — ไม่อยู่ใน scope ของ assignment นี้)

```bash
npm run db:remote                      # รัน schema บน production
npm run deploy                         # deploy workers
```

## Endpoints

```
GET    /                  health
GET    /categories        categories (Helpdesk-owned)
GET    /users             Identity directory (stub)
GET    /tags              tags
POST   /tickets           create
GET    /tickets           list (?status=&priority=&customer_id=&assigned_agent_id=)
GET    /tickets/:id       read one + Identity enrichment
PATCH  /tickets/:id       partial update
PUT    /tickets/:id       full update
DELETE /tickets/:id       delete (admin/owner only, non-resolved)
POST   /tickets/:id/assign   assign to agent
POST   /tickets/:id/resolve  resolve with optional note
```

## Auth

ทุก `/tickets*` ต้องมี headers:
- `x-user-id: <number>` (ต้องตรงกับ Identity stub)
- `x-user-role: customer | agent | admin` (ต้องตรงกับ Identity claim — server validate)

Middleware ตรวจ 2 อย่าง:
1. User มีอยู่ใน Identity stub
2. Role ที่ส่งมาต้องตรงกับ Identity claim (กัน client spoofing)
