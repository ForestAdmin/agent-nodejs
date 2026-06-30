#!/usr/bin/env bash
#
# Manual QA automation for the Mode 1 refresh grant (PRD-665 / T5).
#
# Drives the full flow against a running BFF + Forest server and asserts each
# step: login -> token -> refresh (rotation) -> replay (reuse detection) ->
# new-token-also-dead, plus the unknown-token and missing-param error paths.
#
# Everything is automated except the browser login (PKCE + Forest credentials +
# self-signed cert), which is irreducibly interactive: the script prints the
# authorize URL, you log in, then paste the `code` from the callback URL back.
#
# Prereqs:
#   - BFF running (default http://localhost:3450), pointed at a Forest server.
#   - jq installed.
#
# Usage:
#   BFF_URL=http://localhost:3450 \
#   FOREST_URL=http://localhost:3001 \
#   REDIRECT_URI=http://localhost:4200/callback \
#   ./scripts/qa-refresh-e2e.sh
#
set -euo pipefail

BFF_URL="${BFF_URL:-http://localhost:3450}"
FOREST_URL="${FOREST_URL:-http://localhost:3001}"
REDIRECT_URI="${REDIRECT_URI:-http://localhost:4200/callback}"

pass=0
fail=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

# assert <label> <actual> <expected>
assert() {
  if [ "$2" = "$3" ]; then
    green "  PASS  $1 ($2)"
    pass=$((pass + 1))
  else
    red "  FAIL  $1 — got '$2', expected '$3'"
    fail=$((fail + 1))
  fi
}

post_token() {
  curl -s -o /tmp/qa-body.json -w '%{http_code}' \
    -X POST "$BFF_URL/oauth/token" -H 'Content-Type: application/json' -d "$1"
}

field() { jq -r "$1 // empty" /tmp/qa-body.json; }

echo "== 0. Health check =="
assert "BFF /health" "$(curl -s -o /dev/null -w '%{http_code}' "$BFF_URL/health")" "200"

echo "== 1. Register OAuth client =="
CLIENT_ID=$(curl -s -X POST "$FOREST_URL/oauth/register" -H 'Content-Type: application/json' \
  -d "{\"client_name\":\"qa-refresh-e2e\",\"redirect_uris\":[\"$REDIRECT_URI\"],\"token_endpoint_auth_method\":\"none\",\"grant_types\":[\"authorization_code\",\"refresh_token\"],\"response_types\":[\"code\"]}" \
  | jq -r '.client_id // empty')
[ -n "$CLIENT_ID" ] || { red "client registration failed"; exit 1; }
green "  client_id=$CLIENT_ID"

echo "== 2. PKCE + authorize URL (browser login) =="
VERIFIER=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
CHALLENGE=$(node -e "console.log(require('crypto').createHash('sha256').update('$VERIFIER').digest('base64url'))")
STATE=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))")
echo "  Open this URL, log in, then copy the 'code' query param from the callback:"
echo
echo "  $BFF_URL/oauth/authorize?client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&response_type=code&code_challenge=$CHALLENGE&code_challenge_method=S256&state=$STATE"
echo
printf "  Paste code here: "
read -r CODE
[ -n "$CODE" ] || { red "no code provided"; exit 1; }

echo "== 3. authorization_code -> first token pair =="
status=$(post_token "{\"grant_type\":\"authorization_code\",\"code\":\"$CODE\",\"client_id\":\"$CLIENT_ID\",\"code_verifier\":\"$VERIFIER\",\"redirect_uri\":\"$REDIRECT_URI\"}")
assert "token status" "$status" "200"
R1=$(field '.refresh_token')
A1=$(field '.access_token')
assert "token_type" "$(field '.token_type')" "Bearer"
[ -n "$R1" ] && green "  R1=${R1:0:12}… (len ${#R1})" || red "  no refresh_token"
# No SaaS token must leak in the body.
assert "no SaaS leak in token body" "$(grep -c 'SAAS\|saas_' /tmp/qa-body.json || true)" "0"

echo "== 4. refresh_token grant -> rotation =="
status=$(post_token "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$R1\"}")
assert "refresh status" "$status" "200"
R2=$(field '.refresh_token')
A2=$(field '.access_token')
[ "$R2" != "$R1" ] && green "  R2 != R1 (rotated)" || red "  R2 == R1 (NOT rotated)"
assert "refresh rotated (R2 != R1)" "$([ "$R2" != "$R1" ] && echo yes || echo no)" "yes"
assert "access rotated (A2 != A1)" "$([ "$A2" != "$A1" ] && echo yes || echo no)" "yes"
DECODED=$(node -e "const p=process.argv[1].split('.')[1];console.log(Buffer.from(p,'base64url').toString())" "$A2" 2>/dev/null || echo '{}')
assert "new JWT is bff_access" "$(echo "$DECODED" | jq -r '.type // empty')" "bff_access"
assert "no SaaS token in new JWT" "$(echo "$DECODED" | grep -c 'SAAS\|saas_' || true)" "0"

echo "== 5. replay R1 (rotated-out) -> reuse detection =="
status=$(post_token "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$R1\"}")
assert "replay status" "$status" "401"
assert "replay error" "$(field '.error')" "session_invalidated"

echo "== 6. R2 after reuse -> whole session dead =="
status=$(post_token "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$R2\"}")
assert "R2-after-replay status" "$status" "400"
assert "R2-after-replay error" "$(field '.error')" "invalid_grant"

echo "== 7. unknown refresh token -> invalid_grant =="
status=$(post_token '{"grant_type":"refresh_token","refresh_token":"never-issued-token"}')
assert "unknown status" "$status" "400"
assert "unknown error" "$(field '.error')" "invalid_grant"

echo "== 8. missing refresh_token -> invalid_request =="
status=$(post_token '{"grant_type":"refresh_token"}')
assert "missing status" "$status" "400"
assert "missing error" "$(field '.error')" "invalid_request"

echo
echo "================  $pass passed, $fail failed  ================"
[ "$fail" -eq 0 ]
