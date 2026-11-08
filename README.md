# Helpdesk Platform: Team 14

ระบบแจ้งปัญหาและติดตามคำร้องสำหรับนักศึกษาและบุคลากร (University Digital Campus, Pod 4 Student Support)
**Production:** https://helpdesk-api.team-helpdesk.workers.dev

React + TypeScript + Vite (หน้าบ้าน) · Cloudflare Workers + Hono (หลังบ้าน) · Cloudflare D1 (ฐานข้อมูล) · Workers AI · Vitest · GitHub Actions

## โครงสร้างโปรเจกต์

```
PRD_HELPDESK/
│
├── frontend/                 หน้าบ้าน: React (ผู้ใช้เห็นและกด)                    P1
│   ├── index.html
│   ├── vite.config.ts        build ไป public/ ให้ Worker เสิร์ฟ
│   └── src/
│       ├── pages/            Login, CreateTicket, MyTickets, AgentQueue, Admin
│       ├── components/       ตาราง, รายละเอียดคำร้อง, ปุ่ม/ฟอร์มกลาง
│       ├── api/              client.ts เรียก /api/v1 + types.ts
│       ├── auth/             เข้าสู่ระบบแบบ stub
│       ├── lib/              router, format, useAsync
│       └── styles/app.css    ธีม glassmorphism
│
├── backend/                  หลังบ้าน: Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts          รวมทุกโมดูล + /api/v1 + cron                       P1
│   │   ├── core/             env, auth (Identity stub), error, correlation id    P1
│   │   ├── modules/
│   │   │   ├── tickets/      สร้าง / คิว / รายละเอียด / มอบหมาย / ปิดงาน           P1
│   │   │   ├── reference/    categories, users, health                          P1
│   │   │   ├── comments/     ข้อความ public / internal                           P2
│   │   │   ├── events/       ticket.* events + escalation (cron)                P2
│   │   │   ├── maintenance/  เชื่อม Team 10: ผูกใบงาน + webhook HMAC             P3
│   │   │   ├── wellbeing/    Team 16 catalogue (ทำเสร็จแล้ว)                     P3
│   │   │   └── admin/        สถิติ + จัดการหมวดหมู่                              P4
│   │   └── ai/               ★ ส่วน AI: แนะนำหมวด/ความเร่งด่วน + fallback        P4
│   │       ├── ai.ts         เรียก Workers AI (Llama 3.1 8B)
│   │       ├── fallback.ts   กฎ keyword เมื่อ AI ใช้ไม่ได้ + ตรวจผลลัพธ์ AI
│   │       ├── record.ts     เก็บคำแนะนำไว้กับคำร้อง ให้เจ้าหน้าที่เห็นในคิวงาน
│   │       └── routes.ts     POST /tickets/suggest
│   ├── test/                 Vitest (test ที่ .skip = รอเจ้าของงานทำ)
│   └── postman_collection.json
│
├── database/                 ฐานข้อมูล D1
│   ├── schema.sql            สร้าง DB ใหม่ทั้งหมด
│   └── migrations/           อัปเดต DB ที่มีอยู่แล้ว
│
├── scripts/                  smoke test, จำลอง webhook ของ Team 10
├── docs/                     PRD, ฟีเจอร์, แบ่งงาน, proposal Team 10, งานที่ส่งแล้ว
├── .github/workflows/        CI: typecheck + test ทุก PR
├── package.json              คำสั่งทั้งหมด (รันจาก root)
└── wrangler.toml             config Cloudflare (D1, AI, cron, static assets)
```

ข้อมูลไหลแบบนี้: `frontend` → `/api/v1` → `backend/src/modules/*` → D1 (`database/`).
หน้าแจ้งปัญหาเรียก `backend/src/ai/` เพื่อขอคำแนะนำ ผู้ใช้แก้ค่าได้ทุกช่องก่อนส่ง

## เริ่มใช้งาน

```bash
npm install
npm run db:local:fresh        # สร้าง DB บนเครื่อง (ครั้งแรก)
cp dev.vars.example .dev.vars # secret สำหรับ dev
npm run dev                   # http://127.0.0.1:8787  (หน้าเว็บ + API)
```

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | build หน้าบ้านแล้วรัน Worker บนเครื่อง |
| `npm run dev:web` | หน้าบ้านแบบ hot reload ที่ :5173 (ต้องรัน `npm run dev` คู่กัน) |
| `npm test` | unit tests |
| `npm run typecheck` | ตรวจ type ทั้งหลังบ้านและหน้าบ้าน |
| `bash scripts/smoke.sh` | ทดสอบ API ทั้งระบบกับ server ที่รันอยู่ |
| `npm run mock:maintenance -- WO-0045 in_progress` | จำลอง Team 10 ส่ง webhook |
| `npm run db:remote:migrate` | เพิ่มตารางใหม่บน production (ครั้งเดียว) |
| `npm run deploy` | build + deploy |

เปิดเว็บแล้วจะเจอหน้าเข้าสู่ระบบ (เลือกบัญชีทดสอบ) หรือข้ามด้วย `?as=<id>` เช่น http://127.0.0.1:8787/?as=3#/queue

## เอกสาร

| เอกสาร | ใช้ตอนไหน |
|---|---|
| [docs/PRD.md](docs/PRD.md) | PRD v1.0: ขอบเขตและ requirement |
| [docs/FEATURES.md](docs/FEATURES.md) | ฟีเจอร์ F01–F30 + สถานะ, ผู้ใช้ 3 role, API, tests |
| [docs/TEAM_GUIDE.md](docs/TEAM_GUIDE.md) | ใครทำอะไร (P1–P4), วิธีใช้ git, timeline |
| [docs/Team-Roles.docx](docs/Team-Roles.docx) | แบ่งงาน 4 คนแบบอ่านง่าย: แผนภาพ, ฟีเจอร์ต่อคน, timeline |
| [docs/Helpdesk-Maintenance-Integration-Proposal.docx](docs/Helpdesk-Maintenance-Integration-Proposal.docx) | ข้อเสนอเชื่อมกับ Team 10 Maintenance |
| [docs/assignments/](docs/assignments/) | งาน A2 และ A5 ที่ส่งไปแล้ว |

## หมายเหตุ

- ผู้ใช้เป็น Identity stub (PRD §20) ไม่เชื่อมกับทีมอื่น: ส่ง header `x-user-id` + `x-user-role` ตาม `backend/src/core/identity.ts` (6 คน: 3 customer, 2 agent, 1 admin) หน้าเว็บส่งให้เองหลังเข้าสู่ระบบ
- endpoint ที่ยังไม่ทำตอบ `501` พร้อมชื่อผู้รับผิดชอบ หน้าเว็บแสดงว่า "ยังไม่เปิดใช้งาน"
- path เดิมของ A2 (ไม่มี `/api/v1`) ยังใช้ได้ Postman collection เดิมใช้ต่อได้
