#!/usr/bin/env bash
# Quick end-to-end check against a running Worker (default: local `wrangler dev`).
#   bash scripts/smoke.sh                       # local
#   BASE=https://helpdesk-api.team-helpdesk.workers.dev bash scripts/smoke.sh
set -u
BASE="${BASE:-http://127.0.0.1:8787}/api/v1"
ALICE=(-H 'x-user-id: 1' -H 'x-user-role: customer')
BOB=(-H 'x-user-id: 2' -H 'x-user-role: customer')
AGENT=(-H 'x-user-id: 3' -H 'x-user-role: agent')
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
check "requester can't assign"     403 "$(code -X POST "$BASE/tickets/$ID/assign" "${ALICE[@]}" "${J[@]}" -d '{"agent_id":3}')"
check "agent queue"                200 "$(code "$BASE/tickets?sort=queue" "${AGENT[@]}")"
check "assign → 200"               200 "$(code -X POST "$BASE/tickets/$ID/assign" "${AGENT[@]}" "${J[@]}" -d '{"agent_id":3}')"
check "triage PATCH → 200"         200 "$(code -X PATCH "$BASE/tickets/$ID" "${AGENT[@]}" "${J[@]}" -d '{"priority":"urgent","status":"in_progress"}')"
check "bad category → 400"         400 "$(code -X PATCH "$BASE/tickets/$ID" "${AGENT[@]}" "${J[@]}" -d '{"category_id":999}')"
check "resolve → 200"              200 "$(code -X POST "$BASE/tickets/$ID/resolve" "${AGENT[@]}" "${J[@]}" -d '{"resolution_note":"Compressor replaced"}')"
check "resolve twice → 403"        403 "$(code -X POST "$BASE/tickets/$ID/resolve" "${AGENT[@]}" "${J[@]}" -d '{}')"
check "detail has history"         200 "$(code "$BASE/tickets/$ID" "${ALICE[@]}")"
python3 -c 'import json;h=json.load(open("/tmp/smoke_body"))["data"]["history"];print("      history:", " → ".join(x["to_status"] for x in h))'
check "legacy path still works"    200 "$(curl -s -o /dev/null -w '%{http_code}' "${BASE%/api/v1}/tickets/me" "${ALICE[@]}")"
echo "--- not built yet (expect 501 until teammates finish) ---"
check "chat: list"                 200 "$(code "$BASE/tickets/$ID/comments" "${ALICE[@]}")"
check "chat: requester posts"      201 "$(code -X POST "$BASE/tickets/$ID/comments" "${ALICE[@]}" "${J[@]}" -d '{"content":"smoke: still broken"}')"
check "chat: requester internal"   403 "$(code -X POST "$BASE/tickets/$ID/comments" "${ALICE[@]}" "${J[@]}" -d '{"content":"x","visibility":"internal"}')"
check "chat: agent internal note"  201 "$(code -X POST "$BASE/tickets/$ID/comments" "${AGENT[@]}" "${J[@]}" -d '{"content":"smoke: internal","visibility":"internal"}')"
check "chat: other requester"      403 "$(code "$BASE/tickets/$ID/comments" "${BOB[@]}")"
check "chat: requester sees no internal" 0 "$(curl -s "$BASE/tickets/$ID/comments" "${ALICE[@]}" | grep -c '"internal"')"
check "link work order (P3)"       501 "$(code -X POST "$BASE/tickets/$ID/link-maintenance" "${AGENT[@]}" "${J[@]}" -d '{"work_order_id":"WO-1"}')"
check "webhook (P3)"               501 "$(code -X POST "$BASE/webhooks/maintenance" "${J[@]}" -d '{}')"
check "AI suggest (P4)"            501 "$(code -X POST "$BASE/tickets/suggest" "${ALICE[@]}" "${J[@]}" -d '{}')"
check "admin stats (P4)"           501 "$(code "$BASE/admin/stats" -H 'x-user-id: 5' -H 'x-user-role: admin')"
echo "=== $pass passed, $fail failed ==="
[ "$fail" -eq 0 ]
