# kacola

A GNOME-native meeting recorder and transcriber. It records a meeting from your own machine — your
microphone and your speakers as two separate tracks — transcribes it live, attributes who spoke, and
answers questions about what was said. The transcript is reachable from a desktop window (Electron; the
working brand is **kacola**), the GNOME top bar, and a CLI designed to be used by Claude.

> **Inspired by [Granola](https://www.granola.ai/).** kacola is an independent, clean-room project built
> from publicly described behaviour. It contains no Granola code, assets or branding, and is not affiliated
> with or endorsed by Granola.

## Shape

One local backend (`kacolad`) and several clients that may only talk to it over a wire protocol:

| package | what it is |
| --- | --- |
| `protocol` | zod schemas, event envelope, route table, typed client. The only package clients may import. |
| `daemon` | the local backend: HTTP + SSE, orchestrates everything below |
| `capture` | PipeWire dual-track capture (local only) |
| `stt` | live + final speech-to-text tiers, VAD, model manager, segment reconciler |
| `store` | kysely: SQLite + FTS5 locally, Postgres (Neon/PGlite) hosted; BlobStore (FS / Vercel Blob) |
| `llm` | transcript Q&A with prompt caching |
| `cli` | `kacola(1)` — agent-facing, JSON-first, retrieval rather than dumping |
| `desktop` | the window: Electron (main supervises the daemon, a fetch tunnel; React renderer). [docs/desktop-app.md](docs/desktop-app.md) |
| `ui-core` | the window's data layer: pure folds and view logic over the protocol |
| `testkit` | fixtures, invariants, cassettes, the PipeWire rig |
| `server` | the hosted server: the same protocol over Postgres, pairing auth, hybrid sync, chunked audio |
| `capture-agent` | the local-only half: capture + resumable upload (full offload), and the hybrid-sync pusher |
| `web` | the read-only web viewer (a protocol client) |
| `vercel` | the hosted server + viewer as a Vercel deployment (Build Output API) |

The client/backend boundary and the hosted layers are enforced in CI (`pnpm boundaries`). Hosting it
remotely — hybrid sync (recommended), full offload, pairing, Vercel — is in [docs/hosting.md](docs/hosting.md).

## Development

Requires Node 24+ (`mise install` picks it up from `mise.toml`), pnpm and PipeWire (`pw-record`,
`pw-dump`); ffmpeg for archiving. The window is Electron, which `pnpm install` downloads — no GTK,
libadwaita or GtkSourceView needed any more. The e2e tier also needs GNOME Shell 50, `dbus-daemon`,
`at-spi2-core` and PyGObject (the headless test display), and gjs + evolution-data-server for the calendar.

```sh
pnpm install
pnpm check        # boundaries + lint + typecheck + unit/contract + integration (the blocking gate)
pnpm test:e2e     # real PipeWire rig, real models, the real window in a headless GNOME Shell — slow
pnpm test:eval    # accuracy baselines and live-LLM evals — opt-in
pnpm --filter @kacola/desktop dev   # the window with HMR, against a running daemon
```

## Install and packages

```sh
scripts/install.sh              # per user: the daemon (systemd), `kacola` CLI + Claude skill, the top-bar
                                # extension (never enabled), and the Electron app with its desktop entry
scripts/install.sh --uninstall  # removes all of it; recordings stay unless --purge
node scripts/build-desktop.ts   # dist/desktop/linux-unpacked: the packaged Linux app
node scripts/build-flatpak.ts   # dist/flatpak/kacola.flatpak (com.kacperlubisz.Kacola, Freedesktop 25.08 +
                                # Electron BaseApp; needs flatpak-builder)
node scripts/build-macos.ts     # dist/macos/out/*.zip, arm64 + x64, unsigned (sign on a Mac to run arm64)
```

The Flatpak and the macOS app bundle the daemon and the CLI; on first run they offer to install the
`kacola` command and the Claude skill. Details: [docs/desktop-app.md](docs/desktop-app.md).

### Upgrading from gnomeola

kacola was called gnomeola before 0.2. `scripts/install.sh` over a gnomeola install switches it over, but
only while nothing is recording (it refuses with exit 3 otherwise, `--force` or not): it replaces the
`gnomeolad` service with `kacolad`, the launchers and desktop entry with the kacola ones, and keeps
`gnomeola` as an alias that prints a deprecation note. On its first start `kacolad` moves
`~/.local/share/gnomeola` to `~/.local/share/kacola` (one rename, or a verified copy across filesystems;
the old path becomes a symlink) and renames `gnomeola.db` to `kacola.db`. It refuses, and moves nothing,
while an old daemon still runs or when both directories hold data. The window moves its own settings on
its first start, and keys stored under the `gnomeola` keyring entry move on first use. `GNOMEOLA_*`
variables are read as `KACOLA_*`, with a warning. All of this stays for one release.

By hand: switch the top-bar extension on again from the window (the home screen's card, or Preferences ›
Integration), then log out and back in (the old extension keeps working until then), and allow
`Bash(kacola:*)` in Claude Code's settings for the skill.

## Licence

GPL-3.0-or-later. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
