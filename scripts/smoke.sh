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
check "config"                     200 "$(code "$BASE/config")"
check "no auth → 401"              401 "$(code "$BASE/tickets/me")"
check "invalid JSON → 400"         400 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{bad')"
check "missing fields → 422"       422 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{}')"
check "create: no location → 422" 422 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{"subject":"Air conditioner in B-204 not working","description":"The room is very hot since this morning","category_id":5,"urgency":"high"}')"
check "create ticket → 201"        201 "$(code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{"subject":"Air conditioner in B-204 not working","description":"The room is very hot since this morning","location":"Building B, Room B-204","category_id":5,"urgency":"high"}')"
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
check "chat: both sides see 2"     2 "$(curl -s "$BASE/tickets/$ID/comments" "${ALICE[@]}" | python3 -c 'import sys,json;print(sum(1 for m in json.load(sys.stdin)["data"] if m["author_role"]!="system"))')"
echo "--- guest sign-in (Identity stub) + PDPA consent ---"
PV="1.0" # PRIVACY_NOTICE_VERSION (backend/src/core/privacy.ts)
check "guest: no consent → 422"    422 "$(code -X POST "$BASE/auth/guest" "${J[@]}" -d '{"name":"No Consent"}')"
check "guest: old notice → 422"    422 "$(code -X POST "$BASE/auth/guest" "${J[@]}" -d '{"name":"Old Notice","privacy_notice_version":"0.1"}')"
GUEST=$(curl -s -X POST "$BASE/auth/guest" "${J[@]}" -d "{\"name\":\"Smoke Guest\",\"privacy_notice_version\":\"$PV\"}")
GID=$(echo "$GUEST" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
GH=(-H "x-user-id: $GID" -H "x-user-role: customer")
check "guest: bad name → 422"      422 "$(code -X POST "$BASE/auth/guest" "${J[@]}" -d "{\"name\":\"x\",\"privacy_notice_version\":\"$PV\"}")"
check "guest: /me"                 200 "$(code "$BASE/me" "${GH[@]}")"
check "consent: no auth → 401"     401 "$(code "$BASE/me/consent")"
check "consent: given at sign-up"  True "$(curl -s "$BASE/me/consent" "${GH[@]}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accepted"])')"
check "consent: withdraw → 200"    200 "$(code -X DELETE "$BASE/me/consent" "${GH[@]}")"
check "consent: now withdrawn"     False "$(curl -s "$BASE/me/consent" "${GH[@]}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accepted"])')"
check "consent: accept again → 201" 201 "$(code -X POST "$BASE/me/consent" "${GH[@]}" "${J[@]}" -d "{\"notice_version\":\"$PV\"}")"
check "consent: accept twice → 200" 200 "$(code -X POST "$BASE/me/consent" "${GH[@]}" "${J[@]}" -d "{\"notice_version\":\"$PV\"}")"
check "guest: not admin"           403 "$(code "$BASE/admin/stats" "${GH[@]}")"
check "guest: cannot see Alice's ticket" 403 "$(code "$BASE/tickets/$ID" "${GH[@]}")"
check "guest: forged admin role → 403" 403 "$(code "$BASE/tickets" -H "x-user-id: $GID" -H "x-user-role: admin")"
echo "--- Team 10: link a work order + receive its webhook (local run: WO-MOCK-* ids, secret from .dev.vars) ---"
SECRET="${MAINTENANCE_WEBHOOK_SECRET:-dev-secret}"
hook() { # $1 = JSON body, $2 = optional signature override → HTTP code
  local ts sig; ts=$(date +%s)
  sig=${2:-$(printf '%s.%s' "$ts" "$1" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')}
  code -X POST "$BASE/webhooks/maintenance" "${J[@]}" -H "X-Timestamp: $ts" -H "X-Signature: $sig" -d "$1"
}
evt() { printf '{"eventId":"%s","type":"maintenance.status_changed","data":{"workOrderId":"%s","status":"%s"}}' "$1" "$2" "$3"; }
tstate() { curl -s "$BASE/tickets/$ID2" "${ADMIN[@]}" | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print(d["status"]+"/"+str(d["maintenance_status"]))'; }
RUN=$RANDOM; WO="WO-MOCK-$RUN"
code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{"subject":"Projector in B-110 has no signal","description":"Screen stays blue since this morning","location":"Building B, Room B-110","category_id":5,"urgency":"high"}' >/dev/null
ID2=$(python3 -c 'import json;print(json.load(open("/tmp/smoke_body"))["data"]["id"])'); NUM2=$(python3 -c 'import json;print(json.load(open("/tmp/smoke_body"))["data"]["ticket_number"])')
check "link: requester → 403"            403 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ALICE[@]}" "${J[@]}" -d "{\"work_order_id\":\"$WO\"}")"
check "link: our own TKT number → 400"   400 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d "{\"work_order_id\":\"$NUM2\"}")"
check "link: before 'start' → 409"       409 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d "{\"work_order_id\":\"$WO\"}")"
check "admin starts the work → 200"      200 "$(code -X PATCH "$BASE/tickets/$ID2" "${ADMIN[@]}" "${J[@]}" -d '{"status":"in_progress"}')"
check "link: Team 10 unreachable → 503"  503 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{"work_order_id":"WO-REAL-1"}')"
check "link: work order → 200"           200 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d "{\"work_order_id\":\"$WO\"}")"
check "link: a second one → 409"         409 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d "{\"work_order_id\":\"WO-MOCK-$RUN-2\"}")"
check "webhook: no signature → 401"     401 "$(code -X POST "$BASE/webhooks/maintenance" "${J[@]}" -d "$(evt "e-$RUN-0" "$WO" in_progress)")"
check "webhook: bad signature → 401"     401 "$(hook "$(evt "e-$RUN-0" "$WO" in_progress)" deadbeef)"
check "webhook: in_progress → 200"       200 "$(hook "$(evt "e-$RUN-1" "$WO" in_progress)")"
check "  ticket is in_progress"          "in_progress/in_progress" "$(tstate)"
check "webhook: same event again → 200"  200 "$(hook "$(evt "e-$RUN-1" "$WO" in_progress)")"
check "webhook: completed → 200"         200 "$(hook "$(evt "e-$RUN-2" "$WO" completed)")"
check "  status kept, repair is done"    "in_progress/completed" "$(tstate)"
check "webhook: unknown work order → 202" 202 "$(hook "$(evt "e-$RUN-3" "WO-MOCK-none-$RUN" in_progress)")"
check "webhook: unknown status → 400"    400 "$(hook "$(evt "e-$RUN-4" "$WO" teleported)")"
check "webhook: not JSON → 400"          400 "$(hook 'not json')"
check "webhook: cancelled → 200"         200 "$(hook "$(evt "e-$RUN-5" "$WO" cancelled)")"
check "link: new one after cancel → 200" 200 "$(code -X POST "$BASE/tickets/$ID2/link-maintenance" "${ADMIN[@]}" "${J[@]}" -d "{\"work_order_id\":\"WO-MOCK-$RUN-2\"}")"
echo "--- Team 10: send the repair from Helpdesk (main way; local run answers a WO-MOCK-<uuid>) ---"
code -X POST "$BASE/tickets" "${ALICE[@]}" "${J[@]}" -d '{"subject":"Light in B-301 keeps flickering","description":"The ceiling light flickers all day","location":"Building B, Room B-301","category_id":5,"urgency":"medium"}' >/dev/null
ID3=$(python3 -c 'import json;print(json.load(open("/tmp/smoke_body"))["data"]["id"])')
check "send: requester → 403"            403 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ALICE[@]}" "${J[@]}" -d '{}')"
check "send: before 'start' → 409"       409 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{}')"
check "admin starts the work → 200"      200 "$(code -X PATCH "$BASE/tickets/$ID3" "${ADMIN[@]}" "${J[@]}" -d '{"status":"in_progress"}')"
check "send: empty title → 400"          400 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{"title":" "}')"
check "send: empty location → 400"      400 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{"category":"Electrical","location":" "}')"
check "send: unknown category → 400"     400 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{"location":"Building B, Room B-301","category":"Facility"}')"
check "send: repair → 200"               200 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{"title":"Flickering light B-301","description":"Ceiling light flickers all day","location":"Building B, Room B-301","category":"Electrical"}')"
WO3=$(python3 -c 'import json;print(json.load(open("/tmp/smoke_body"))["maintenance_work_order_id"])')
check "  the Team 10 category is kept"    "Electrical" "$(curl -s "$BASE/tickets/$ID3" "${ADMIN[@]}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["maintenance_category"])')"
echo "      work order $WO3"
check "send: again → 409"                409 "$(code -X POST "$BASE/tickets/$ID3/send-maintenance" "${ADMIN[@]}" "${J[@]}" -d '{}')"
check "send: webhook for it → 200"       200 "$(hook "$(evt "e-$RUN-6" "$WO3" in_progress)")"
check "  sent ticket is in_progress"     "in_progress/in_progress" "$(curl -s "$BASE/tickets/$ID3" "${ADMIN[@]}" | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print(d["status"]+"/"+str(d["maintenance_status"]))')"
echo "--- automatic chat messages (role 'system', seen by the requester) ---"
sysmsgs() { curl -s "$BASE/tickets/$ID3/comments" "${ALICE[@]}" | python3 -c 'import sys,json;print(sum(1 for m in json.load(sys.stdin)["data"] if m["author_role"]=="system"))'; }
check "chat: start + sent + repair started"  3 "$(sysmsgs)"
hook "$(evt "e-$RUN-6" "$WO3" in_progress)" >/dev/null
check "chat: same event again adds nothing"   3 "$(sysmsgs)"
hook "$(evt "e-$RUN-7" "$WO3" completed)" >/dev/null
check "chat: repair done → +1"               4 "$(sysmsgs)"
code -X POST "$BASE/tickets/$ID3/resolve" "${ADMIN[@]}" "${J[@]}" -d '{"resolution_note":"Light replaced"}' >/dev/null
check "chat: resolved with the summary"      "Ticket resolved. Summary: Light replaced" "$(curl -s "$BASE/tickets/$ID3/comments" "${ALICE[@]}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"][-1]["content"])')"
hook "$(evt "e-$RUN-8" "$WO3" closed)" >/dev/null
check "chat: nothing after the ticket is resolved" 5 "$(sysmsgs)"
check "AI suggest: empty body → 422" 422 "$(code -X POST "$BASE/tickets/suggest" "${ALICE[@]}" "${J[@]}" -d '{}')"
# Wellbeing (Team 16, contract 2.0): our proxy answers 200 even when Team 16 is down (available:false), never blocks
check "wellbeing: catalogue proxy → 200"   200 "$(code "$BASE/wellbeing/services")"
check "wellbeing: no 1.2 fields"           ok "$(python3 -c 'import json;d=json.load(open("/tmp/smoke_body"));s=d["services"];print("ok" if isinstance(s,list) and all("slug" not in x and "whatFor" not in x for x in s) and all(x["id"].startswith("srv_") for x in s) else "bad")')"
check "wellbeing: suggestion → 200"        200 "$(code "$BASE/tickets/$ID/wellbeing-suggestion" "${ALICE[@]}")"
check "wellbeing: other requester → 403"   403 "$(code "$BASE/tickets/$ID/wellbeing-suggestion" "${BOB[@]}")"
check "wellbeing: bad service id → 400"    400 "$(code -X PATCH "$BASE/tickets/$ID" "${ADMIN[@]}" "${J[@]}" -d '{"wellbeing_service_id":"counselling"}')"
check "admin stats (P4)"           501 "$(code "$BASE/admin/stats" "${ADMIN[@]}")"
echo "=== $pass passed, $fail failed ==="
[ "$fail" -eq 0 ]
