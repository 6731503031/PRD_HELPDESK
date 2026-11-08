# คู่มือทีม: แบ่งงาน 4 คน + วิธีใช้ git

Helpdesk Team 14 · Deadline **อังคาร 10 พ.ย. 2026**
อ่านคู่กับ [FEATURES.md](FEATURES.md) (รายการฟีเจอร์ F01–F30)

---

## 1. ภาพรวมการแบ่งงาน

แต่ละคนถือโฟลเดอร์ของตัวเอง แก้ไฟล์ของตัวเองเป็นหลัก git จะชนกันน้อยที่สุด

| คน | ดูแล | โฟลเดอร์ที่เป็นเจ้าของ | ฟีเจอร์ | ชื่อ |
|---|---|---|---|---|
| **P1** หัวหน้า | Core + Tickets + **หน้าบ้านทั้งหมด** + git/deploy + เอกสาร | `frontend/`, `backend/src/core/`, `backend/src/modules/tickets/`, `backend/src/modules/reference/`, `backend/src/index.ts`, `database/` | F01–F10, F25, F26, F27, F28 | ____ |
| **P2** | Comments + Events | `backend/src/modules/comments/`, `backend/src/modules/events/` | F11, F12, F15–F18 | ____ |
| **P3** | API เชื่อมกับ Team 10 (+ Wellbeing เดิม) | `backend/src/modules/maintenance/`, `backend/src/modules/wellbeing/`, `scripts/send-mock-maintenance-event.mjs` | F13, F14, F29, F30 | ____ |
| **P4** | AI + Admin API | `backend/src/ai/`, `backend/src/modules/admin/` | F19–F21, F31, F23, F24 | ____ |

**ไฟล์ส่วนกลาง** (`backend/src/core/*`, `backend/src/index.ts`, `database/schema.sql`, `frontend/src/api/*`) แก้ได้แต่ **ต้องให้ P1 review** ใน PR
**หน้าบ้านพร้อมแล้วทุกหน้า** P2–P4 ไม่ต้องแตะ `frontend/` ทำ API ให้ตรงสัญญา แล้วหน้าเว็บจะเลิกขึ้น "ยังไม่เปิดใช้งาน" เอง

---

## 2. งานของแต่ละคน (เปิดไฟล์แล้วค้นคำว่า `TODO(P2` เป็นต้น)

ทุกไฟล์มีคอมเมนต์ `TODO(Px, Fyy)` บอกขั้นตอนทีละข้อ และมี **test ที่เขียนคำตอบไว้แล้ว** (ใส่ `.skip` ไว้)
**วิธีรู้ว่าเสร็จ:** ลบ `.skip` ใน test ของตัวเอง → `npm test` ผ่าน → `bash scripts/smoke.sh` ข้อของตัวเองเปลี่ยนจาก 501 เป็นทำงาน → เปิดหน้าเว็บแล้วใช้ได้จริง

### P1: หัวหน้า (Core + Tickets + Frontend + git)
Backend
- [ ] อ่าน `backend/src/core/*` และ `backend/src/modules/tickets/*` จนอธิบายได้ (พรีเซนต์ต้องอธิบาย auth + ownership)
- [ ] **F25** `tickets/rules.ts` → `canTransition()` ตามตารางใน TODO → ลบ `.skip` ใน `backend/test/tickets.rules.test.ts` (describe Lifecycle)

Frontend
- [ ] เมื่อเพื่อน merge API แต่ละตัว เปิดหน้าที่เกี่ยวข้องแล้วลองใช้จริง: ข้อความ (P2) → หน้ารายละเอียดคำร้อง · ผูกใบงาน (P3) → คิวงาน · ขอคำแนะนำ + กล่อง "ระบบแนะนำ" (P4) → หน้าแจ้งปัญหา/คิวงาน · สถิติ/หมวด (P4) → หน้าผู้ดูแล
- [ ] **F27** ตรวจ accessibility: Tab ได้ทุกหน้า, ทุกช่องมี label, ทดสอบจอมือถือ, Lighthouse
- [ ] (ถ้าทัน) Playwright 1 เทสต์: สร้างคำร้อง → เห็นในคำร้องของฉัน
- [ ] แก้หน้าเว็บแบบเห็นผลทันที: 2 terminal → `npm run dev` + `npm run dev:web` → http://localhost:5173

git + ส่งงาน
- [ ] merge scaffold (`feat/final-scaffold`) เข้า `main` · ให้เจ้าของ repo เพิ่มเพื่อนเป็น Collaborator + ตั้ง branch rule
- [ ] review ทุก PR ที่แตะไฟล์ส่วนกลาง · merge ตามลำดับในข้อ 5
- [ ] เขียน `openapi.yaml` จากตาราง API ใน FEATURES.md ข้อ 5 + `RUNBOOK.md` 1 หน้า
- [ ] deploy + รัน migration บน production (ข้อ 6)

### P2: Comments + Events
- [ ] **F11/F12** `comments/rules.ts` → `canPost()`, `visibleTo()` แล้วลบ `.skip` ใน `backend/test/comments.test.ts`
- [ ] **F11/F12** `comments/routes.ts` → GET/POST `/tickets/:id/comments` ตาม TODO
- [ ] **F15/F16/F18** `events/publish.ts` → เก็บลงตาราง `domain_events` (ห้าม throw)
- [ ] **F17** `events/escalation.ts` → `isEscalationDue()` + `runEscalation()` แล้วลบ `.skip` ใน `backend/test/escalation.test.ts`
- [ ] ทดสอบ cron: `npx wrangler dev --test-scheduled` แล้วเปิด `http://127.0.0.1:8787/__scheduled`
- [ ] เช็กในหน้าเว็บ: เจ้าหน้าที่เขียนข้อความภายใน → ผู้แจ้งต้องมองไม่เห็น

### P3: API เชื่อมกับ Team 10
- [ ] ส่งเอกสาร `docs/Helpdesk-Maintenance-Integration-Proposal.docx` ให้ Team 10 และตามคำตอบ (ข้อ 1, 2, 3, 6, 7, 9 ต้องได้ก่อน)
- [ ] **F29** `maintenance/signature.ts` → `verifyWebhook()` แล้วลบ `.skip` ชุด signature ใน `backend/test/maintenance.test.ts`
- [ ] **F14** `maintenance/mapping.ts` → `mapWorkOrderStatus()` ใช้สถานะจริงของ Team 10
- [ ] **F13** `maintenance/client.ts` + route `POST /tickets/:id/link-maintenance`
- [ ] **F14** route `POST /webhooks/maintenance` ตาม TODO 8 ขั้น
- [ ] **F30** secret: `cp dev.vars.example .dev.vars` (เครื่องตัวเอง) · `wrangler secret put MAINTENANCE_WEBHOOK_SECRET` (production)
- [ ] ทดสอบด้วย mock: `MAINTENANCE_WEBHOOK_SECRET=dev-secret npm run mock:maintenance -- WO-0045 in_progress`
- [ ] เทสต์ร่วม 8 ข้อกับ Team 10 เก็บ screenshot + correlation ID (ไม่พร้อม → ใช้ mock)

### P4: AI + Admin API
- [ ] **F21** `ai/fallback.ts` → `suggestFallback()` (จับคำทั้งคำด้วย `\b`)
- [ ] **F20** `ai/fallback.ts` → `validateAiOutput()`
- [ ] **F19** `ai/ai.ts` → `askAi()` + route `POST /tickets/suggest` ใน `ai/routes.ts`
- [ ] **F31** `ai/record.ts` → `pickSuggestion()` + `recordSuggestion()` (เก็บคำแนะนำลงคำร้องหลังสร้าง)
- [ ] ลบ `.skip` ใน `backend/test/ai.test.ts` ทั้งสองชุด
- [ ] ห้ามมีชื่อ/อีเมลผู้ใช้ใน prompt หรือ log
- [ ] **F23/F24** `admin/routes.ts` → สถิติ + เพิ่ม/ปิดหมวดหมู่
- [ ] เช็กในหน้าเว็บ: "แอร์ห้อง B-204 ไม่เย็น" → ขอคำแนะนำได้ Facility / สูง / ส่งต่อฝ่ายซ่อมบำรุง และในคิวงานเห็นกล่อง "ระบบแนะนำ"

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

แก้หน้าเว็บแบบเห็นผลทันที: เปิด 2 terminal → `npm run dev` + `npm run dev:web` → เปิด http://localhost:5173

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
1. งานที่ไม่ขึ้นกับใคร merge ได้ตลอด: P2 comments, P4 AI/admin, P1 lifecycle/OpenAPI/หน้าเว็บ
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
| 2 | P1 + P4 | Demo หน้าเว็บ (P1) + อธิบาย AI แนะนำ/fallback (P4): ผู้แจ้งสร้างคำร้อง + AI แนะนำ → เจ้าหน้าที่คัดกรอง/มอบหมาย | หน้าเว็บสด |
| 3 | P3 | Integration Team 10: proposal, webhook, HMAC, ส่ง mock event สด | `maintenance/routes.ts`, script |
| 4 | P2 | ข้อความ public/internal, events, escalation | `comments/rules.ts`, `escalation.ts` |
| 5 | P1 | Tests (`npm test`), CI, limitations, future work | GitHub Actions + PR history |

**Limitations ที่ต้องพูดเอง:** Identity เป็น stub · ถ้า Team 10 ยังไม่พร้อม webhook ทดสอบกับ mock
