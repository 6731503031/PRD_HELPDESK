# คู่มือทีม: แบ่งงาน 4 คน + วิธีใช้ git

Helpdesk Team 14 · Deadline **อังคาร 10 พ.ย. 2026**
อ่านคู่กับ [FEATURES.md](FEATURES.md) (รายการฟีเจอร์ F01–F30)

---

## 1. ภาพรวมการแบ่งงาน

ระบบแบ่งเป็น **โมดูล** แต่ละคนถือโฟลเดอร์ของตัวเอง แก้ไฟล์ของตัวเองเป็นหลัก git จะชนกันน้อยที่สุด

| คน | บทบาท | โฟลเดอร์ที่เป็นเจ้าของ | ฟีเจอร์ | ชื่อ (ใส่เอง) |
|---|---|---|---|---|
| **P1** | Core & Tickets + เอกสาร | `backend/src/core/`, `backend/src/modules/tickets/`, `backend/src/modules/reference/`, `backend/src/index.ts`, `database/schema.sql`, `database/migrations/`, `README.md`, `openapi.yaml` | F01–F10, F25, F28 | ____ |
| **P2** | Comments & Events | `backend/src/modules/comments/`, `backend/src/modules/events/` | F11, F12, F15–F18 | ____ |
| **P3** | Integrations (Team 10 + Team 16) | `backend/src/modules/maintenance/`, `backend/src/modules/wellbeing/`, `scripts/send-mock-maintenance-event.mjs` | F13, F14, F29, F30 + คุยกับ Team 10 | ____ |
| **P4** | AI Triage + Admin + Frontend | `backend/src/ai/`, `backend/src/modules/admin/`, `frontend/` | F19–F24, F26, F27, F31 | ____ |

**ไฟล์ส่วนกลาง** (`backend/src/core/*`, `backend/src/index.ts`, `database/schema.sql`, `frontend/src/api/client.ts`, `frontend/src/api/types.ts`) แก้ได้แต่ **ต้องให้ P1 review** ใน PR

---

## 2. งานของแต่ละคน (เปิดไฟล์แล้วค้นคำว่า `TODO(P2` เป็นต้น)

ทุกไฟล์มีคอมเมนต์ `TODO(Px, Fyy)` บอกขั้นตอนทีละข้อ และมี **test ที่เขียนคำตอบไว้แล้ว** (ใส่ `.skip` ไว้)
**วิธีรู้ว่าทำเสร็จ:** ลบ `.skip` ใน test ของตัวเอง → `npm test` ผ่าน → `bash scripts/smoke.sh` ข้อของตัวเองเปลี่ยนจาก 501 เป็นทำงาน

### P1: Core & Tickets + เอกสาร
ส่วนใหญ่ทำงานได้แล้ว งานคือทำความเข้าใจ เก็บรายละเอียด และเป็นคน review/merge
- [ ] อ่าน `backend/src/core/*` และ `backend/src/modules/tickets/*` จนอธิบายได้ (ตอนพรีเซนต์ต้องอธิบาย auth + ownership)
- [ ] **F25** `tickets/rules.ts` → `canTransition()` ตามตารางใน TODO → ลบ `.skip` ใน `backend/test/tickets.rules.test.ts` (describe Lifecycle)
- [ ] เขียน `openapi.yaml` (OpenAPI 3.1) จากตาราง API ใน FEATURES.md ข้อ 5 (Definition of Done ของอาจารย์)
- [ ] อัปเดต `README.md` + เขียน `RUNBOOK.md` 1 หน้า: health check (`/api/v1/health`), ถ้าระบบล่มทำอะไร, ใครดูแลส่วนไหน
- [ ] รัน migration บน production ตอน deploy (ข้อ 6)
- [ ] เป็นคน review PR ที่แตะไฟล์ส่วนกลาง

### P2: Comments & Events
- [ ] **F11/F12** `comments/rules.ts` → `canPost()`, `visibleTo()` แล้วลบ `.skip` ใน `backend/test/comments.test.ts`
- [ ] **F11/F12** `comments/routes.ts` → GET/POST `/tickets/:id/comments` ตาม TODO (หน้าเว็บเรียกอยู่แล้ว)
- [ ] **F15/F16/F18** `events/publish.ts` → เก็บลงตาราง `domain_events` + POST ไป `EVENT_HUB_URL` ถ้ามี (ห้าม throw)
- [ ] **F17** `events/escalation.ts` → `isEscalationDue()` + `runEscalation()` แล้วลบ `.skip` ใน `backend/test/escalation.test.ts`
- [ ] ทดสอบ cron บนเครื่อง: `npx wrangler dev --test-scheduled` แล้วเปิด `http://127.0.0.1:8787/__scheduled`

### P3: Integrations (Team 10 Maintenance)
- [ ] ส่งเอกสาร `docs/Helpdesk-Maintenance-Integration-Proposal.docx` ให้ Team 10 และตามคำตอบ 10 ข้อ
- [ ] **F29** `maintenance/signature.ts` → `verifyWebhook()` แล้วลบ `.skip` ชุด signature ใน `backend/test/maintenance.test.ts`
- [ ] **F14** `maintenance/mapping.ts` → `mapWorkOrderStatus()` (ใช้ค่า status จริงของ Team 10 เมื่อได้คำตอบ)
- [ ] **F13** `maintenance/client.ts` + route `link-maintenance`
- [ ] **F14** route `webhooks/maintenance` ตาม TODO 8 ขั้น
- [ ] **F30** ใส่ secret: คัดลอก `dev.vars.example` เป็น `.dev.vars` (เครื่องตัวเอง) และ `wrangler secret put MAINTENANCE_WEBHOOK_SECRET` (production)
- [ ] ทดสอบด้วย mock: `MAINTENANCE_WEBHOOK_SECRET=dev-secret npm run mock:maintenance -- WO-0045 in_progress`
- [ ] ถ้า Team 10 พร้อม: เทสต์ร่วม 8 ข้อตามเอกสาร proposal เก็บ screenshot + correlation ID

### P4: AI Triage + Admin + Frontend
- [ ] **F21** `ai/fallback.ts` → `suggestFallback()` (จับคำทั้งคำด้วย `\b`) แล้วลบ `.skip` ใน `backend/test/ai.test.ts`
- [ ] **F20** `validateAiOutput()` · **F19** `ai/ai.ts` → `askAi()` · route `/tickets/suggest`
- [ ] **F31** `ai/record.ts` → `pickSuggestion()` (ใช้ร่วมกับ route `/tickets/suggest`) + `recordSuggestion()` เก็บคำแนะนำลงคำร้องหลังสร้าง แล้วลบ `.skip` ชุด F31 ใน `backend/test/ai.test.ts` → เปิดคำร้องในคิวงานจะเห็นกล่อง "ระบบแนะนำ"
- [ ] Log prompt ของ AI โดย **ไม่มี** ชื่อ/อีเมลผู้ใช้ (PRD กลางกำหนด)
- [ ] **F23/F24** `admin/routes.ts` → stats + จัดการหมวด (หน้า Admin เรียกอยู่แล้ว)
- [ ] **F27** ตรวจ accessibility: ใช้ Tab ทุกหน้าได้, ทุกช่องมี label, ทดสอบมือถือ, ตรวจด้วย Lighthouse
- [ ] (ถ้าทัน) Playwright 1 เทสต์: สร้างคำร้อง → เห็นในคำร้องของฉัน

---

## 3. เริ่มงานครั้งแรก (ทุกคนทำ 1 ครั้ง)

```bash
# 1) ตั้งชื่อ/อีเมลให้ตรงกับ GitHub (สำคัญ: ไม่งั้นอาจารย์ไม่เห็นว่าเป็นงานเรา)
git config --global user.name  "ชื่อ นามสกุล"
git config --global user.email "รหัสนักศึกษา@lamduan.mfu.ac.th"   # อีเมลนี้ต้องเพิ่มใน GitHub → Settings → Emails

# 2) โหลดโปรเจกต์
git clone https://github.com/6731503031/PRD_HELPDESK.git
cd PRD_HELPDESK
npm install

# 3) สร้าง DB บนเครื่อง + secret สำหรับ dev
npm run db:local:fresh
cp dev.vars.example .dev.vars

# 4) รัน
npm run dev            # build หน้าเว็บ + รัน Worker → เปิด http://127.0.0.1:8787
npm test               # unit tests
bash scripts/smoke.sh  # ทดสอบ API ทั้งระบบ (ต้องรัน npm run dev ค้างไว้)
```

แก้หน้าเว็บแบบเห็นผลทันที (P4): เปิด 2 terminal → `npm run dev` + `npm run dev:web` → เปิด http://localhost:5173

---

## 4. วิธีใช้ git (ทุกคนทำแบบเดียวกัน)

### กฎ 5 ข้อ
1. **ห้าม push ขึ้น `main` ตรง ๆ** ทุกอย่างผ่าน Pull Request (PR)
2. **1 branch ต่อ 1 งาน** ชื่อ `<คน>/<งาน>` เช่น `p2/comments`, `p3/webhook`, `p4/ai-fallback`
3. **commit เล็ก ๆ บ่อย ๆ** ข้อความขึ้นต้นด้วยประเภท: `feat(comments): add internal visibility rule`
   ประเภท: `feat` ฟีเจอร์ใหม่ · `fix` แก้บั๊ก · `test` เพิ่ม test · `docs` เอกสาร · `refactor` จัดโค้ด
4. **PR ต้องผ่าน CI (เครื่องหมายถูกสีเขียว) + เพื่อน 1 คน approve** ก่อน merge
5. **ห้าม commit secret** (`.dev.vars` ถูก ignore ไว้แล้ว อย่าเอาออก)

### คู่ review
| เขียน | คน review |
|---|---|
| P1 | P2 |
| P2 | P1 |
| P3 | P4 |
| P4 | P3 |
| แตะไฟล์ส่วนกลาง | + P1 |

### ทำงานทีละรอบ (copy ได้เลย)
```bash
git switch main
git pull                                 # เอาของล่าสุดก่อนเริ่มทุกครั้ง
git switch -c p2/comments                # branch ใหม่ของงานนี้

# ... เขียนโค้ด ...
npm test && npm run typecheck            # ต้องผ่านก่อน commit
git add backend/src/modules/comments backend/test/comments.test.ts
git commit -m "feat(comments): implement visibility rules (F12)"
git push -u origin p2/comments
```
แล้วเปิด GitHub → **Compare & pull request** → เขียนว่าทำอะไร, ฟีเจอร์ F อะไร, ทดสอบยังไง → ขอ review จากคู่

### ระหว่างรอ review แล้ว main มีของใหม่
```bash
git switch p2/comments
git pull origin main          # ดึงของใหม่มารวม
# ถ้ามี conflict: เปิดไฟล์ แก้ส่วนที่มี <<<<<<< ======= >>>>>>> แล้ว
git add <ไฟล์> && git commit
git push
```

### Merge
ใช้ปุ่ม **Create a merge commit** (ไม่ใช้ Squash) เพื่อให้ commit ของแต่ละคนยังอยู่ใน history เป็นหลักฐานตอนพรีเซนต์

### ตั้งค่า GitHub (เจ้าของ repo ทำครั้งเดียว)
Settings → Branches → Add rule สำหรับ `main` → ติ๊ก *Require a pull request* (1 approval) + *Require status checks* (เลือก `CI / test`)

---

## 5. ลำดับ merge (กันพัง)

0. **Scaffold** (`feat/final-scaffold`) → merge เข้า main ก่อน ทุกคนเริ่มจากตรงนี้
1. งานที่ไม่ขึ้นกับใคร merge ได้ตลอด: P2 comments, P4 fallback/admin, P1 lifecycle/OpenAPI
2. P3 webhook merge หลังทดสอบกับ mock ผ่าน
3. P2 events merge ท้ายสุด (แตะจุดที่โมดูลอื่นเรียก)

---

## 6. Deploy (P1 ทำ หลัง merge ครบ)

```bash
npm run db:remote:migrate                       # ครั้งเดียว: เพิ่มตารางใหม่บน production
npx wrangler secret put MAINTENANCE_WEBHOOK_SECRET
npm run deploy                                  # build หน้าเว็บ + deploy Worker
BASE=https://helpdesk-api.team-helpdesk.workers.dev bash scripts/smoke.sh
```

---

## 7. Timeline ถึงวันอังคาร

| เวลา | ทำอะไร | ใคร |
|---|---|---|
| อาทิตย์ คืน | merge scaffold · ทุกคน clone + รันได้ · เลือก P1–P4 · ส่ง proposal ให้ Team 10 | ทุกคน |
| จันทร์ เช้า–บ่าย | ทำ TODO ของตัวเอง + เปิด PR | ทุกคน |
| จันทร์ 18:00 | review + merge ทุก PR | คู่ review |
| จันทร์ 20:00 | deploy + smoke test production + เก็บ screenshot | P1 + ทุกคน |
| จันทร์ 21:00 | เทสต์ร่วม Team 10 (ถ้าพร้อม) ไม่พร้อมใช้ mock | P3 |
| อังคาร เช้า | สไลด์ + ซ้อมพรีเซนต์ 1 รอบ | ทุกคน |

---

## 8. พรีเซนต์ (แต่ละคนพูดงานตัวเอง ~3 นาที)

| ลำดับ | ใคร | เนื้อหา | เปิดให้ดู |
|---|---|---|---|
| 1 | P1 | ปัญหา, PRD, ผู้ใช้ 3 role, architecture, data ownership, auth | `backend/src/core/auth.ts`, `tickets/rules.ts` |
| 2 | P4 | Demo หน้าเว็บ: ผู้แจ้งสร้างคำร้อง + AI แนะนำ → เจ้าหน้าที่คัดกรอง/มอบหมาย | หน้าเว็บสด |
| 3 | P3 | Integration Team 10: proposal, webhook, HMAC, ส่ง mock event สด | `maintenance/routes.ts`, script |
| 4 | P2 | ข้อความ public/internal, events, escalation | `comments/rules.ts`, `escalation.ts` |
| 5 | P1 | Tests (`npm test`), CI, limitations, future work | GitHub Actions + PR history |

**Limitations ที่ต้องพูดเอง:** Identity เป็น stub · ถ้า Team 10 ยังไม่พร้อม webhook ทดสอบกับ mock
