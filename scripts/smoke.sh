#!/usr/bin/env bash
# Quick end-to-end check against a running Worker (default: local `wrangler dev`).
#   bash scripts/smoke.sh                       # local
#   BASE=https://helpdesk-api.team-helpdesk.workers.dev bash scripts/smoke.sh
set -u
BASE="${BASE:-http://127.0.0.1:8787}/api/v1"
ALICE=(-H 'x-user-id: 1' -H 'x-user-role: customer')
BOB=(-H 'x-user-id: 2' -H 'x-user-role: customer')
ADMIN=(-H 'x-user-id: 5' -H 'x-user-role: admin')   # two roles only: customer + admin
J=(-H 'Content-Type: application/json')
pass=0; fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; pass=$((pass+1)); else echo "FAIL  $1 expected $2 got $3"; fail=$((fail+1)); fi
}
code() { curl -s -o /tmp/smoke_body -w '%{http_code}' "$@"; }

check "health"                     200 "$(code "$BASE/health")"
check "no auth → 401"              401 "$(code "$BASE/tickets/me")"
check "invalid JSON → 400"         400 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{bad')"
check "missing fields → 422"       422 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{}')"
check "create ticket → 201"        201 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{"subject":"Air conditioner in B-204 not working","description":"The room is very hot since this morning","category_id":5,"urgency":"high"}')"
ID=$(python3 -c 'import json;print(json.load(open("/tmp/smoke_body"))["data"]["id"])')
NUM=$(python3 -c 'import json;print(json.load(open("/tmp/smoke_body"))["data"]["ticket_number"])')
echo "      created $NUM (id $ID)"
check "my tickets"                 200 "$(code "$BASE/tickets/me" "${ALICE[@]}")"
check "other requester → 403"      403 "$(code "$BASE/tickets/$ID" "${BOB[@]}")"
check "requester can't resolve"    403 "$(code -X POST "$BASE/tickets/$ID/resolve" "${ALICE[@]}" "${J[@]}" -d '{}')"
check "old agent role → 403"       403 "$(code "$BASE/tickets?sort=queue" -H 'x-user-id: 3' -H 'x-user-role: agent')"
check "assign removed → 404"       404 "$(code -X POST "$BASE/tickets/$ID/assign" "${ADMIN[@]}" "${J[@]}" -d '{}')"
check "admin dashboard list"       200 "$(code "$BASE/tickets?sort=queue" "${ADMIN[@]}")"
check "triage PATCH → 200"         200 "$(code -X PATCH "$BASE/tickets/$ID" "${ADMIN[@]}" "${J[@]}" -d '{"priority":"urgent","status":"in_progress"}')"
check "bad category → 400"         400 "$(code -X PATCH "$BASE/tickets/$ID" "${ADMIN[@]}" "${J[@]}" -d '{"category_id":999}')"
check "resolve → 200"              200 "$(code -X POST "$BASE/tickets/$ID/resolve" "${ADMIN[@]}" "${J[@]}" -d '{"resolution_note":"Compressor replaced"}')"
check "resolve twice → 403"        403 "$(code -X POST "$BASE/tickets/$ID/resolve" "${ADMIN[@]}" "${J[@]}" -d '{}')"
check "detail has history"         200 "$(code "$BASE/tickets/$ID" "${ALICE[@]}")"
python3 -c 'import json;h=json.load(open("/tmp/smoke_body"))["data"]["history"];print("      history:", " → ".join(x["to_status"] for x in h))'
check "legacy path still works"    200 "$(curl -s -o /dev/null -w '%{http_code}' "${BASE%/api/v1}/tickets/me" "${ALICE[@]}")"
echo "--- not built yet (expect 501 until teammates finish) ---"
check "chat: list"                 200 "$(code "$BASE/tickets/$ID/comments" "${ALICE[@]}")"
check "chat: requester posts"      201 "$(code -X POST "$BASE/tickets/$ID/comments" "${ALICE[@]}" "${J[@]}" -d '{"content":"smoke: still broken"}')"
check "chat: admin replies"        201 "$(code -X POST "$BASE/tickets/$ID/comments" "${ADMIN[@]}" "${J[@]}" -d '{"content":"smoke: checking now"}')"
check "chat: empty message → 400"  400 "$(code -X POST "$BASE/tickets/$ID/comments" "${ALICE[@]}" "${J[@]}" -d '{"content":"   "}')"
check "chat: other requester"      403 "$(code "$BASE/tickets/$ID/comments" "${BOB[@]}")"
check "chat: both sides see 2"     2 "$(curl -s "$BASE/tickets/$ID/comments" "${ALICE[@]}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["count"])')"
echo "--- guest sign-in (Identity stub) ---"
GUEST=$(curl -s -X POST "$BASE/auth/guest" "${J[@]}" -d '{"name":"Smoke Guest"}')
GID=$(echo "$GUEST" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
GH=(-H "x-user-id: $GID" -H "x-user-role: customer")
check "guest: bad name → 422"      422 "$(code -X POST "$BASE/auth/guest" "${J[@]}" -d '{"name":"x"}')"
check "guest: /me"                 200 "$(code "$BASE/me" "${GH[@]}")"
check "guest: not admin"           403 "$(code "$BASE/admin/stats" "${GH[@]}")"
check "guest: cannot see Alice's ticket" 403 "$(code "$BASE/tickets/$ID" "${GH[@]}")"
check "guest: forged admin role → 403" 403 "$(code "$BASE/tickets" -H "x-user-id: $GID" -H "x-user-role: admin")"
check "link work order (P3)"       501 "$(code -X POST "$BASE/tickets/$ID/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{"work_order_id":"WO-1"}')"
check "webhook (P3)"               501 "$(code -X POST "$BASE/webhooks/maintenance" "${J[@]}" -d '{}')"
check "AI suggest (P4)"            501 "$(code -X POST "$BASE/tickets/suggest" "${ALICE[@]}" "${J[@]}" -d '{}')"
check "admin stats (P4)"           501 "$(code "$BASE/admin/stats" "${ADMIN[@]}")"
echo "=== $pass passed, $fail failed ==="
[ "$fail" -eq 0 ]
