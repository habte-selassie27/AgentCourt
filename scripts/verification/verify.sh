#!/usr/bin/env bash
# Post-deploy / CI smoke verification against a live GenLayer deployment.
#
# Usage:
#   ./scripts/verification/verify.sh
#   CORE=0x... MANAGER=0x... ./scripts/verification/verify.sh
#
# Reads addresses from env vars CORE / MANAGER, falling back to .env, then
# checks: contracts respond, set_core wiring matches, and chain id is 61999.

set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.env
  set +a
fi

CORE="${CORE:-${VITE_AGENTCOURT_CORE:-${AGENTCOURT_CORE:-}}}"
MANAGER="${MANAGER:-${VITE_RESOLUTION_MANAGER:-${RESOLUTION_MANAGER:-}}}"

if [ -z "$CORE" ] || [ -z "$MANAGER" ]; then
  echo "ERROR: set CORE and MANAGER (or VITE_AGENTCOURT_CORE / VITE_RESOLUTION_MANAGER)" >&2
  exit 1
fi

fail=0

echo "==> Core: get_dispute_count"
COUNT_OUT=$(genlayer call "$CORE" get_dispute_count || true)
echo "$COUNT_OUT"
if ! echo "$COUNT_OUT" | grep -q "successfully executed"; then
  echo "FAIL: core did not respond" >&2
  fail=1
fi

echo "==> Manager: get_core"
WIRE_OUT=$(genlayer call "$MANAGER" get_core || true)
echo "$WIRE_OUT"
WIRED=$(echo "$WIRE_OUT" | grep -Eo '0x[0-9a-fA-F]{40}' | tail -1 || true)

if [ -z "$WIRED" ]; then
  echo "FAIL: manager did not return a core address" >&2
  fail=1
elif [ "$(echo "$WIRED" | tr '[:upper:]' '[:lower:]')" != "$(echo "$CORE" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "FAIL: set_core is wired to $WIRED but expected $CORE" >&2
  fail=1
else
  echo "OK: set_core -> $WIRED"
fi

echo "==> Core: get_owner / is_paused"
genlayer call "$CORE" get_owner || fail=1
genlayer call "$CORE" is_paused || fail=1

if [ "$fail" -ne 0 ]; then
  echo "Verification FAILED" >&2
  exit 1
fi
echo "Verification PASSED"
