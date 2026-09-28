# gnomeola

A GNOME-native meeting recorder and transcriber. It records a meeting from your own machine — your
microphone and your speakers as two separate tracks — transcribes it live, attributes who spoke, and
answers questions about what was said. The transcript is reachable from a libadwaita window and from a
CLI designed to be used by Claude.

> **Inspired by [Granola](https://www.granola.ai/).** gnomeola is an independent, clean-room project built
> from publicly described behaviour. It contains no Granola code, assets or branding, and is not affiliated
> with or endorsed by Granola.

## Shape

One local backend (`gnomeolad`) and several clients that may only talk to it over a wire protocol:

| package | what it is |
| --- | --- |
| `protocol` | zod schemas, event envelope, route table, typed client. The only package clients may import. |
| `daemon` | the local backend: HTTP + SSE, orchestrates everything below |
| `capture` | PipeWire dual-track capture (local only) |
| `stt` | live + final speech-to-text tiers, VAD, model manager, segment reconciler |
| `store` | SQLite + FTS5 via kysely |
| `llm` | transcript Q&A with prompt caching |
| `cli` | `gnomeola(1)` — agent-facing, JSON-first, retrieval rather than dumping |
| `ui` | the GTK4 / libadwaita app, in React via GTKX |
| `testkit` | fixtures, invariants, cassettes, the PipeWire rig |

The client/backend boundary is enforced in CI (`pnpm boundaries`).

## Development

Requires Node 24+ (`mise install` picks it up from `mise.toml`), pnpm, PipeWire, GTK 4.20+ and
libadwaita 1.8+.

```sh
pnpm install
pnpm check        # boundaries + lint + typecheck + unit/contract + integration (the blocking gate)
pnpm test:e2e     # real PipeWire rig, real models, real UI — slow
pnpm test:eval    # accuracy baselines and live-LLM evals — opt-in
```

## Licence

GPL-3.0-or-later. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
