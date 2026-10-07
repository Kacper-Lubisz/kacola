# Speech-to-text (`@kacola/stt`)

Two recognizer tiers, a VAD and a reconciler turn two PCM tracks (mic = the user, system = everyone
else) into speaker-attributed, revisable transcript segments.

```
 PCM per track ──► Silero VAD ─────────────── speech start / end ──┐
   (16 kHz,    └─► tier 1: streaming transducer ── partials,        ├─► Reconciler ──► transcript.partial (ephemeral)
    session                                        endpoints  ─────┘      │        ──► segment.upserted  (durable)
    offsets)                                                              │ finalize(segment)
                   tier 2: offline recognizer ◄── closed segment audio ◄──┘
                                              ── text + confidence ──► Reconciler (live → final, once)
```

Everything runs locally through [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) via the prebuilt
`sherpa-onnx-node` addon (1.13.8, verified on Node 24.21, Fedora 44 x86-64). One native toolchain; no
whisper.cpp build.

## Chosen models

| role | model | download | licence |
| --- | --- | --- | --- |
| live (tier 1) | `live-nemo-fastconformer-en-80ms-int8` — NeMo streaming FastConformer transducer, 80 ms chunks | 102.8 MB | CC-BY-4.0 |
| final (tier 2) | `final-parakeet-tdt-110m-en-int8` — NVIDIA Parakeet TDT 110M | 108.0 MB | CC-BY-4.0 |
| VAD | `vad-silero` — Silero VAD | 0.6 MB | MIT |

URLs and pinned sha256 for every model are in `packages/stt/src/model-manager/catalog.ts`; defaults are
`DEFAULT_MODELS` there. Whisper, Moonshine, Parakeet 0.6B, Kroko and two Zipformers remain in the catalog
as selectable alternatives (Settings `stt.liveModel` / `stt.finalModel` are catalog ids).

### How they were chosen — measured, not assumed

Machine: i9-12900KF (24 threads), sherpa-onnx 1.13.8, Node 24.21. Fixtures: the four meetings in
`packages/testkit/fixtures` (683 reference words: 480 synthetic, 203 LibriSpeech). WER is pooled
(total errors / total reference words) after normalisation (case, punctuation, numbers spelled out).
RTF = decode wall time / audio duration. Reproduce with `node packages/stt/scripts/bench.ts`.

**Tier 2 (oracle segmentation: each ground-truth utterance ±150 ms, 4 threads)**

| model | WER synthetic | WER LibriSpeech | WER all | RTF |
| --- | --- | --- | --- | --- |
| whisper tiny.en int8 | 7.1% | 6.4% | 6.9% | 0.034 |
| whisper base.en int8 | 6.3% | 5.4% | 6.0% | 0.060 |
| whisper small.en int8 | 4.2% | 4.9% | 4.4% | 0.209 |
| moonshine v2 tiny | 9.4% | 4.4% | 7.9% | 0.009 |
| moonshine v2 base | 6.9% | 3.4% | 5.9% | 0.016 |
| **parakeet TDT 110M int8** | **4.4%** | **2.0%** | **3.7%** | **0.017** |
| parakeet TDT 0.6B v2 int8 | 5.6% | 2.0% | 4.5% | 0.048 |

Parakeet 110M is the most accurate *and* 12× cheaper than the most accurate Whisper we can run
(small.en), so the plan's whisper.cpp tier-2 is replaced by it. It also emits casing and punctuation, and
token log-probs (used as segment `confidence`; Whisper exposes none through sherpa).

**Tier 1 (whole tracks streamed in 100 ms chunks, 1 thread)** — accuracy matters less here than latency,
because tier 2 replaces the text; latency measured at 1× real time on `standup-2p` (both tracks at once):

| model | WER all | RTF | utterance-end latency p50 / p95 | word latency p50 / p95 |
| --- | --- | --- | --- | --- |
| zipformer en 2023-06-26 int8 | 11.4% | 0.036 | 575 / 766 ms | 412 / 523 ms |
| zipformer en 20M int8 | 15.7% | 0.016 | – | – |
| kroko en 2025-08-06 | 7.5% | 0.019 | 1124 / 1374 ms | 925 / 1448 ms |
| **nemo FastConformer 80 ms int8** | **9.8%** | **0.164** | **326 / 578 ms** | **253 / 355 ms** |

The NeMo 80 ms model is the only one that meets the plan's "~300 ms" live target, at the cost of CPU
(one track ≈ 16% of one core). Kroko is more accurate but answers a second late (and is CC-BY-SA).

**Full pipeline** (VAD + both tiers + reconciler, run as fast as possible, both tracks) — these are the
committed V-2b baselines in `packages/testkit/fixtures/baselines/`:

| fixture | WER (mic / system) during | WER tier 1 only (`off`) | pipeline RTF |
| --- | --- | --- | --- |
| standup-2p | 7.9% (12.0% / 4.4%) | 9.7% | 0.33 |
| planning-3p-crosstalk | 4.9% (6.5% / 4.2%) | – | 0.33 |
| retro-silence-gap | 4.0% (1.8% / 5.3%) | – | 0.31 |
| librispeech-3p | 3.4% (1.4% / 4.7%) | 6.9% | 0.34 |

Pipeline RTF is for the whole session (two tracks, all stages, one process); at 1× real time it leaves
~2/3 of that budget idle. Remaining errors are genuine recognition slips ("Ana" → "Anna",
"queue worker" → "cue worker", "three attempts" → "three to tempts").

## Tiers and how they interact

* **VAD** (Silero, threshold 0.5, 0.25 s min speech, 0.5 s min silence, 20 s max speech) defines segment
  boundaries per track. Segments longer than 20 s are split, which keeps every tier-2 input short.
* **Tier 1** decodes every chunk as it arrives and emits `partial` hypotheses (with per-word session
  timestamps) and `endpoint`s (0.8 s trailing silence). Partials become ephemeral
  `transcript.partial` events; endpoint words are attached to VAD segments by time.
* **Tier 2** runs once per closed segment on the audio of that segment ±150 ms, on the libuv thread
  pool (`decodeAsync`), sequentially, so it never blocks tier 1.
* `finalPass`: `during` (default) runs tier 2 as segments close; `after` queues every request until
  `stop()` (for CPU-constrained sessions); `off` never runs it, segments stay `live`.
* The pipeline keeps ~60 s of int16 audio per track for tier 2 (`during`) or the whole session
  (`after`); pass `audioSource` to read from the recorded WAV instead for long `after` sessions.

## The reconciler (T-5)

A pure, deterministic state machine (`packages/stt/src/reconciler.ts`) — no clocks, no I/O, ids from an
injectable factory. Inputs: `vad.start/end`, `live` (partial/endpoint), `final`, `final.failed`, `pause`,
`resume`, `gap`, `end`. Outputs: `transcript.partial`, `segment.upserted`, and `finalize` requests.

```
(vad.start)──► open ──(vad.end | pause | gap | end)──► closed ──(final)──► final
                │  endpoint words extend it              │  late tier-1 words still revise it
                └─ first upsert once it has text         └─ empty final on a never-published segment → dropped
```

* Segment ids are `newId('seg')`, assigned at `vad.start`, never change.
* Every upsert increments `revision` (starting at 1); nothing is emitted for a segment after its final.
* `quality` goes `live → final` exactly once; a segment with no tier-1 text is born `final`.
* `speaker = speakerForTrack(track)`: mic is always `me`, system is `them` (diarization is M3).
* Offsets are session-timeline ms. A new segment never starts before the previous one on its track
  ended, so per-track segments never overlap. Pause and recorded gaps close open speech at that
  instant; nothing is transcribed while paused or inside a gap.
* Tier-1 words are attached to the latest segment starting at or before the word (200 ms lead
  tolerance) if within 1 s of its end (tier-1 timestamps lag speech by a few hundred ms); words with no
  segment are held until the VAD catches up, else dropped (counted in `stats.droppedLiveWords`).
* An empty `transcript.partial` clears the live row when text is committed, paused or ended.

Verified by scripted unit tests and a seeded property test (1 200 random sessions across the three
`finalPass` modes, with malformed and out-of-order inputs) asserting `checkSegments` +
`checkSegmentHistory` + consecutive revisions + at-most-one final; mutation-checked (removing the start
clamp or the final-once guard fails it). The e2e suite asserts the same invariants on the real event
stream of every fixture.

## Model manager (T-1)

`ModelManager` downloads to `$KACOLA_MODELS_DIR` or `${XDG_DATA_HOME:-~/.local/share}/kacola/models`:
resumable (HTTP Range on `.downloads/<id>.part`), sha256-verified before extraction, extracted to a
staging dir and moved into place with a manifest (per-file size + sha256) written last. State matches
protocol `ModelInfo`: `missing`, `downloading` (this process, or a live pid holding the lock),
`ready`, `corrupt` (checksum mismatch, missing/resized required file, missing manifest, or a failed
deep `verify()`). `ensure()` is idempotent, shares concurrent calls, and repairs corrupt installs.
Requires `tar` + `bzip2` on the host.

## Adding a provider

Implement the interfaces in `packages/stt/src/types.ts`:

* `LiveRecognizer.createStream({ track, startMs, onHypothesis })` → `{ accept(pcm), flush() }`. Emit
  `partial`/`endpoint` hypotheses with `words` on the **session** timeline (`startMs` + samples fed).
  `accept` may return a promise (network providers); the pipeline awaits outstanding work on `stop()`.
* `FinalTranscriber.transcribe(pcm)` → `{ text, confidence | null }` for one segment.
* `VoiceActivityDetector` likewise, if a provider brings its own endpointing.

Pass them to `new TranscriptionPipeline({ sessionId, live, final, vad, finalPass, onEvent })`; the
reconciler and its guarantees are provider-independent. Local models: add a `CatalogEntry` (download
once, record the sha256 and size) and, if it is a new engine family, a case in
`sherpa/final.ts#offlineModelConfig` or `sherpa/live.ts`.

## Fixtures and baselines

`@kacola/testkit/fixtures` — seven meetings with exact ground truth, audio committed as Opus (2.2 MB
total), decoded by ffmpeg to 16 kHz WAV in `${XDG_CACHE_HOME:-~/.cache}/kacola/fixtures`:

| id | what | length |
| --- | --- | --- |
| `standup-2p` | clean two-person call; retry budget / Thursday migration / Ana owns the dashboard | 67 s |
| `planning-3p-crosstalk` | user + 2 far-end speakers, 4 cross-track overlaps, −40 dB speaker bleed into the mic, a far-end prompt-injection line | 62 s |
| `retro-silence-gap` | 20 s silence, then a 6 s recorded gap on both tracks | 82 s |
| `librispeech-3p` | real read speech (LibriSpeech test-clean 1089 / 121 / 237) | 85 s |
| `three-far-4p` | V-3: LibriSpeech, the user + **three** far-end speakers (two women, one man) handing over in 250 ms — too quick for VAD | 56 s |
| `crosstalk-bleed-3p` | V-3: far-end people talking **over each other** on the system track, the user over them, and −12 dB bleed through a reverberant room (40 ms, RT60 0.35 s) | 63 s |
| `bad-connection-3p` | V-3: one far-end speaker on a **bad line** (telephone band, 6 kbit/s Opus, lost packets), noisy far-end mix | 70 s |

Synthetic speech: Piper voices `en_US-joe` (CC0 data), `en_US-ljspeech` (public domain), `en_US-sam`
(Apache-2.0 data), `en_GB-cori` (public domain). Each was accepted only after scoring < 5% WER with
Parakeet 0.6B on the script (`packages/stt/scripts/voice-check.ts`); the first choice (`norman`)
scored 9.6% and made fixtures measure the TTS. Regenerate with
`node packages/testkit/scripts/generate-fixtures.ts` — Piper's internal noise is seeded per process,
so regenerated audio differs at the sample level: re-record baselines in the same commit.

Baselines: `KACOLA_UPDATE_BASELINES=1 pnpm test:e2e` rewrites them (a reviewed diff); otherwise
`compareToBaseline` fails on WER +3 pts (±5 pts per track) or RTF beyond 4× the recorded value. RTF bands
are wide because CI hardware differs; WER is deterministic run to run on the same build. A trend report
is written to `packages/stt/test/__artifacts__/stt-pipeline-report.json`.

## Attribution (M3): who said what

Track A (the mic) is the user by construction and never touches the diarizer; the store refuses to
attribute a mic segment to anyone but `me`, or a far-end segment to `me` (and `me`/`them` are reserved
speaker labels). Only the far-end track is diarized:

1. **Split** (A-2). When a far-end VAD segment closes, its tier-2 request is held while pyannote
   segmentation 3.0 (via sherpa's offline diarizer, run on just that segment) looks for a change of
   speaker. Stable runs of another voice ≥ 700 ms become split points; the reconciler cuts the segment
   (first piece keeps the id, words follow their timestamps, each piece gets its own tier-2 pass with
   context padding that never crosses the cut). This is what separates quick hand-overs VAD merges.
2. **Assign** (A-3). One TitaNet-small embedding per piece, clustered online: join the most similar
   centroid at cosine ≥ 0.4, else found a new speaker. Pieces under 1 s may join but never found a
   speaker or move a centroid; under 300 ms get no embedding and follow the previous speaker. Cluster ids
   never change, so the daemon's speaker ids (`spk_…`, "Speaker N", a stable colour) never do either.
3. **Re-cluster** at stop: average-linkage over every embedding (threshold 0.4), mapped back onto the
   online ids by shared time (Hungarian), so only genuinely changed attributions are re-emitted.
   Attributions a person made (split, merge) are never overridden by the diarizer.

Models run in a worker thread (`packages/stt/src/sherpa/diarize-worker.ts`); nothing blocks capture.

**Echo gate** (A-4). Laptop speakers leak the far end into the mic; transcribed, that would become "me".
The gate estimates the echo delay (log-energy envelope correlation), the echo gain (60th percentile of
mic/far-end energy ratios while the far end talks) and silences 20 ms mic blocks that the far end, through
a reverberant tail, explains within 9 dB — before VAD and both tiers. It is a gate, not a canceller: a
quiet syllable of the user's under a loud far end can be clipped; the far end is never made the user.
Measured: `crosstalk-bleed-3p` produces **31.9 s** of phantom "me" speech without it and **0** with it;
mic WER on every other fixture is unchanged.

### Choosing the embedding model and thresholds

`node packages/stt/scripts/diarize-bench.ts` (VAD + split + embed + cluster, no ASR). Far-end DER,
250 ms collar, overlapped speech scored, over all seven fixtures:

| embedding | online 0.4 | online 0.7 → re-cluster 0.4 | notes |
| --- | --- | --- | --- |
| **TitaNet-small** (default) | **3.3 %** | 9.2 % → **3.3 %** | right speaker count on every fixture; flat plateau for online thresholds 0.2–0.55 |
| WeSpeaker ResNet34 | 34.6 % | 9.0 % → 34.6 % | a different similarity scale: needs ~0.7 online and no re-cluster at 0.4 |
| CAM++ / ERes2Net / TitaNet-large (sherpa offline diarizer, whole track) | — | — | over-split badly (17–62 %) on the first four fixtures; not catalogued |

Thresholds are specific to the embedding model: change the model, re-run the bench.

### DER baselines (V-3)

`packages/stt/test/diarize.e2e.test.ts` runs the whole pipeline (real ASR too) and gates DER against
committed baselines (`fixtures/baselines/*__diarize_emb=…json`; bands ±0.04 abs / 20 % rel, speaker count
exact, phantom-me ≤ baseline + 500 ms). Current numbers:

| fixture | far-end DER | confusion | all-track DER | speakers found | phantom "me" |
| --- | --- | --- | --- | --- | --- |
| standup-2p | 0.0 % | 0 | 2.3 % | 1/1 | 0 |
| retro-silence-gap | 0.0 % | 0 | 0.0 % | 1/1 | 0 |
| planning-3p-crosstalk | 0.03 % | 0 | 0.9 % | 2/2 | 320 ms (VAD tail, not bleed) |
| librispeech-3p | 11.3 % | 0 | 8.4 % | 2/2 | 0 |
| three-far-4p | 2.6 % | 0 | 4.5 % | 3/3 | 0 |
| crosstalk-bleed-3p | 7.3 % | 0 | 5.1 % | 2/2 | 0 |
| bad-connection-3p | 0.7 % | 0 | 5.0 % | 2/2 | 0 |

Every remaining error is missed speech — VAD (LibriSpeech's quiet onsets) or far-end cross-talk, which one
track cannot carry as two people at once — not confusion. These fixtures are still kind: at most three
far-end voices, distinct recordings per person. Expect confusion on real calls with similar voices,
music, or many participants; the bench and baselines are where to measure it.

Through the real PipeWire path (`packages/e2e/test/attribution-real.e2e.test.ts`): planning 0.0 %,
standup 0.0 %, crosstalk-bleed 7.1 % far-end DER, 0 ms phantom "me", and a voiceprint named in one
meeting recognised the same voice in the next.

### Voiceprints (A-6)

Opt-in (`settings.speakers.voiceprints`, off by default). With it on, each recording's far-end speaker
centroids are kept beside its audio (`voices.json`, 0600); naming a speaker makes (or refines, as a running
mean) the voiceprint of that name, and every new recording is seeded with them — a cluster whose centroid
is ≥ 0.6 cosine to a voiceprint arrives named. Embeddings never leave the machine and never appear in any
API response. Switching it off deletes every voiceprint and every `voices.json`.
