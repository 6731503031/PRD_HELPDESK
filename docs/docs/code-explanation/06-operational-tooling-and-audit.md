# Operational Tooling & Final Completeness Audit

เอกสารนี้รวบรวมคำสั่งพัฒนา/build/test/database, CI, Worker deployment settings, helper scripts และสถานะ final audit ตามไฟล์ที่ตรวจจริง. มันยังไม่ใช่การอธิบาย requirement documents ทุกฉบับ และไม่ควรใช้แทนการตรวจ live deployment/database

## 1. Root package scripts

คำสั่งที่อ่านจาก [`package.json`](../../package.json:7):

| Script | Behavior | Caution / dependency |
|---|---|---|
| `dev` | build frontend แล้ว `wrangler dev` | สร้าง/เขียน `public/` build output ที่ `.gitignore` ระบุว่าไม่ commit |
| `dev:web` | Vite dev server สำหรับ frontend | port 5173; proxy `/api` ไป Wrangler dev ที่ 8787 ตาม Vite config |
| `build:web` | Vite build frontend เข้า `public/` | `emptyOutDir: true` ล้าง output directory ก่อน build |
| `deploy` | build แล้ว `wrangler deploy` พร้อม production vars บางตัว | ไม่ได้รันในงานนี้; deploy เป็น side effect ภายนอกและต้องอนุมัติก่อน |
| `typecheck` | `tsc --noEmit -p backend && tsc --noEmit -p frontend` | ตรวจ backend แล้ว frontend; ทั้งสองผ่านในการ run ล่าสุด |
| `test` / `test:watch` | Vitest run / watch | `vitest.config.ts` จำกัด tests ไว้ที่ `backend/test/**/*.test.ts`, node environment |
| `db:local:fresh` | execute full `database/schema.sql` กับ local D1 | คำว่า fresh เป็น intended first setup; SQL ใช้ `IF NOT EXISTS` ไม่ใช่คำสั่ง DROP/reset |
| `db:local:migrate`, `db:remote:migrate` | execute migration `0002_final_features.sql` | precondition: existing Assignment 2 DB มี migration 0001 แล้ว; alter statements ไม่ควรรันซ้ำ |
| `db:local:update`, `db:remote:update` | run 0003 แล้ว 0004 | 0004 ลบ `visibility='internal'`; remote run เป็น destructive และมี explicit approval requirement |
| `mock:maintenance` | run Node webhook simulator | ต้องตั้ง webhook secret ให้ตรงกับ Worker; อย่าใส่/แสดง secret value ใน docs/logs |
| `wt:new/open/list/rm` | delegate to `bash scripts/worktree.sh ...` | ต้องมี bash/Git support; script create/remove git worktrees และอาจคัดลอก `.dev.vars` |

Migration semantics/risk อธิบายละเอียดใน [`01-schema-and-migrations.md`](08-file-explanations/database/01-schema-and-migrations.md)

## 2. CI workflow

[`ci.yml`](../../.github/workflows/ci.yml) run บนทุก pull request และ push เข้า `main`:

1. Ubuntu latest runner.
2. Checkout ด้วย `actions/checkout@v4`.
3. Setup Node 20 ด้วย npm cache.
4. `npm ci`.
5. `npm run typecheck`.
6. `npm test`.

CI workflow ไม่ build/deploy frontend/Worker ตาม YAML ที่ตรวจ และไม่มี browser/E2E test stage

## 3. Vite, Wrangler, and generated output

- [`frontend/vite.config.ts`](../../frontend/vite.config.ts) uses React plugin, frontend root, output `../public`, Vite port 5173, and local `/api` proxy to `127.0.0.1:8787`.
- [`wrangler.toml`](../../wrangler.toml) names Worker entry `backend/src/index.ts`; binds static asset directory `./public`, Workers AI `AI`, D1 `DB`, cron trigger, environment vars, and secret *names* in comments.
- [`frontend/index.html`](../../frontend/index.html) loads `/src/main.tsx` at dev/build-time and has the React root element.
- `.gitignore` excludes `public/`, `dist/`, `build/`, `.wrangler/`, dependencies and local secret files; no `node_modules`/generated output appeared in the workspace inventory at initial audit.

`npm run deploy` includes production values for `ENVIRONMENT`, Maintenance API URL and portal URL in its command line. It was not executed; no deployment result is claimed

## 4. Helper scripts

### Smoke test

[`scripts/smoke.sh`](../../scripts/smoke.sh:1) is a Bash script for a running Worker, default local `http://127.0.0.1:8787/api/v1`; `BASE` can be overridden. It uses `curl`, `python3`, and for simulated webhook HMAC `openssl`. It tests status codes for health/config/auth/create/ticket visibility/edit/resolve/comments/guest auth, Maintenance link/webhook, AI validation, and the 501 admin stats stub.

**It mutates data:** creates tickets, guest profiles, comments and mocked work-order state; it does not clean those rows at the end. An overridden remote `BASE` could mutate production data. It was inspected but not executed

### Worktree helper

[`scripts/worktree.sh`](../../scripts/worktree.sh:1) dispatches `new`, `open`, `list`, `rm`:

- locates main checkout from `git worktree list --porcelain`.
- creates branch worktree beside repo in `<main>.worktrees/` or detached review worktree.
- `setup()` runs `npm ci` and local D1 schema setup in the new worktree.
- if main checkout has `.dev.vars`, it copies that file to the worktree; otherwise copies `dev.vars.example` to `.dev.vars`.
- remove command removes worktree and prunes git metadata; it keeps branch.

Script was not run; no `.dev.vars` content was read/copied by this audit. Worktree cleanup/creation changes filesystem/git state and is not part of documentation verification

### Mock Maintenance webhook

[`scripts/send-mock-maintenance-event.mjs`](../../scripts/send-mock-maintenance-event.mjs) produces a JSON `maintenance.status_changed` event, signs `${timestamp}.${rawBody}` using Node HMAC-SHA256, and posts to the local Worker by default. Flags allow URL, fixed event id for dedupe testing, correlation id, and deliberately bad signature. It requires an environment secret value at runtime; only the variable name/behavior is documented here

## 5. Legacy Postman collection audit

[`backend/postman_collection.json`](../../backend/postman_collection.json) is named for Assignment 2 and uses legacy unprefixed paths (which remain supported), but parts are stale relative to current source:

- It uses `agent_id=3`, `x-user-role: agent`, agent assignment fields/routes; current roles are `customer`/`admin` and agent/assignment support was removed.
- Its “GET / (health)” entry names the root service-info route as health; actual health check route is `/health` (also `/api/v1/health`).
- It expects missing create fields to return 400; current create validation returns 422.
- It contains `/assign` as an expected request even though current route inventory has no assign route.
- It uses `status: assigned` in a PUT sample; current API rules do not allow writing that status (DB still accepts it only for legacy data).

Treat it as historical CRUD/compatibility material; prefer the live route/source contracts and [`scripts/smoke.sh`](../../scripts/smoke.sh) for current behavior, while noting the smoke script itself mutates data

## 6. Final file inventory status

Based on the recursive workspace listing and direct source review so far:

- **Application source files:** backend `src/` and frontend `src/` files in the initial inventory have been read and mapped to module docs or explicitly marked partial. `DOCUMENTATION_PROGRESS.md` lists status for each.
- **Tests:** all six `backend/test/*.test.ts` files were read; all six were exercised by full `npm test`. Result: 67 passed, 5 skipped, 0 failed. Exact skipped cases are in [`05-tests-and-coverage.md`](05-tests-and-coverage.md).
- **Database:** schema, four migration files, and destructive demo cleanup SQL were read; none executed, and no live D1 was queried.
- **Operational config:** package scripts, both TS configs, Vitest config, Vite config, Wrangler config, CI YAML, gitignore, smoke/worktree/mock scripts, and Postman collection were read; external service/deploy commands were not run.
- **Secrets:** [`.env`](../../.env) was not read. [`dev.vars.example`](../../dev.vars.example) was not opened to avoid printing secret-like placeholders/values. Worktree script's potential `.dev.vars` copy was documented from script source only.
- **Generated/binary:** no `node_modules` or build output appeared in initial file listing. DOCX integration/role files were deferred as binary context documents; lockfile is a generated dependency-resolution artifact, not source.
- **Existing prose context docs:** [`docs/PRD.md`](../PRD.md), [`docs/FEATURES.md`](../FEATURES.md), [`docs/TEAM_GUIDE.md`](../TEAM_GUIDE.md), and assignment guides under [`docs/assignments/`](../assignments/) were inventoried but not reconciled line-by-line against implementation. They are not used as proof of runtime behavior.

This is a source/config/test inventory snapshot, not a claim that every prose context document or every live service has been validated. New files discovered later must be added to the progress inventory

## 7. Outstanding work after this audit

1. Review existing PRD/feature/team/assignment documentation where it helps explain source discrepancies.
2. Complete any desired full-file frontend page/component deep dives beyond the slices already documented.
3. Perform final docs/source cross-check and keep any remaining partial files explicitly labeled.
4. Identify comment-worthy source locations only after documentation completion; source edits require separate explicit permission.
