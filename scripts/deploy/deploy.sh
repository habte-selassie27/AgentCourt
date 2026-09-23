#!/usr/bin/env bash
# Deploy both AgentCourt Intelligent Contracts and wire them together.
#
# Prerequisites:
#   - genlayer CLI on PATH and configured (genlayer account list)
#   - GEN tokens on the active account for the target network
#   - genvm-lint (optional but recommended)
#
# Usage:
#   ./scripts/deploy/deploy.sh
#
# On success the script prints the two addresses and the .env lines to paste.

set -euo pipefail
cd "$(dirname "$0")/../.."

MANAGER_SRC="intelligent-contracts/registry/resolution_manager.py"
CORE_SRC="intelligent-contracts/core/agentcourt_core.py"

echo "==> Lint (GENVM_VERSION=v0.3.0-rc7)"
GENVM_VERSION=v0.3.0-rc7 genvm-lint check "$MANAGER_SRC"
GENVM_VERSION=v0.3.0-rc7 genvm-lint check "$CORE_SRC"

echo "==> Deploy ResolutionManager"
MANAGER_OUT=$(genlayer deploy --contract "$MANAGER_SRC")
echo "$MANAGER_OUT"
MANAGER_ADDR=$(echo "$MANAGER_OUT" | grep -Eo '0x[0-9a-fA-F]{40}' | tail -1)
if [ -z "${MANAGER_ADDR:-}" ]; then
  echo "ERROR: could not parse ResolutionManager address from deploy output" >&2
  exit 1
fi
echo "ResolutionManager: $MANAGER_ADDR"

echo "==> Deploy AgentCourtCore (ctor arg: ResolutionManager)"
CORE_OUT=$(genlayer deploy --contract "$CORE_SRC" --args "$MANAGER_ADDR")
echo "$CORE_OUT"
CORE_ADDR=$(echo "$CORE_OUT" | grep -Eo '0x[0-9a-fA-F]{40}' | tail -1)
if [ -z "${CORE_ADDR:-}" ]; then
  echo "ERROR: could not parse AgentCourtCore address from deploy output" >&2
  exit 1
fi
echo "AgentCourtCore: $CORE_ADDR"

echo "==> Wire set_core on ResolutionManager"
genlayer write "$MANAGER_ADDR" set_core --args "$CORE_ADDR"

cat <<EOF

Deployed and wired.

  ResolutionManager: $MANAGER_ADDR
  AgentCourtCore:    $CORE_ADDR

Paste into .env (and Vercel project env vars), then rebuild:

  VITE_AGENTCOURT_CORE=$CORE_ADDR
  VITE_RESOLUTION_MANAGER=$MANAGER_ADDR
  AGENTCOURT_CORE=$CORE_ADDR
  RESOLUTION_MANAGER=$MANAGER_ADDR

Verify with: ./scripts/verification/verify.sh
EOF
