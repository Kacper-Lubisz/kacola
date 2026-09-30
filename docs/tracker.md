# The live tracker (agendas wave 2)

While a recording linked to an agenda runs, the daemon's `AgendaTracker`
(`packages/daemon/src/agendas/tracker.ts`) follows the transcript and keeps the agenda current. It asks
typed decisions (`@gnomeola/decisions` tasks, on whichever decisions provider Preferences selects) and
writes through `AgendaStore`, so the agenda rules (forward-only, manual wins, history) apply to it like to
anyone else. Text (bridge lines, the recap) comes from the Q&A LLM (`@gnomeola/llm`).

## What it does

| when | what | decision calls |
| --- | --- | --- |
| a segment closes (first upsert of its id) | filler / < 3 words → nothing | 0 |
| | injection guard (`decideInjection`) ‖ relevance pre-check (`decideRelevance`) | 2 (parallel) |
| | a flagged line is never evidence and never decision input again | |
| | relevant → one **batched** status round over the open items (`decideStatus`) | +1 |
| | an interview item (info-to-get / competency) that has come up → `decideInterview` (answered? + the value) | +1 per such item |
| every 30 s (heartbeat) | a status round if anything was said since the last one (catches what the gate missed) | ≤ 1 |
| after a round | next talking point (`decideNextPoint`), at most once a minute while a card is up | ≤ 1 |
| | T-5 min before the calendar end: one "not covered yet" suggestion | 0 |
| | context from past meetings (FTS over earlier non-private recordings), at most every 3 min | 0 |

The policy is `statusPolicy`: P(covered) ≥ 0.8 **with evidence** → `setStatus(covered, {by: 'tracker',
auto: true, confidence, evidence})` (undoable); 0.5–0.8 → a `looks-covered` suggestion (one open per
item); has come up → `in-progress`. A 409 from the store (backward move, user override) = stay quiet.
Items the user set by hand (an override) are not even asked about. Interview items: the answer heard is
the `outcome`, the line that carries it the evidence; an answer the tracker recorded is corrected when the
talk returns to the item and a different answer is heard with confidence ≥ 0.8.

**Next talking point**: open items minus those discussed in the last 90 s or dismissed by the user in the
last 5 min, ranked by the model × the code-side prior (must-cover under time pressure vs the calendar end,
in-progress, recency, absent owner). One `next-point` suggestion at a time: when the top item changes the
old card is **dismissed by `tracker`** and a new one posted. Text: one bridge sentence from the LLM when
one is configured (8 s timeout), else the template `Next: <item> — must cover, 7 min left`.

**Context cards**: capitalised names/projects in the recent lines (speaker names first) are searched in
earlier non-private recordings; the most recent match becomes a private card `Last time with Ana` /
`Earlier on Priya` (source `{kind: 'session', ref}`, `createdBy: tracker`), one per term per meeting.

**Never blocks capture**: store commits only enqueue; one serial worker per recording; beyond 8 pending
segment triggers the oldest is dropped (`dropped` in the status; the next round still reads its text).

**Provider failures**: any `LlmError` from the selected provider (quota, auth, network, rate limit after
its retries, …) → the on-device provider answers for 5 min (provider-wide, the guard included), the status
says `degraded` with the reason, then the selected one is tried again. A keyed provider without its key →
`degraded` from the start. Every provider works: the tracker's tests drive jev / OpenAI / Anthropic /
Ollama clients against the local fakes, and the local provider for real.

## Recap (`agendas/recap.ts`)

`daemon.agendas.onRecap` hook: when the recording stops (after the tracker drained its queue), one LLM call
per item — `recapItem` in `@gnomeola/llm/agenda.ts`, the M7 enhance plumbing: the transcript through
`assemblePrompt` is the byte-stable cached prefix, the item (+ what was noted so far) the volatile tail,
so items 2..n read the cache. Output `Status / Outcome / Decisions / Actions`, stored as the item's
`outcome` (`agenda.item.upserted` by `tracker`). A user-written outcome is never replaced; the tracker's
interview answer stays the first line; the recap never changes a status — "covered" for an open item posts
a `looks-covered` suggestion (`Recap: looks covered — …`). No LLM → recap `unavailable` (reason in the
status); a refusal or an error leaves that item untouched (`failed` only when nothing was written).

**Why not a notes version**: M7 notes are the user's document. `user` versions are their words; an
`enhanced` version exists only as the pending review of an enhancement they asked for (one pending slot).
An automatic write would replace an open review or put an unasked-for review over their notes. The recap
lives on the items, where the window, the markdown export (`> ` outcome lines), carry-over and the
invitee page already read outcomes.

## SpeechGuard (`agendas/speech-guard.ts`)

`decisionSpeechGuard` implements the agent channel's `SpeechGuard` contract structurally (partials pass,
closed segments judged by `decideInjection`, flag `injection`, text unchanged, cached per segment text,
on-device fallback). The tracker uses it; the daemon exposes it as `daemon.tracker.guard`. **Wiring at
merge with the agent channel (one line in daemon.ts):** `if (tracker) agents.setGuard(tracker.guard)`.

## Events and routes (what the window folds)

- Durable, as before: `agenda.item.status` (`by: 'tracker'`, `auto`, `confidence`, `evidence`),
  `agenda.item.upserted` (interview answers / corrections, recap outcomes), `agenda.suggestion.upserted`
  (`source: 'tracker'`; kinds `next-point`, `looks-covered`, `missed`; a next-point card replaced by the
  tracker arrives as `state: dismissed, resolvedBy: tracker` = superseded, not a user dismissal),
  `agenda.context.upserted` (`createdBy: tracker`, private).
- Ephemeral, new: `agenda.tracker {status: TrackerStatus}` (`packages/protocol/src/tracker.ts`):
  `state` running · degraded · stopped, `selected` / `provider` / `model`, `detail` (why degraded),
  counters (`segments`, `relevant`, `rounds`, `decisionCalls`, `dropped`, `errors`), `costUsd`,
  `recap {state: pending · running · done · unavailable · failed, detail, items}`. Throttled to one per
  2 s per recording; state changes always go out.
- Route, new: `GET /agendas/:id/tracker` → `{tracker: TrackerStatus | null}` (a window opening
  mid-meeting).
- `DaemonOptions.tracker` (tuning, `false` = off) and `DaemonOptions.agendaLlm` (test seam for the text
  LLM). `ScriptedPipeline` (`fakes/scripted-pipeline.ts`) replays a scripted meeting for tests and demos.

## Evals through the tracker's code path

`agendas/tracker-eval.ts`: `trackerStatusRunner` drives a real `AgendaTracker` over an in-memory store,
committing each fixture utterance as a closed segment (fixture clock, heartbeat every 30 s of fixture
time); `trackerRelevanceRunner` / `trackerInjectionRunner` / `trackerNextPointRunner` /
`trackerInterviewRunner` are the gate, the guard, the ranking and the interview path as the tracker calls
them; `trackerRecapRunner` is the daemon's recap prompt. Baselines:
`packages/daemon/test/fixtures/baselines/tracker-evals` (`GNOMEOLA_UPDATE_BASELINES=1`).

Offline, local provider (deterministic; hashing ≈ MiniLM, the rules dominate). Nothing tuned:

| suite | hashing | MiniLM | reference runner (docs/decisions.md) |
| --- | --- | --- | --- |
| item-status: auto precision / recall | 0.75 / 0.56 (12 auto) | 0.75 / 0.56 | 0.75 / 0.56 |
| early check-offs · within 30 s · p90 delay | 3 · 0.44 · 23.4 s | 3 · 0.44 · 23.4 s | 6 · 0.25 · 23 s |
| final-status accuracy · evidence hit · ECE | 0.52 · 0.67 · 0.18 | 0.52 · 0.67 · 0.18 | 0.52 · – · 0.19 |
| info-to-get answers (accuracy, hallucinated) | 0.50, 1 | 0.50, 1 | – |
| decision calls (114 segments) | 323 | 321 | one status call per segment + nothing else |
| relevance gate P / R / F1 | 0.79 / 0.76 / 0.78 | same | same |
| injection guard P / R / F1 | 0.87 / 0.62 / 0.72 | same | same |
| next point top-1 / acceptable / MRR | 0.68 / 0.68 / 0.83 | 0.64 / 0.73 / 0.80 | 0.64 / 0.73 / 0.80 |
| interview answered P / R, answer accuracy | 1.0 / 0.30, 0.39 | same | same |

The on-device heuristics never produce a P(covered) between 0.5 and 0.8, so the local provider makes no
`looks-covered` suggestions (0 in the fixtures). The auto-precision budget (≥ 0.9) is missed offline; the
30 s p90 budget is met. In the real daemon replaying manager-1on1 (`tracker-daemon.int.test.ts`): 4 of 5
items auto-covered, all 4 correct; 33 segments, 21 relevant, 97 decision calls.

Live (`pnpm test:eval packages/daemon/test/tracker.eval.test.ts`, keyed): no numbers — jev (no
`TYPESAFE_API_KEY`), Anthropic (no key) and Ollama (no URL) skip; OpenAI was reached and answered
`quota: no credits remaining`, so its decision and recap suites skip with that reason.

## Tests

| file | proves |
| --- | --- |
| `packages/daemon/test/tracker.int.test.ts` | evidence check-off, manual wins, guard, the queue never blocks + drops, degrade + recovery, next point (template, LLM line, replaced), T-5 nudge, interview outcome, context card, stop; every provider client via fakes |
| `packages/daemon/test/tracker-daemon.int.test.ts` | the real daemon replaying manager-1on1: checks with evidence from the recording, suggestions, context, recap per item, status route/event, invariants + replay == state; recap failure modes |
| `packages/daemon/test/tracker-evals.int.test.ts` | the offline scorecards above against committed baselines |
| `packages/daemon/test/tracker.eval.test.ts` | live, key-gated |
