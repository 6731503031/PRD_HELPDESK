# Frontend Shared UI, Profile, Formatting, and Styles

บทนี้รวบรวม frontend modules ที่ใช้ซ้ำหลายหน้า: profile editing, common UI primitives, icons/avatar/logo, display/repair helpers และ global stylesheet. อธิบายว่าค่า/API data ถูกแปลงเป็น label/layout อย่างไร และ component แต่ละกลุ่มมีหน้าที่แบบไหน

## 1. Files และความสัมพันธ์

| File | หน้าที่ |
|---|---|
| [`frontend/src/pages/Profile.tsx`](../../../../frontend/src/pages/Profile.tsx:10) | guest requester แก้ display name/contact email |
| [`frontend/src/components/ui.tsx`](../../../../frontend/src/components/ui.tsx:7) | badge, status track, notice, error/loading states, form field และ panel |
| [`frontend/src/components/Icon.tsx`](../../../../frontend/src/components/Icon.tsx:2) | inline SVG icon registry และ initials avatar |
| [`frontend/src/components/Logo.tsx`](../../../../frontend/src/components/Logo.tsx:5) | inline SVG brand mascot |
| [`frontend/src/lib/format.ts`](../../../../frontend/src/lib/format.ts:3) | status/priority/role labels, Maintenance labels, date/time/age formatting |
| [`frontend/src/lib/repair.ts`](../../../../frontend/src/lib/repair.ts:5) | Team 10 repair categories และ UI-side category guess |
| [`frontend/src/styles/app.css`](../../../../frontend/src/styles/app.css:1) | CSS design tokens, layout, controls, page sections, responsive rules, motion |
| [`frontend/src/api/client.ts`](../../../../frontend/src/api/client.ts:63) | `updateProfile` call ที่ Profile ใช้; shared transport/error handling |
| [`frontend/src/auth/identity.tsx`](../../../../frontend/src/auth/identity.tsx:140) | server update + React/local guest profile synchronization |

## 2. Profile page: guest profile update

### Component state

[`Profile()`](../../../../frontend/src/pages/Profile.tsx:10) อ่าน `user` และ `updateProfile` จาก `useIdentity()`, คำนวณ `guest = isGuest(user)`, แล้ว initialize local state:

- `name` จาก `user.full_name` หรือ empty string
- `email` จาก `user.email` หรือ empty string
- `fields` เป็น map ของ validation message ต่อ field
- `saved`, `error`, `saving` สำหรับ UI feedback/status

### `save(e)` execution

1. `preventDefault()` เพื่อไม่ reload browser form.
2. set saving, clear saved/error/field errors.
3. เรียก context action `updateProfile(name.trim(), email.trim())`.
4. success ตั้ง `saved = true`.
5. ถ้า `ApiError` มี `fields`, เก็บ field errors เพื่อส่งลง `Field`; error แบบอื่นเก็บเป็น `error`.
6. `finally` reset saving.

`IdentityProvider.updateProfile()` เป็นผู้เรียก `api.updateProfile`, อัปเดต React `user` และเขียน guest object ใหม่ใน local storage; Profile page ไม่แก้ storage เอง

### Role-dependent UI

- `guest === false` → แสดง read-only “Demo account” notice; built-in static demo accounts แก้ profile ไม่ได้.
- guest → แสดง form, name max 60, email max 120 และ optional. ปุ่ม save disable ระหว่าง request หรือชื่อที่ trim แล้วสั้นกว่า 2.
- server ทำ validation ซ้ำ; ชื่อ/อีเมล self-declared และไม่ verify ตาม identity stub contract.

`maxLength` และ button disabling ช่วย UX เท่านั้น; API/backend profile validation เป็น enforcement layer

## 3. Shared components ใน `ui.tsx`

### Status/priority display

- [`StatusBadge({ status })`](../../../../frontend/src/components/ui.tsx:7) เอา status ไปอ่าน `STATUS_LABEL` แล้วสร้าง class `status--<status>`.
- [`PriorityText({ priority })`](../../../../frontend/src/components/ui.tsx:11) เอา priority ไปอ่าน `PRIORITY_LABEL` และสร้าง `priority--<priority>`.
- [`StatusTrack({ status })`](../../../../frontend/src/components/ui.tsx:19) แปลง `closed` เป็น visible `resolved` stage ผ่าน `stageOf`, หา index ใน `STATUS_ORDER`, แล้วแสดง 3-step Open → In progress → Resolved track. Steps ก่อน current เป็น done; resolved/closed ทำให้ final step ก็ done.

Component ทำ render mapping; สีและ geometry มาจาก CSS variables/classes ใน stylesheet

### Feedback and API errors

- [`Notice({ tone, title, children })`](../../../../frontend/src/components/ui.tsx:42) ใช้ `role="alert"` เฉพาะ error tone; tone อื่นเป็น `status`.
- [`ErrorNotice({ error })`](../../../../frontend/src/components/ui.tsx:52) render `NotReadyError` เป็น warning ที่บอก feature/owner; `ApiError`/`Error` ใช้ `.message`; unknown error ใช้ generic “Something went wrong”.
- [`Loading({ variant, label })`](../../../../frontend/src/components/ui.tsx:78) สร้าง semantic loading container (`role=status`, `aria-live`, `aria-busy`) พร้อม skeleton ตาม variant `text`, `table`, `dashboard`, `detail`.

### Form/layout primitives

- [`Field`](../../../../frontend/src/components/ui.tsx:116) รวม label, required marker, hint, children และ field error. It derives hint/error element ids; input components set `aria-invalid`/`aria-describedby` where needed.
- [`Panel`](../../../../frontend/src/components/ui.tsx:144) วาด section card; optional title/action, `quiet`, `flush`. `flush` ใช้เมื่อ child มี padding/layout เอง (เช่น full-width tables).

ข้อควรเข้าใจ: component primitives ลด markup duplication แต่ไม่แทน validation/submit logic ของแต่ละ page

## 4. Icon, Avatar, Logo

### `Icon`

ใน [`Icon.tsx`](../../../../frontend/src/components/Icon.tsx:2), `PATHS` map ชื่อ icon ไป SVG path strings; `IconName = keyof typeof PATHS` ให้ TypeScript จำกัดชื่อที่เรียกได้. [`Icon({ name, size })`](../../../../frontend/src/components/Icon.tsx:21) วาด SVG ด้วย `stroke="currentColor"`, 24×24 viewBox, และ aria-hidden/focusable=false เพราะไอคอนตกแต่ง; button/link ต้องมี text หรือ accessible label ของตัวเอง

### `Avatar`

[`Avatar({ name, size })`](../../../../frontend/src/components/Icon.tsx:41):

1. fallback null name เป็น `?`, trim.
2. split ด้วย whitespace, เอาไม่เกินสองคำ.
3. `initial()` ข้าม Thai leading vowel symbols `เ แ โ ใ ไ` เพื่อพยายามเลือกพยัญชนะต้น.
4. join initials, uppercase.
5. คำนวณ hue deterministic จาก character codes, สร้าง HSL background/foreground.

Avatar เป็น CSS/SVG-free initials ไม่เก็บ/โหลด profile photo; marked `aria-hidden` เพราะ display identity text อยู่ข้าง ๆ ใน callers

### `Logo`

[`Logo({ size, title })`](../../../../frontend/src/components/Logo.tsx:5) เป็น pure inline SVG (สีพื้น, headset, face, microphone). ถ้ามี `title` จะตั้ง `role=img`, `aria-label`; ถ้าไม่มี title จะ `aria-hidden=true`. Favicon ใน [`frontend/index.html`](../../../../frontend/index.html:8) ใช้ drawing ที่เทียบเคียงกัน แต่เป็น data URI แยกจาก React component

## 5. Display formatting helpers

### Status and priority maps

ใน [`format.ts`](../../../../frontend/src/lib/format.ts:3):

- `STATUS_LABEL` map status enum ไป label.
- `STATUS_ORDER` มี visible steps `open`, `in_progress`, `resolved`.
- `stageOf('closed')` คืน `resolved`, เพราะ closed เป็น terminal/internal end state ที่แสดงเป็นขั้น resolved.
- `normalizeStatus('assigned')` คืน `in_progress` เพื่อรองรับ legacy Assignment 2 rows; ค่าอื่น cast เป็น `TicketStatus`.
- `statusLabel` อ่าน label หลัง normalize; unknown value fallback เป็น raw text.
- `MAINTENANCE_LABEL`, `maintenanceLabel`, `isRepairDone` แปลง external work-order statuses เป็นข้อความ/finished predicate; unknown status แสดง raw value.
- `PRIORITY_LABEL`, `PRIORITY_HINT`, `ROLE_LABEL`, `ROUTE_LABEL` เป็น display dictionaries ที่ pages/shared components ใช้.

### Date, message grouping, list time, queue age

- `toDate(value)` ถ้า D1 string ไม่มี `T`, เปลี่ยน space เป็น `T` และเติม `Z` เพื่อ parse เป็น UTC; ถ้ามี `T` อยู่แล้วส่งให้ `Date` parser ตาม string.
- `formatDateTime`/`formatDate` ใช้ `Intl.DateTimeFormat('en-GB', ...)`; null เป็น en dash.
- `formatTime`, `sameDay`, `closeInTime` ใช้กับ chat; `closeInTime` เป็น <5 minutes.
- `dayLabel` คืน Today/Yesterday/date; `listTime` คืน time วันนี้ หรือ day/date สำหรับ conversation list.
- `age` คำนวณเวลาจาก `Date.now()`, clamp negative minutes เป็น 0, แล้วแสดง minutes/hours/days ด้วย `Math.round`.

Timezone note: SQLite datetime strings ถูกตีความ UTC โดย `toDate`; date/day comparisons ใช้ JavaScript local calendar getters (`getFullYear/getMonth/getDate`). เวลาใกล้เที่ยงคืนอาจอยู่คนละ local day ตาม browser timezone

## 6. Repair category guesser

[`REPAIR_CATEGORIES`](../../../../frontend/src/lib/repair.ts:5) ต้องตรงกับ backend list `REPAIR_CATEGORIES`; `RepairCategory` derives union จาก array.

[`guessRepairCategory(text)`](../../../../frontend/src/lib/repair.ts:24) lowercases input, iterates `HINTS` order, แล้วใช้ `String.includes()` กับ keyword list; returns first category match, else `Not sure`. Order คือ Safety → HVAC → Plumbing → Electrical; Thai keywords จับเป็น substring โดยตรง. Labels อธิบาย category ให้ admin เลือกใน repair form.

นี่เป็น UI default suggestion เท่านั้น: ไม่มี persistence/network call, admin เลือกเปลี่ยนได้, backend ตรวจ category ซ้ำด้วย exact allowlist. เนื่องจากใช้ substring ไม่ใช่ whole word อาจมี partial-word matches; tests ของ maintenance module ตรวจ allowlist/validator แต่ไม่ได้ unit-test `guessRepairCategory`

## 7. Global stylesheet organization

[`app.css`](../../../../frontend/src/styles/app.css:1) เริ่มด้วย `:root` design tokens:

- brand/navy, neutral surfaces/text/borders, status/priority colors, notice backgrounds
- font stacks `Kanit`/`IBM Plex Sans Thai`
- 8-point spacing scale, radii, focus ring

Rules ต่อจาก tokens เรียงโดย UI concerns:

1. global box-sizing, body, headings, links, `:focus-visible`, visually-hidden, skip-link
2. app shell/sidebar/avatar
3. page layouts, panels, toolbar
4. forms and buttons
5. tables/status/priority
6. dashboard cards/breakdown and status track
7. detail/history/notices/empty/actions/repair steps
8. login screen and small-screen breakpoints
9. short transition/animation rules, skeleton shimmer, `prefers-reduced-motion`
10. collapsed sidebar and three-column Messages/conversation/chat layout, with mobile behavior

Component class names in TSX map directly to CSS blocks (เช่น `status--open`, `panel`, `track`, `msgs`, `mx`, `composer`). Changing tokens is intended to update many pages consistently. CSS uses modern features including `:has`, `color-mix`, `100dvh`; older browser support should be checked if target environment changes

## 8. Execution examples

### Guest edits profile

Guest types a new name and optional email → `Profile.save()` trims values → `IdentityProvider.updateProfile()` → shared client PUT `/me` with identity headers → success refreshes provider/local storage state → Profile shows “Saved”. Built-in demo user skips the form and sees a read-only notice

### Ticket status presentation

Backend returns `status='assigned'` from a legacy row → client `fix()` normalizes to `in_progress` → `StatusBadge` reads `STATUS_LABEL.in_progress`; `StatusTrack` uses `stageOf`/`STATUS_ORDER` to highlight second step. Closed status presents as final resolved step while its badge still uses Closed label

### Admin repair form default

`TicketDetail.AdminActions` initializes `repairCategory` by calling `guessRepairCategory(title + description)` → first matching hint selects a category → admin can change select before `api.sendWorkOrder`; this local guess does not itself save or send the work order

## 9. Important caveats

1. **Client-side length limits are not server validation:** Profile and repair pages also call APIs whose backend validates.
2. **Error rendering is type-aware:** preserving `ApiError`/`NotReadyError` types matters for validation fields and 501 messaging.
3. **Status compatibility spans layers:** `normalizeStatus`, API `fix`, `stageOf`, backend enums, and database CHECK must stay aligned.
4. **Formatting depends on time zone:** UTC parsing plus local day grouping should be tested for the intended deployment audience/timezone.
5. **Repair category heuristic is approximate:** substring matching and order determine default; it is not a classifier and user/admin remains in control.
6. **Accessibility relies on callers too:** `Icon` is hidden from assistive tech; interactive parents need labels, while `Field` callers must connect invalid/error hints as required.
7. **CSS and component class contracts are coupled:** renaming a class in JSX without CSS counterpart changes layout/visual states.
8. **Reduced-motion support exists:** animation rules are disabled under `prefers-reduced-motion`.

## 10. Scope still pending

This slice covers the remaining shared UI/profile/format/repair/styles files reviewed here. Other frontend pages already documented in earlier modules; operational CI/deployment/scripts and any files discovered later remain pending in [`DOCUMENTATION_PROGRESS.md`](../../DOCUMENTATION_PROGRESS.md)
