#!/bin/bash
# station-review.sh — TL #2 integration-station gate runner (Phase 3 checklist §1).
#
# Usage: bash scripts/station-review.sh <pr-branch> [<pr-number>]
#
# Runs the PR review gate at the TL integration station:
#   1. scope compliance (worker path ownership, AGENTS.md drift controls)
#   2. gates: typecheck (0 errors), lint (clean), test (all pass + count)
#   3. prints a review verdict block ready to paste into the merge decision
#
# Determinism proofs + evidence-label review remain TL judgment calls (not
# automatable); this script only removes the mechanical fumbling under
# deadline pressure.

set -uo pipefail

BRANCH="${1:?usage: station-review.sh <pr-branch> [<pr-number>]}"
PR="${2:-?}"
cd "$(dirname "$0")/.." || exit 9

echo "=== station review: ${BRANCH} (PR ${PR}) @ $(date -u +%H:%M:%S) UTC ==="

git fetch origin || exit 9
git checkout main -q || exit 9
git pull -q origin main || exit 9
BASE="$(git rev-parse --short HEAD)"
echo "baseline main: ${BASE}"

if ! git checkout -q "${BRANCH}" 2>/dev/null; then
  git checkout -q -b "${BRANCH}" "origin/${BRANCH}" || { echo "VERDICT: FAIL (branch not found: ${BRANCH})"; exit 1; }
fi
git pull -q "origin/${BRANCH}" 2>/dev/null || true
HEAD="$(git rev-parse --short HEAD)"
echo "review head:   ${HEAD} ($(git log -1 --format=%s | head -c 80))"

echo; echo "--- scope compliance (owned-path diff vs main) ---"
CHANGED=$(git diff --name-only "main...${BRANCH}")
echo "${CHANGED}" | sed 's/^/  /'
VIOLATIONS=$(echo "${CHANGED}" | grep -Ev '^(src/audio/|src/providers/audio/|src/video/|src/providers/visual/|src/providers/video/|src/compositor/|tests/audio/|tests/video/|tests/integration/|src/source/|src/director/|src/contracts/|tests/source/|tests/director/|tests/contracts/|tools/|docs/|artifacts/|fixtures/|reference/|experiments/|package\.json|tsconfig\.json|eslint\.config\.js|bun\.lock|scripts/|AGENTS\.md|README\.md|\.git.*|.*\.md$)' || true)
# contracts changes are allowed for TL-owned waves but NOT for worker PRs without HANDOFF entries:
CONTRACT_CHANGES=$(echo "${CHANGED}" | grep -E '^src/contracts/' || true)
if [ -n "${VIOLATIONS}" ]; then
  echo "SCOPE: VIOLATION — out-of-ownership paths:"; echo "${VIOLATIONS}" | sed 's/^/  !! /'
else
  echo "SCOPE: OK (all changed paths inside worker/TL ownership sets)"
fi
if [ -n "${CONTRACT_CHANGES}" ]; then
  echo "SCOPE: src/contracts/ changed — requires HANDOFF adjudication (worker PRs):"; echo "${CONTRACT_CHANGES}" | sed 's/^/  !! /'
fi

echo; echo "--- gates ---"
FAIL=0
bun run typecheck || FAIL=1
bun run lint || FAIL=1
if bun test 2>&1 | tail -5 | tee /tmp/station-test-tail.txt; then
  TESTS=$(grep -oE '[0-9]+ pass' /tmp/station-test-tail.txt | head -1 || echo "0 pass")
  echo "test summary: ${TESTS}"
else
  FAIL=1
fi

echo; echo "--- verdict ---"
if [ "${FAIL}" = "0" ] && [ -z "${VIOLATIONS}" ]; then
  echo "VERDICT: GATES GREEN — proceed to determinism proof + evidence-label review + merge decision (base ${BASE}, head ${HEAD})"
  exit 0
else
  echo "VERDICT: REQUIRE-CHANGES (see above; base ${BASE}, head ${HEAD})"
  exit 1
fi
