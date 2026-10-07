#!/usr/bin/env bash
# V-9b — the release gate. Every automated tier, in order, stopping at the first red one. A release ships
# only when this exits 0 AND docs/release-checklist.md (T5, the manual scenarios) is filled in and signed.
#
#   scripts/release-gate.sh            everything that can run on this machine
#   KACOLA_AGENT_EVAL=1 ...          also the live headless-Claude agent eval (spends model calls)
#   ANTHROPIC_API_KEY=... ...          also the live Q&A eval
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

step "T0-T2 + boundaries + licences + lint + typecheck (pnpm check)";  pnpm run check
step "T3 e2e: PipeWire rig, real models, real daemon, installer, UI";    pnpm run test:e2e
step "mutation testing (protocol, invariants) — break threshold 80%";    pnpm run test:mutation
step "T4 evals (live LLM eval runs only with ANTHROPIC_API_KEY)";        pnpm run test:eval
if [ "${KACOLA_AGENT_EVAL:-0}" = 1 ]; then
  step "V-6c live agent eval against the real daemon";                   pnpm run test:agent-eval
fi
step "release gate green — now perform docs/release-checklist.md (T5) before shipping"
