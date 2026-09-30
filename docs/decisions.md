# Typed decisions and the AI evals (`@gnomeola/decisions`, `@gnomeola/evals`)

Agendas wave 1B. Live intelligence (the agenda tracker, the relevance pre-check, the injection guardrail,
the next talking point, interview answers) asks **typed decisions**, not text: an option, a level, yes/no or
a short value copied from the input, each with a probability code can threshold. Text generation (agenda
drafting, bridge lines, recaps) stays on `@gnomeola/llm`. Every AI behaviour has an eval: a labelled dataset,
graders, a scorecard, an offline mode that runs in `pnpm check` and a key-gated live mode.

## Packages

| package | owns |
| --- | --- |
| `@gnomeola/decisions` | the `DecisionProvider` contract, the five providers, the agenda **tasks** (question builders + readers + the tracker policy + on-device rules), decision cassettes |
| `@gnomeola/testkit/evals` | datasets (schemas, loaders), graders, scorecards, baselines |
| `@gnomeola/testkit/fake-decisions` | local fakes of the TypeSafe, OpenAI Responses, Anthropic Messages and Ollama chat APIs |
| `@gnomeola/evals` | the suites, the runner hooks, reference runners, the offline / fake / live provider matrix |

`decisions` is its own package rather than part of `llm`: the contract is different (batched typed questions
with probability outputs, not a streamed prompt), and it carries a native dependency (onnxruntime-node) that
the Q&A path should not load. It reuses `llm`'s `LlmError`, OpenAI error mapping, Anthropic `toLlmError` and
prices, so callers handle both layers' errors the same way.

## The interface

```ts
import { decisionProviderFromSettings } from '@gnomeola/decisions'

const p = decisionProviderFromSettings({ provider: 'jev', model: '' }, { apiKey })   // null without a key
const r = await p.decide(
  { state: { transcript: [...], agenda: [...] },                // text or JSON: what the questions are about
    questions: [
      { id: 'status.0', kind: 'choice', instructions: '…', options: { not_started: '…', in_progress: '…', covered: '…' } },
      { id: 'urgency', kind: 'score', instructions: '…', levels: ['low', 'medium', 'blocking'] },   // → 0..1
      { id: 'inj', kind: 'yesno', instructions: '…', yes: '…', no: '…' },                           // P(yes)
      { id: 'answer.0', kind: 'extract', instructions: '…', candidates?: [...] },                  // short value | null
    ] },
  { signal, timeoutMs })
r.answers['status.0']  // { kind: 'choice', choice, probabilities, confidence, source }
r.usage; r.costUsd; r.latencyMs; r.calls; r.retries; r.model
```

- **Batching**: all questions about one state go in one call; each provider splits at `maxQuestionsPerCall`
  (jev 64, OpenAI/Anthropic 24, Ollama 12) and runs batches 4 at a time.
- **Timeouts** are per attempt (default 10 s hosted, 30 s Anthropic/Ollama/local) and fire even if the
  transport ignores its signal; **cancellation** via `signal` rejects promptly as `aborted` (never retried).
- **Retries**: `rate_limited`, `overloaded`, `server`, `timeout`, `network` — 2 retries, backoff 500 ms × 2ⁿ
  (≤ 5 s), a server's `retry-after(-ms)` wins when longer. SDK retries are off so this is the only policy.
- **Errors**: always `LlmError` with a `code` (`auth`, `quota`, `rate_limited`, `bad_request`, …). A response
  that does not answer what was asked (missing answer, wrong kind, unknown option) is `server` (retried).
- **Confidence** = TypeSafe's definition for every provider, `(n·max − 1)/(n − 1)` over the distribution
  (docs.typesafe.ai/confidence.md); `source` says where the probabilities came from and must be respected:
  `calibrated` (Jev), `logprobs` (OpenAI non-reasoning models), `self-reported` (LLM wrote a number:
  uncalibrated), `heuristic` (on-device).

## Providers

| id | transport | how each kind is asked | confidence | verified against |
| --- | --- | --- | --- | --- |
| `jev` | `@typesafe-ai/sdk` 0.6.0 (MIT) → `POST /v1/systemone` | choice→Choice, score→Score, yesno→Noul, extract→Choice over candidate spans + `none` (the pre-parsed extraction pattern) | calibrated | fake server reproducing api.md shapes and errors; live test gated on `TYPESAFE_API_KEY` (no key here: skipped) |
| `openai` | fetch → Responses API, `text.format` json_schema strict | one JSON object, a property per question; `include: message.output_text.logprobs`, `top_logprobs: 10` on non-reasoning models (default `gpt-4.1-mini`) | logprobs of the token that starts each value; self-reported (marked) when ambiguous or on reasoning models | fake server; **live API reached**: the account has no credits → `quota` → skipped |
| `anthropic` | `@anthropic-ai/sdk`, strict tool `record_decisions`, `tool_choice: auto`, effort low, server-side fallbacks | same JSON schema as the tool's input | self-reported | fake server; live gated on `ANTHROPIC_API_KEY` (none here) |
| `ollama` | fetch → `/api/chat`, `format: <schema>` | same | self-reported | fake server; live with `GNOMEOLA_EVAL_OLLAMA_URL` |
| `local` | all-MiniLM-L6-v2 int8 ONNX via onnxruntime-node, + rules by question `tag`; hashing embedder when the model is absent | rules first (injection patterns; agenda cues), else cosine similarity to option / level / yes-no anchors and candidates | heuristic | real model, offline evals in `pnpm check` |

OpenAI logprobs: the response's tokens must reassemble the output text exactly; the token covering the first
character of each `choice`/`level`/`answer` value must identify a single option, and ≥ 90 % of its top-k mass
must map unambiguously onto options — otherwise the self-reported numbers are kept and marked so.

Prices: Jev $0.042 / M input tokens, output free (docs.typesafe.ai/models.md); gpt-4.1-mini $0.40 / $1.60;
Claude from `@gnomeola/llm`'s table; Ollama and unknown models `null` (unknown, not zero); local `0`.

### The on-device model

`text-embedding-minilm-l6-v2-int8` in the model catalogue (`packages/stt/src/model-manager/catalog.ts`):
Xenova's int8 ONNX export of sentence-transformers/all-MiniLM-L6-v2 pinned to a commit, sha256
`afdb6f1a…bdb1`, 22 972 370 bytes, Apache-2.0. Its WordPiece vocabulary (bert-base-uncased, Apache-2.0) is
committed in `packages/decisions/assets` with its sha256, so the model is one checksummed download. The
tokenizer reproduces BERT's reference tokenization (tested); pooling is sentence-transformers' mean pooling +
L2 norm. **One text per inference**: the int8 graph quantises activations over the whole input tensor,
padding included, so batching made a text's vector depend on its neighbours (cosine 0.991). sherpa-onnx
does not do text embeddings; onnxruntime-node co-loads with sherpa's bundled onnxruntime in one process (both
load orders checked). The model is optional: it is excluded from onboarding's required models, and the local
provider falls back to the hashing embedder (health says so). Tests use `~/.cache/gnomeola/test-models`
(`node packages/decisions/scripts/fetch-embedder.ts`), never the user's data dir.

## Settings, keys, health

- `settings.decisions = { provider: 'jev' | 'openai' | 'anthropic' | 'ollama' | 'local', model, apiKeyConfigured }`
  (default `local`, model `''` = provider default; switching provider without a model resets it). Optional in
  the schema so older stored settings parse.
- Keys reuse the keyring/env pattern: jev → keyring account `typesafe` / `TYPESAFE_API_KEY`; openai and
  anthropic share the Q&A keys. `PUT /settings/api-key {provider: 'typesafe'}` stores it.
- `/health.decisions = { provider, model, ready, detail }` — e.g. `no TYPESAFE_API_KEY in the environment or
  keyring`, `on-device embedding model not downloaded: using the hashing fallback`.
- The daemon's `DecisionsService` (`daemon.decisions.provider()`) builds and caches the provider; later waves
  call it per decision round. The release runtime stages onnxruntime-node (target binaries only, 45 MB on
  linux-x64) and the vocabulary; the bundled daemon on Electron-as-Node is tested to load MiniLM.

## Tasks (what the tracker asks)

`@gnomeola/decisions` tasks are the questions the tracker, the agent bridge and the evals all share:

- `decideStatus(provider, { items, window })` — per open item: status choice (not started / in progress /
  covered, wording per kind), the evidence line (extraction over the window's lines), and for info-to-get the
  answer heard. `statusPolicy(current, manual, decision)` = the brief's rules: covered ≥ 0.8 **with evidence**
  → auto (undoable), 0.5–0.8 → "looks covered?", forward-only, manual always wins.
- `decideRelevance`, `decideInjection`, `decideNextPoint` (model distribution × a code-side prior: must-cover
  under time pressure, in-progress, just-discussed, absent owner — arithmetic stays in code), `decideInterview`.
- `AGENDA_RULES`: the on-device rules for each (lexical overlap + embedding similarity, settle / defer /
  deflect cues). Heuristics, honestly labelled; no tuning was done.

State is kept small (the recent window plus the items asked about): Jev's documented weak spots are large
irrelevant state, arithmetic and adversarial content (docs.typesafe.ai/model-jaggedness/jev-1.13.md).

## Evals

Datasets (`packages/testkit/fixtures`):

| dataset | size | labels |
| --- | --- | --- |
| `agenda/manager-1on1` | 137 s, 33 utterances, 5 items | explicit + implicit settlement, one discussed-not-settled, tangents |
| `agenda/interview-candidate` | 106 s, 28 utterances, 6 info-to-get | answers incl. answered-then-corrected, one deflected |
| `agenda/standup-recurring` | 99 s, 25 utterances, 6 items | implicit decision, carried-over item never discussed |
| `agenda/hostile-planning` | 116 s, 28 utterances, 4 items | 2 injection lines, tangents, deferred item, must-cover never reached, overrun |
| `evals/agenda-drafting.jsonl` | 14 | concepts to cover (+ kind), private context that must not appear, item bounds |
| `evals/relevance-precheck.jsonl` | 44 (26 / 18) | worth waking the agent? + which item |
| `evals/injection-guardrail.jsonl` | 42 (21 / 21) | direct, indirect, obfuscated, role-play, benign mentions, quoted reports |
| `evals/next-point.jsonl` | 22 | best next item + acceptable alternatives |
| `evals/recap.jsonl` | 17 | outcome keyword groups, actions with owners, forbidden (injected) text |
| `evals/interview-extraction.jsonl` | 28 (20 / 8) | answered? + canonical answer + aliases |

The agenda fixtures are generated like the others (`node packages/testkit/scripts/generate-fixtures.ts
--agenda`, Piper voices): per item, when it was settled (end of the settling utterance, ms), which utterances
are evidence, the outcome/answer, and whether settlement was implicit.

Graders (`@gnomeola/testkit/evals`, each unit-tested against hand-computed values): precision/recall/F1,
macro-F1, ECE and multi-class Brier, settle latency in fixture time (early guesses counted apart, never
allowed into the percentiles), exact/fuzzy extraction (normalised token F1, containment, edit distance,
aliases), top-1/MRR, rubric checks (any-of keyword groups, forbidden phrases on word boundaries, length), and
an optional LLM judge (live only).

Suites (`@gnomeola/evals`): `item-status` replays each agenda fixture segment by segment in the order segments
close — decision time = the segment's end + the runner's wall time — and grades auto check-off
precision/recall, latency, final status, evidence, calibration of P(covered) at every probe, interview answers,
and cost per meeting-hour; plus `relevance-precheck`, `injection-guardrail`, `next-point`,
`interview-extraction`, `agenda-drafting`, `recap`. Budgets from the brief (auto precision ≥ 0.9, p90 check-off
≤ 30 s after settling) are measured everywhere and **asserted only for live runs**.

Modes:

- **offline** (`pnpm check`, int tier): local provider (hashing always, MiniLM when installed) on every suite,
  compared to committed baselines (`packages/testkit/fixtures/baselines/evals`, re-record with
  `GNOMEOLA_UPDATE_BASELINES=1`); extractive drafting/recap runners as the text floor.
- **fake** (`pnpm check`): every decision suite through jev/OpenAI/Anthropic/Ollama clients against the fakes
  with a lexical stand-in brain — plumbing only; plus a committed decision cassette replayed with no server.
- **live** (`pnpm test:eval packages/evals packages/decisions`): every keyed provider; live decisions are
  recorded to `__artifacts__/evals/cassettes/<provider>.json` (commit one to add an offline replay).
- `node packages/evals/scripts/run-evals.ts [offline|fake|live]` prints scorecards and writes them to
  `__artifacts__/evals/<suite>/`.

Current offline numbers (local provider, MiniLM; the hashing embedder is within noise — the lexical rules
dominate both):

| suite | numbers |
| --- | --- |
| item-status (21 items, 4 meetings) | auto precision 0.75, recall 0.56, 6 early check-offs, p90 delay 23 s, within-30 s 0.25 of settled items, final-status accuracy 0.52, ECE 0.19 |
| relevance pre-check | P 0.79 R 0.76 F1 0.78, ECE 0.14 |
| injection guardrail | P 0.87 R 0.62 F1 0.72, ECE 0.25 |
| next point | top-1 0.64, acceptable top-1 0.73, MRR 0.80 |
| interview extraction | answered P 1.0 R 0.30, answer accuracy 0.39, 0 hallucinated |
| agenda drafting (extractive) | concept recall 0.98, pass 0.93, 0 private leaks |
| recap (extractive) | rubric 0.66, pass 0.41, 0 injected text |

These are baselines, not targets: nothing was tuned. The live providers have no numbers yet (no TypeSafe or
Anthropic key; the OpenAI account has no credits).

## Plugging in (later waves)

- **Tracker**: implement `StatusRunner` (`start(meeting) → { onSegment(u, history) → { reports, usage } }`) around
  the real pipeline and pass it to `runStatusSuite(runner, agendaFixtures())`; report `action` per item
  (`auto-covered` / `suggest-covered` / `in-progress` / `none`), `pCovered`, `evidenceIndex`, `answer`.
- **Guardrail / pre-check / next point / interview**: implement the matching runner (`run(case) → …`) or reuse
  the `decide*` task functions directly; `runDecisionSuites(setup)` runs them all for one provider.
- **Recap / drafting**: implement `RecapRunner` / `DraftRunner` (e.g. over the M7 enhance plumbing) and call
  `runRecapSuite` / `runDraftSuite`; `llmRecapRunner` / `llmDraftRunner` are the reference prompts.
- **Copilot skill**: not covered here (headless Claude Code against a replayed meeting, opt-in like
  `packages/e2e/scripts/agent-eval.ts`); the recap/injection datasets and graders are reusable for it.
