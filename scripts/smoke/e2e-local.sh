#!/usr/bin/env bash
# Simple local smoke for intent + settlement services.
# This script intentionally avoids business logic changes and only calls public/internal HTTP endpoints.

set -euo pipefail

INTENT_BASE_URL="${INTENT_BASE_URL:-http://localhost:3001/v1}"
SETTLEMENT_BASE_URL="${SETTLEMENT_BASE_URL:-http://localhost:3003/v1}"

INTENT_CONFIRM_PATH="${INTENT_CONFIRM_PATH:-}"
SETTLEMENT_TRIGGER_PATH="${SETTLEMENT_TRIGGER_PATH:-}"

echo "🔎 Creating payment intent..."
PAYLOAD='{
  "orderId": "smoke-test-order-1",
  "amount": "1000",
  "originalAmount": "1000",
  "provider": "FLUTTERWAVE",
  "currency": "NGN",
  "metadata": {"smoke": true}
}'

CREATE_RESPONSE="$(curl -sS -w \"\\n%{http_code}\" -X POST \"${INTENT_BASE_URL}/intents/payments\" \\
  -H 'Content-Type: application/json' \\
  -d \"${PAYLOAD}\")"
CREATE_BODY="$(echo \"${CREATE_RESPONSE}\" | head -n1)"
CREATE_STATUS="$(echo \"${CREATE_RESPONSE}\" | tail -n1)"

if [[ \"${CREATE_STATUS}\" != \"201\" && \"${CREATE_STATUS}\" != \"200\" ]]; then
  echo \"❌ Failed to create payment intent (status ${CREATE_STATUS}). Response:\"
  echo \"${CREATE_BODY}\"
  exit 1
fi

INTENT_ID="$(node -e \"const data=JSON.parse(process.argv[1]); console.log(data.id || '');\" \"${CREATE_BODY}\")"

if [[ -z \"${INTENT_ID}\" ]]; then
  echo \"❌ Could not extract intent id from response:\"
  echo \"${CREATE_BODY}\"
  exit 1
fi

echo \"✅ Created intent ${INTENT_ID}\"

if [[ -n \"${INTENT_CONFIRM_PATH}\" ]]; then
  CONFIRM_URL=\"${INTENT_BASE_URL}${INTENT_CONFIRM_PATH//\\{id\\}/${INTENT_ID}}\"
  echo \"🔄 Attempting to mark intent confirming via ${CONFIRM_URL}\"
  CONFIRM_STATUS=\"$(curl -sS -o /dev/null -w '%{http_code}' -X POST \"${CONFIRM_URL}\")\"
  if [[ \"${CONFIRM_STATUS}\" == \"200\" || \"${CONFIRM_STATUS}\" == \"204\" ]]; then
    echo \"✅ Intent marked CONFIRMING\"
  else
    echo \"⚠️ Confirm endpoint responded with ${CONFIRM_STATUS}; skipping status update\"
  fi
else
  echo \"ℹ️ No confirm endpoint configured; skipping intent status update\"
fi

if [[ -n \"${SETTLEMENT_TRIGGER_PATH}\" ]]; then
  SETTLE_URL=\"${SETTLEMENT_BASE_URL}${SETTLEMENT_TRIGGER_PATH//\\{id\\}/${INTENT_ID}}\"
  echo \"💸 Triggering settlement via ${SETTLE_URL}\"
  SETTLE_RESPONSE1=\"$(curl -sS -w \"\\n%{http_code}\" -X POST \"${SETTLE_URL}\")\"
  SETTLE_BODY1=\"$(echo \"${SETTLE_RESPONSE1}\" | head -n1)\"
  SETTLE_STATUS1=\"$(echo \"${SETTLE_RESPONSE1}\" | tail -n1)\"
  echo \"First settlement status: ${SETTLE_STATUS1}\"
  echo \"Response: ${SETTLE_BODY1}\"

  echo \"♻️ Re-triggering settlement to test idempotency...\"
  SETTLE_RESPONSE2=\"$(curl -sS -w \"\\n%{http_code}\" -X POST \"${SETTLE_URL}\")\"
  SETTLE_BODY2=\"$(echo \"${SETTLE_RESPONSE2}\" | head -n1)\"
  SETTLE_STATUS2=\"$(echo \"${SETTLE_RESPONSE2}\" | tail -n1)\"
  echo \"Second settlement status: ${SETTLE_STATUS2}\"
  echo \"Response: ${SETTLE_BODY2}\"
else
  echo \"ℹ️ No settlement trigger endpoint configured; skipping settlement steps\"
fi

echo \"🎉 Smoke run complete\"
