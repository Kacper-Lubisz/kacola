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
irrelevant state, arithmetic and adversarial content (docs.typesafe.ai/model-jaggedness/jev-1.13.md). The
window is 30 lines for hosted providers and 10 on-device (see "Cadence" below for why).

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

### Real meetings (`real-interview-coverage`, private fixtures)

The hand-written fixtures above are scripted conversations. This suite instead replays a **real recorded
meeting** against agenda items someone labelled by hand, through the live tracker's own code path (the
daemon's `trackerStatusRunner`: trivial-line filter → relevance gate → batched status round → interview
question for `info-to-get` items → `statusPolicy` with the real thresholds, forward-only, heartbeat every 30 s
of meeting time). Code: `packages/evals/src/real.ts`.

Real meetings are private, so **the fixtures are never committed**. They live in
`packages/testkit/fixtures/evals/private/<name>/` (gitignored; or point `GNOMEOLA_EVAL_PRIVATE_DIR` at another
directory), and the suite is skipped with the reason wherever there is none (CI, other machines). Scorecards
carry item ids and numbers only. The committed `fixtures/evals/real-sample/` is a made-up eight-line
transcript for the suite's own tests.

What it scores, per fixture:

- **auto-tick precision / recall**: a tick is right when the item was fully answered and the tick came at or
  after the topic first came up (`startedAt`); before that it is a *premature* tick (wrong). Items labelled
  `partial` are counted apart: recall leaves them out; `autoPrecision` counts a tick on them as wrong,
  `autoPrecisionLenient` as right.
- **false ticks on negatives**: ticks on items the meeting never answered (`coverage: "none"`).
- **looks covered**: a "looks covered" suggestion or a tick, on answered items (recall) and on negatives.
- **tick lag**: seconds from the end of the labelled answering segment (`answeredAt`) to the tick (segment end
  plus the provider's wall time); median, p90, max, and how many ticked before the labelled answer.
- evidence hits, `info-to-get` answer accuracy and hallucinated answers, cost, decision calls, latency.

Run it: `node packages/evals/scripts/run-evals.ts offline live` (every suite, the real one included),
`… live --real-only` (just this one), or `pnpm test:eval packages/daemon` (the tracker's live eval file).
Each run also writes `results-<provider>.json` next to the fixture, for the review page.

**Export another meeting** (read-only: only `GET /sessions/:id/transcript` is called):

```sh
node packages/evals/scripts/export-real.ts <sessionId> packages/testkit/fixtures/evals/private/<name>
```

This writes `transcript.json` (segments: id, speaker, track, start/end ms, text). Then write `labels.json`
beside it: `{ name, sessionId, labelledBy, reviewed, items: [...] }`, where each item is an agenda item
(`id`, `text`, `kind`) plus `coverage` (`full` | `partial` | `none`), `startedAt` and `answeredAt` (segment
ids; `null` when never answered), `evidence` (segment ids), `answer` / `answerAliases` for `info-to-get`,
`why` (one line), and optional `nearMisses` (lines that sound related but do not answer it). Choose a few
items the meeting never answers, so false ticks are measured. The loader rejects unknown segment ids and
contradictory labels.

**Review labels**: `node packages/evals/scripts/review-real.ts packages/testkit/fixtures/evals/private/<name>`
writes `review.html` into the same (private) directory: each item with its label, the evidence and near-miss
lines with timestamps, what each provider's latest run did (tick time, lag, the line it ticked on), and the
whole transcript with segment indices. To correct a label, edit `labels.json`, set `"reviewed": true`,
re-run the suite and the page. Labels drafted by a model say so (`labelledBy`), and every scorecard notes
whether they were reviewed.

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

### Cadence: when the tracker decides, and why it is late

Measured on the private real interview (37.7 min, 339 segments, 15 labelled items) with Jev; the tooling:

- `node packages/evals/scripts/trace-real.ts [--tracker='<json>'] [--live-publish]` — every decision call
  timed and classified, per item P(covered) on each round, and each tick's lag split into *conservative*
  (waiting for more speech), *pipeline* (that segment's serial calls) and *queue* (waiting behind earlier
  segments). Ids, times and numbers only.
- `run-evals.ts … --tracker='<TrackerOptions json>' --label=<name>` runs the real suite with other options;
  `--live-publish[=ms]` publishes segments as the pipeline does (growing while spoken, then final) instead of
  once each when complete; `--synthetic` adds the scripted agenda meetings through the tracker.

What fires a round: each new segment (relevance gate, then one batched status call over the open items, plus
one interview call per `info-to-get` item that came up), and a 30 s heartbeat when something was said. The
pipeline publishes a segment while it is spoken (its first committed words, more, then the final text); only
its first publication used to trigger a round, so the rest of a long turn waited for the next segment or the
heartbeat. A segment is now judged again once it has grown by `recheckWords` (12) words and when it goes
final with unjudged text — guard included, so words added after a clean verdict never reach a round
unguarded.

Where the lag was: not the pipeline. Calls take p50 ≈ 220 ms (status ≈ 300 ms), a segment's serial chain p90
≈ 0.8 s, the queue never waits. Ticks came late or never because P(covered) stayed under 0.8: with 10 lines
in view, an answer given over several turns never fit, and P *fell* as the talk moved on. More frequent
rounds over the same window did not help (no gate: same recall, twice the per-segment latency; 10 s
heartbeat: same recall). A 30-line window did: recall 3–4/9 → 7–9/9 at precision 1.0. Under live
publication the re-check takes the median lag from ≈ 15 s to ≈ 1 s.

The user's own voice (`me`, the mic track) feeds the tracker like the far end. Wider windows let it raise
false hopes: the one negative that drew a "looks covered?" (P up to 0.7) was entirely the user's own lines
(talking about the topic themselves). So on items the user asks about (`info-to-get`, `question`) their own
line counts one step less (`ownerDemoted`: a check-off becomes a suggestion, a suggestion in progress), and
the status question is told that `me` owns the agenda. Sustained-evidence aggregation (`aggregate`: two
rounds ≥ 0.7 on different lines check an item off) adds one diffuse item at a 10-line window and nothing at
30, so it is available but off.

| real interview, Jev | auto P | auto R | false ticks (neg.) | looks covered R / on neg. | lag median / p90 | calls | $/meeting-h |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (10 lines, finals) | 1.0 | 3–4/9 | 0 | 0.89 / 0 | 0.7 s / 1.4–22 s | 742 | 0.11 |
| 30 lines + owner rule (finals) | 1.0 | 7–9/9 | 0 | 0.89–1.0 / 0 | 0.7–15 s / 34–200 s | 742 | 0.13–0.14 |
| 10 lines, live publication, no re-check | 1.0 | 4/9 | 0 | 0.78 / 0 | 4.4 s / 22 s | 712 | 0.10 |
| 30 lines + owner, live, no re-check | 1.0 | 7/9 | 0 | 1.0 / 0 | 15 s / 48 s | 719 | 0.13 |
| **default: + re-check 12 words, live** | 1.0 | 7–9/9 | 0 | 0.89–1.0 / 0 | 1.0–15 s / 34–200 s | ≈1360 | 0.19–0.23 |

Ranges are over 2–4 runs (Jev's answers vary run to run by about one item). Lag is over ticked items only,
so it grows when items that used to be missed are ticked late: the items ticked before are still ticked
within about a second; the new ones are diffuse answers that add up over a minute or more. The synthetic agenda meetings are unchanged by all of this
(precision and recall 0.94).

## Plugging in (later waves)

The live tracker (agendas wave 2) is plugged in: `trackerStatusRunner` and friends in
`packages/daemon/src/agendas/tracker-eval.ts`, scorecards in docs/tracker.md.

- **Tracker**: implement `StatusRunner` (`start(meeting) → { onSegment(u, history) → { reports, usage } }`) around
  the real pipeline and pass it to `runStatusSuite(runner, agendaFixtures())`; report `action` per item
  (`auto-covered` / `suggest-covered` / `in-progress` / `none`), `pCovered`, `evidenceIndex`, `answer`.
- **Guardrail / pre-check / next point / interview**: implement the matching runner (`run(case) → …`) or reuse
  the `decide*` task functions directly; `runDecisionSuites(setup)` runs them all for one provider.
- **Recap / drafting**: implement `RecapRunner` / `DraftRunner` (e.g. over the M7 enhance plumbing) and call
  `runRecapSuite` / `runDraftSuite`; `llmRecapRunner` / `llmDraftRunner` are the reference prompts.
- **Copilot skill**: not covered here (headless Claude Code against a replayed meeting, opt-in like
  `packages/e2e/scripts/agent-eval.ts`); the recap/injection datasets and graders are reusable for it.
