# CRUD Assignment 2 — Helpdesk Ticket API

> Cloudflare Workers + Hono + D1 (SQLite)
> เอกสารนี้รวบ **ทุกขั้นตอน** ตั้งแต่สมัคร Cloudflare จนถึงทดสอบ CRUD ด้วย Postman
> อ้างอิง PRD: `PRD/PRD.final(1).md` v1.0

---

## 0. Overview

> **Note (2026-08-22): Assignment นี้เน้น *implement + test ในเครื่อง* ไม่ deploy production**
> ทุกอย่างใช้ `wrangler dev` + D1 local ผ่าน Postman บน `http://127.0.0.1:8787`
> Section 8 (Deploy) เก็บไว้เป็น OPTIONAL สำหรับวันหลัง — ข้ามได้เลย

### 0.1 Scope ของ assignment
- **Implement CRUD ของ Ticket** (Create / Read / Read One / Update / Delete)
- **Test ด้วย Postman** บน local dev server
- รันบน **Cloudflare Workers** ผ่าน **Hono** framework
- เก็บข้อมูลใน **D1 local** (Cloudflare serverless SQLite ที่รันใน Miniflare)

### 0.2 ทำไมเลือก stack นี้
| Choice | เหตุผล |
|---|---|
| Cloudflare Workers | Free tier 100k req/day, deploy ง่าย, ใกล้ user (edge) |
| Hono | Web framework ที่ออกแบบมาให้ทำงานบน Workers โดยเฉพาะ, bundle เล็กกว่า Express 10–20× |
| D1 (SQLite) | Schema เราเป็น relational (มี FK, JOIN) → SQL เหมาะกว่า NoSQL |
| Postman | Standard สำหรับ API testing, share collection เป็นไฟล์ได้ |

### 0.3 ไฟล์ทั้งหมดใน assignment นี้
```
crud_assign2/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── schema.sql
├── postman_collection.json
└── src/
    └── index.ts
crud_assign2.md           ← ไฟล์นี้ (tutorial)
```

---

## 1. สมัคร Cloudflare (ถ้ายังไม่มี)

> ถ้ามี account แล้วข้ามไปข้อ 2 ได้เลย

1. ไปที่ **https://dash.cloudflare.com/sign-up**
2. กรอก email + password → ยืนยัน email
3. Cloudflare จะถามว่าจะ add site หรือไม่ → กด **"Skip"** หรือกด X ออก (เราไม่ใช้ site สำหรับ Workers)
4. เข้าหน้า Dashboard ได้ → **Account ID** อยู่มุมขวาล่างของ Workers & Pages
5. Workers free tier ให้:
   - 100,000 requests / day
   - 10ms CPU time / request
   - D1: 5GB storage, 5M reads/day, 100K writes/day
   - พอเหลือเฟือสำหรับ assignment

**ไม่ต้องใส่บัตรเครดิต** ในการใช้ free tier

---

## 2. ติดตั้งเครื่องมือ

### 2.1 Node.js (ต้อง ≥ 18)
ตรวจสอบ:
```bash
node --version
```
ถ้ายังไม่มี → ดาวน์โหลดจาก https://nodejs.org/ (เลือก LTS)

### 2.2 Wrangler (CLI ของ Cloudflare)
```bash
npm install -g wrangler
wrangler --version
```

### 2.3 Login Wrangler กับ Cloudflare
```bash
wrangler login
```
→ browser จะเปิดขึ้นมา → กด **Allow** → กลับมาเทอร์มินัลจะเห็น "Successfully logged in"

ตรวจสอบ:
```bash
wrangler whoami
```
จะแสดง email + account ID

---

## 3. โปรเจกต์

### 3.1 โครงสร้างไฟล์
สร้างโฟลเดอร์โปรเจกต์:
```bash
mkdir crud_assign2
cd crud_assign2
mkdir src
```

### 3.2 package.json
```json
{
  "name": "crud-assign2-helpdesk",
  "version": "1.0.0",
  "description": "Helpdesk Ticket CRUD - Cloudflare Workers + Hono + D1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:local": "wrangler d1 execute helpdesk-db --local --file=./schema.sql",
    "db:remote": "wrangler d1 execute helpdesk-db --remote --file=./schema.sql",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240605.0",
    "typescript": "^5.5.0",
    "wrangler": "^3.65.0"
  },
  "dependencies": {
    "hono": "^4.4.0"
  }
}
```

### 3.3 tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

### 3.4 wrangler.toml
```toml
name = "helpdesk-api"
main = "src/index.ts"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"

# D1 binding — เอา database_id ที่ได้จากคำสั่ง `wrangler d1 create helpdesk-db` มาใส่
[[d1_databases]]
binding = "DB"
database_name = "helpdesk-db"
database_id = "REPLACE_WITH_YOUR_DATABASE_ID"
```

### 3.5 schema.sql
```sql
-- Helpdesk D1 Schema — Run with:
--   wrangler d1 execute helpdesk-db --local --file=./schema.sql
--   wrangler d1 execute helpdesk-db --remote --file=./schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ticket_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ⚠️ Identity (users) ไม่อยู่ใน Helpdesk domain (PRD §10.2)
-- customer_id / assigned_agent_id อ้างอิง Identity ภายนอก (campus SSO)
-- Verify ใน application layer ผ่าน src/identity.ts (stub)
-- ไม่มี FK constraint เพราะ Helpdesk ไม่รู้จัก user table ของ Identity

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','assigned','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','urgent')),
  category_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,                 -- logical ref → Identity.user
  assigned_agent_id INTEGER,                    -- logical ref → Identity.user
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_agent ON tickets(assigned_agent_id);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ticket_tags (
  ticket_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (ticket_id, tag_id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Seed data — categories + tags เท่านั้น
INSERT OR IGNORE INTO ticket_categories (id, name, description) VALUES
  (1, 'Network',  'Network connectivity / Wi-Fi / VPN issues'),
  (2, 'Hardware', 'Computer, printer, peripheral hardware problems'),
  (3, 'Software', 'Application bugs, installation, license issues'),
  (4, 'Account',  'Login, password, MFA, account access'),
  (5, 'Facility', 'Classroom, building, facility issues');

-- ⚠️ Users seed อยู่ใน src/identity.ts (USER_DIRECTORY) — ไม่ใช่ใน schema นี้
-- เพราะ Helpdesk ไม่ own identity data

INSERT OR IGNORE INTO tags (id, name) VALUES
  (1, 'urgent'), (2, 'bug'), (3, 'hardware'),
  (4, 'software'), (5, 'network');
```

### 3.6 src/identity.ts (PRD §10.2 — Identity stub)

```typescript
export type Role = 'customer' | 'agent' | 'admin';

export interface IdentityRef {
  externalId: number;
  displayName: string;
  role: Role;
  email: string;
}

export const USER_DIRECTORY: Record<number, IdentityRef> = {
  1: { externalId: 1, displayName: 'Alice Customer', role: 'customer', email: 'alice@uni.ac.th' },
  2: { externalId: 2, displayName: 'Bob Customer',   role: 'customer', email: 'bob@uni.ac.th' },
  3: { externalId: 3, displayName: 'Somchai Agent',  role: 'agent',    email: 'somchai@uni.ac.th' },
  4: { externalId: 4, displayName: 'Suda Agent',     role: 'agent',    email: 'suda@uni.ac.th' },
  5: { externalId: 5, displayName: 'Admin User',     role: 'admin',    email: 'admin@uni.ac.th' },
};

export function verify(externalId: number): IdentityRef | null {
  if (!Number.isInteger(externalId) || externalId <= 0) return null;
  return USER_DIRECTORY[externalId] ?? null;
}

export function isAgentOrAdmin(role: Role): boolean {
  return role === 'agent' || role === 'admin';
}
```

**ทำไมแยกไฟล์:** Production จะเปลี่ยน `verify()` → call Identity API จริง (JWT/SSO) แค่ที่เดียว ทุก route handler ใช้ shape เดิม

### 3.7 src/index.ts

> ดูไฟล์ได้ที่ `crud_assign2/src/index.ts` (เขียนไว้แล้วทั้งหมด — ไม่ต้อง copy-paste)
> โครงสร้างหลัก:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

type Bindings = { DB: D1Database };
type Role = 'customer' | 'agent' | 'admin';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'x-user-id', 'x-user-role'] }));

// Auth middleware — เช็ค Identity stub 2 ชั้น
//   1) external id มีอยู่ใน directory
//   2) role ที่ client ส่งมาต้องตรงกับ Identity claim (กัน spoofing)
const requireAuth = async (c, next) => {
  const userId = c.req.header('x-user-id');
  const declaredRole = c.req.header('x-user-role');
  if (!userId || !declaredRole) return c.json({ error: 'Unauthorized' }, 401);

  const identity = verifyIdentity(Number(userId));
  if (!identity) return c.json({ error: 'Unauthorized', message: 'ไม่พบใน Identity' }, 401);
  if (identity.role !== declaredRole) return c.json({ error: 'Forbidden', message: 'role ไม่ตรงกับ Identity' }, 403);

  c.set('user', { id: identity.externalId, role: identity.role, displayName: identity.displayName });
  await next();
};

app.use('/tickets', requireAuth);
app.use('/tickets/*', requireAuth);

// === Routes (ย่อ) ===
app.get('/', (c) => c.json({ service: 'helpdesk-api', version: '1.0.0' }));
app.get('/categories', /* ... */);
app.get('/users', /* ... */);
app.get('/tags', /* ... */);

app.post('/tickets', /* Create */);
app.get('/tickets', /* List with filters + authz */);
app.get('/tickets/:id', /* Read one + ownership check */);
app.patch('/tickets/:id', /* Partial update + field-level authz */);
app.put('/tickets/:id', /* Full update (delegates to PATCH) */);
app.delete('/tickets/:id', /* Delete (admin/owner only) */);
app.post('/tickets/:id/assign', /* Agent assigns */);
app.post('/tickets/:id/resolve', /* Agent resolves + sets resolved_at */);

export default app;
```

**Authorization rules (สรุป)**

| Endpoint | customer | agent | admin |
|---|---|---|---|
| `GET /tickets` | only own | all | all |
| `GET /tickets/:id` | only own | any | any |
| `POST /tickets` | only self | any customer | any |
| `PATCH /tickets/:id` | title, description (own) | all fields | all fields |
| `DELETE /tickets/:id` | only own (open status) | ❌ | any (open) |
| `POST /tickets/:id/assign` | ❌ | ✅ | ✅ |
| `POST /tickets/:id/resolve` | ❌ | ✅ | ✅ |

---

## 4. สร้าง D1 Database

```bash
wrangler d1 create helpdesk-db
```

Output จะคล้ายๆ แบบนี้:
```
✅ Successfully created DB 'helpdesk-db'!

[[d1_databases]]
binding = "DB"
database_name = "helpdesk-db"
database_id = "a1b2c3d4-e5f6-7890-abcd-1234567890ab"
```

**คัดลอก `database_id`** ไปวางใน `wrangler.toml` แทน `"REPLACE_WITH_YOUR_DATABASE_ID"`

---

## 5. รัน Schema

### 5.1 Local (สำหรับตอน dev)
```bash
npm install
npm run db:local
```

คาดหวัง output:
```
🌀 Mapping local DB...
✅ Executed 12 commands
```

### 5.2 Remote (สำหรับ production)
```bash
npm run db:remote
```

---

## 6. รัน local dev server

```bash
npm run dev
```

Output:
```
⛅️ wrangler 3.x.x
Starting local server...
Ready on http://127.0.0.1:8787
```

ทดสอบเร็วๆ:
```bash
curl http://127.0.0.1:8787/
```
ต้องได้:
```json
{
  "service": "helpdesk-api",
  "version": "1.0.0",
  "endpoints": [...]
}
```

---

## 7. ทดสอบด้วย Postman

### 7.1 Import Collection
1. เปิด Postman → **Import** (ปุ่มซ้ายบน)
2. เลือกไฟล์ `crud_assign2/postman_collection.json`
3. โหลดเข้ามาแล้วจะเห็น folder 3 อัน: **Health**, **Ticket CRUD**, **Negative tests**

### 7.2 Environment Variables
ใน Collection มี variables ตั้งต้น:
| Variable | Default | ความหมาย |
|---|---|---|
| `base_url` | `http://127.0.0.1:8787` | URL ของ API |
| `customer_id` | `1` | Alice (customer) |
| `agent_id` | `3` | Somchai (agent) |
| `category_id` | `1` | Network |
| `ticket_id` | `1` | ticket id ที่จะใช้ใน PATCH/DELETE/assign/resolve |

**หลังจาก Create ticket แล้ว** → copy `id` จาก response ไปวางใน `ticket_id` variable

### 7.3 Stub Auth Headers
ทุก request ที่ขึ้นต้นด้วย `/tickets*` ต้องมี 2 headers นี้:
- `x-user-id` → ID ของ user
- `x-user-role` → `customer` | `agent` | `admin`

Postman collection ตั้งให้แล้วในทุก request ที่ต้อง auth

### 7.4 Test Flow (Happy Path)

ทำตามลำดับนี้:

#### Step 1 — Health & Reference
```
GET /              → 200 + service info
GET /categories    → 200 + 5 categories
GET /users         → 200 + 5 users (id 1-2 customer, 3-4 agent, 5 admin)
GET /tags          → 200 + 5 tags
```

#### Step 2 — Create ticket (as customer)
```
POST /tickets
Headers: x-user-id=1, x-user-role=customer
Body: { "title": "Wi-Fi หอพักใช้ไม่ได้", "description": "...", "category_id": 1, "priority": "high" }
```
คาดหวัง: `201 Created` + `data.ticket_number = "TKT-00001"` → copy `id` ไปวางใน `ticket_id` variable

#### Step 3 — List as customer (เห็นแค่ของตัวเอง)
```
GET /tickets
Headers: x-user-id=1, x-user-role=customer
```
คาดหวัง: count=1

#### Step 4 — List as agent (เห็นทั้งหมด)
```
GET /tickets
Headers: x-user-id=3, x-user-role=agent
```

#### Step 5 — Read one
```
GET /tickets/1
Headers: x-user-id=3, x-user-role=agent
```
คาดหวัง: 200 + full ticket with joined category_name, customer_name, agent_name

#### Step 6 — Customer edits title
```
PATCH /tickets/1
Headers: x-user-id=1, x-user-role=customer
Body: { "title": "..." }
```
คาดหวัง: 200, แก้ได้แค่ title/description (ลองส่ง `priority` ดู → จะถูก ignore)

#### Step 7 — Agent changes priority + status
```
PATCH /tickets/1
Headers: x-user-id=3, x-user-role=agent
Body: { "priority": "urgent", "status": "in_progress" }
```

#### Step 8 — Assign
```
POST /tickets/1/assign
Headers: x-user-id=3, x-user-role=agent
Body: { "agent_id": 4 }
```
คาดหวัง: status → `assigned`, `assigned_agent_id` → 4

#### Step 9 — Resolve
```
POST /tickets/1/resolve
Headers: x-user-id=3, x-user-role=agent
Body: { "resolution_note": "รีเซ็ตเราท์เตอร์แล้วใช้ได้" }
```
คาดหวัง: status → `resolved`, `resolved_at` ติ๊ดตั้ง, `resolution_note` บันทึก

#### Step 10 — Delete
```
DELETE /tickets/1
Headers: x-user-id=5, x-user-role=admin
```
คาดหวัง: 200 (ก่อน resolve เท่านั้น — ถ้า resolved แล้วจะ 409)

### 7.5 Negative Tests
Folder **Negative tests** มีอยู่แล้ว ลองยิงทีละตัว:

| Request | Expected | ทำไม |
|---|---|---|
| POST /tickets (missing fields) | 400 | validation |
| POST /tickets (customer create for others) | 403 | BR-01 |
| GET /tickets/1 (customer id=2 อ่านของ id=1) | 403 | BR-07 ownership |
| GET /tickets/99999 | 404 | not found |
| GET /tickets (no auth headers) | 401 | middleware |

---

## 8. Deploy ขึ้น Cloudflare — OPTIONAL (ไม่อยู่ใน scope ของ assignment นี้)

> **ข้าม section นี้ได้เลย** ถ้า instructor ไม่ได้สั่ง deploy
> Assignment 2 เน้น implement + test ในเครื่อง ซึ่งทำครบใน section 1–7 แล้ว

ถ้าวันหลังอยาก deploy จริง:

```bash
npm run deploy
```

Output จะได้ URL แบบ `https://helpdesk-api.<your-subdomain>.workers.dev`

**Deploy D1 schema ไป production** (ต้องรันแยก):
```bash
npm run db:remote
```

**อย่าลืม** แก้ `base_url` ใน Postman เป็น production URL แล้วลองยิงใหม่

**คำเตือน:** D1 production database เป็น resource แยกจาก local — ต้อง `wrangler d1 create helpdesk-db` อีกครั้งเพื่อเอา `database_id` production มาใส่ใน `wrangler.toml`

---

## 9. Acceptance Criteria Mapping

PRD §19 มี 7 required tests ขั้นต่ำ — assignment นี้ครอบคลุม:

| AC | Test endpoint | Expected |
|---|---|---|
| 1. Create ticket | POST /tickets | 201 + ticket_number generated |
| 2. Ticket ownership | GET /tickets/:id (with wrong customer) | 403 |
| 3. Assignment | POST /tickets/:id/assign | 200 + status='assigned' |
| 4. Comment | — | ❌ ยังไม่ทำ (next assignment) |
| 5. Resolve | POST /tickets/:id/resolve | 200 + resolved_at set |
| 6. Maintenance link | — | ❌ ยังไม่ทำ (next assignment) |
| 7. Escalation event | — | ❌ ยังไม่ทำ (next assignment + cron) |

**ที่ assignment นี้ทำเพิ่ม** (ข้ามไปข้างหน้า):
- ✅ Update (PATCH/PUT) — ไม่มีใน AC list แต่เป็น CRUD
- ✅ Delete — ไม่มีใน AC list แต่เป็น CRUD
- ✅ Authorization (RBAC) — BR-01, BR-07
- ✅ Filtering / pagination-ready (LIST query params)

---

## 10. Troubleshooting

| ปัญหา | วิธีแก้ |
|---|---|
| `wrangler: command not found` | `npm install -g wrangler` ใหม่ หรือใช้ `npx wrangler` แทน |
| `Authentication error [code: 10000]` | `wrangler login` ใหม่ |
| `d1_databases binding 'DB' not found` | ใส่ `database_id` ใน `wrangler.toml` ยังไม่ครบ |
| `SqliteError: FOREIGN KEY constraint failed` | ตรวจสอบว่า category_id / customer_id มีใน DB จริงไหม |
| `401 Unauthorized` ตอน Postman | ใส่ headers `x-user-id` และ `x-user-role` ให้ครบ |
| `401 Unauthorized` "ไม่พบ user นี้ในระบบ" | `x-user-id` ที่ส่งมาไม่มีในตาราง users (seed มีแค่ id 1–5) | ตรวจสอบ id จาก `GET /users` ก่อน |
| `GET /tickets` ได้ `500` "Cannot read properties of undefined (reading 'role')" ทั้งที่ใส่ headers แล้ว | **Hono path matching bug:** `app.use('/tickets*', middleware)` ไม่ match exact `/tickets` (wildcard `*` ต้องมี `/` นำหน้า) | ใน `src/index.ts` แก้เป็น 2 call แยก: `app.use('/tickets', requireAuth);` + `app.use('/tickets/*', requireAuth);` แล้ว restart dev server |
| Local DB หาย | `npm run db:local` รันใหม่ — local DB อยู่ใน `.wrangler/state/` |
| Worker รันแล้วแต่หา endpoint ไม่เจอ | เช็ค path ตรงกับ `app.use('/tickets*', requireAuth)` ไหม — หมายถึง path ที่ขึ้นต้นด้วย `/tickets` ทั้งหมด |

---

## 11. What's NOT in scope (next assignments)

- **Comments** (FR-11, FR-12) — ต้องมี table แยก + visibility field
- **Maintenance webhook** (PRD §6.3) — ต้อง verify HMAC signature
- **Outbound events** (PRD §7) — `ticket.created` / `ticket.resolved` ต้อง publish จริง
- **AI triage** (PRD §8) — `POST /tickets/suggest` + fallback rules
- **Real auth** — JWT verify + Identity integration
- **Escalation cron** (PRD §14) — ต้องมี cron trigger ตรวจสอบทุกนาที
- **Pagination** — ตอนนี้ `LIMIT` ไม่มี — ticket 1,000+ ควรใส่
- **Migrations version control** — ตอนนี้ใช้ `schema.sql` ไฟล์เดียว

---

## 12. สรุป

ถ้าทำตามนี้ครบทุก step เพื่อนจะได้:
- ✅ Account Cloudflare ฟรี
- ✅ Workers + Hono รันในเครื่อง (wrangler dev)
- ✅ D1 local database พร้อม schema + seed
- ✅ CRUD API ของ Ticket ครบทุก operation
- ✅ Authorization 3 roles
- ✅ Postman collection ที่ test ซ้ำได้

**ใช้เวลาจริงๆ ประมาณ 1–2 ชั่วโมง** ถ้า Cloudflare account มีอยู่แล้ว
ถ้าสมัครใหม่ด้วย + ติดตั้ง tools → บวกอีก 30 นาที

ถ้าติดตรงไหน ดู error ใน terminal + Postman response body + Cloudflare Workers log (dashboard → Workers → helpdesk-api → Logs) — สำหรับ local ดู log ใน terminal ที่รัน `wrangler dev` ได้เลย