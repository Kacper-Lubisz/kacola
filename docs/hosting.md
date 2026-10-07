# Hosting kacola remotely (M8)

The local build needs none of this: `kacolad` on loopback, no tokens, everything on the laptop. This
document is for putting your meetings somewhere else too — your phone, a browser, a second machine —
and it follows the plan's "Hosting it remotely" section.

## Topologies

| | capture | transcription | what leaves the laptop | cost per minute |
| --- | --- | --- | --- | --- |
| **local** (default) | laptop | laptop | nothing | 0 |
| **hybrid sync** (recommended) | laptop | laptop | transcripts, notes, Q&A of non-private sessions | 0 |
| **full offload** | laptop (`kacola-agent record`) | cloud STT on the server (Deepgram) | the audio | the provider's |
| **remote daemon** | the daemon's machine | the daemon's machine | — (clients reach it over the network with a token) | 0 |

Capture never moves (PipeWire lives on the laptop); that half is `packages/capture-agent`. Everything
else — sessions, transcripts, search, the event stream — is the protocol, served by the local daemon or
by the hosted server (`packages/server`), which answers the same route table from the async `StoreApi`
over SQLite or Postgres.

## Packages

| package | role | may import (production code) |
| --- | --- | --- |
| `server` | hosted server as a `(Request) => Response` app + a Node adapter | protocol, store (core/pg/blob; SQLite only for self-hosting), `stt/cloud` |
| `capture-agent` | local half: capture + chunked upload; the hybrid-sync pusher | protocol, capture |
| `web` | read-only web viewer (static SPA) | protocol |
| `vercel` | the server + viewer as a Vercel deployment | server, store (pg/blob/core), `stt/cloud`, protocol |

`pnpm boundaries` enforces these (`LAYER_RULES` in `scripts/check-boundaries.ts`).

## Pairing auth (H-6)

Loopback stays anonymous; every remote request needs a device token — on every route, `/events`
included. The only routes an unpaired device can reach are the two it uses to get a token.

The flow is a device code (RFC 8628 shaped):

1. the new device: `kacola pair --url https://you.example` → prints a code like `BDFG-HJKL` and waits;
2. a trusted party approves it: `kacola pair approve BDFG-HJKL` on the machine running the daemon
   (loopback needs no token), or with an owner/paired token, or in the web viewer at `…/#/pair/BDFG-HJKL`;
3. the new device receives its token once; the CLI saves it in `${XDG_CONFIG_HOME:-~/.config}/kacola/hosts.json`
   (0600) and uses it for that URL from then on. `kacola pair token --url …` prints it (e.g. for
   `KACOLA_SYNC_TOKEN`); `KACOLA_TOKEN` / `--token` override it; the GTK app reads the same file.

Tokens are `gnm1.<payload>.<HMAC-SHA256>` over {device id, issued-at}, signed with the server's secret;
a token is valid only while its device row exists and is not revoked, so revocation
(`kacola pair revoke dev_…`, `POST /pair/revoke`) is immediate. Device
codes are stored only as SHA-256 and expire after ten minutes. "Loopback" means a loopback socket AND a
loopback `Host` AND no `X-Forwarded-For`/`Forwarded` header — a reverse proxy on the same machine does not
make its callers anonymous. Browsers: cross-origin requests are refused; the viewer is same-origin.

### Letting the local daemon accept remote devices

```sh
kacolad --host 0.0.0.0 --remote      # --remote = pairing auth on; the secret is created in <data-dir>/auth-secret
kacola pair approve BDFG-HJKL        # on this machine, when a device asks
```

Without `--remote` (or `KACOLA_AUTH_SECRET`), `kacolad` still refuses any non-loopback `--host`.

## Hybrid sync (H-7) — the recommended hosted mode

```sh
kacola pair --url https://you.example                    # once, on the laptop
KACOLA_SYNC_URL=https://you.example \
KACOLA_SYNC_TOKEN=$(kacola pair token --url https://you.example) kacolad
# or, beside an existing daemon:  kacola-agent sync --remote https://you.example --token …
```

The daemon (or `kacola-agent sync`) reads its own `/events` and POSTs `/sync/push`. Each pushed item
carries the **device's** seq; the server keeps a cursor per device and, in one transaction, skips items at
or below it, applies the rest and advances it. So a push is idempotent (a lost response is simply pushed
again) and resumable (after any restart the agent asks for its cursor and continues).

What syncs: sessions (local audio paths blanked), segments, per-session Q&A, notes versions, and who
spoke (M3 speakers, renames, merges, attributions — with the voiceprint link blanked).
What never does: private sessions, audio, **voiceprints** (biometric: the agent never sends them and the
server skips them even if pushed), settings, notes templates, cross-session Q&A (an answer may quote a
private meeting).

**Conflict rules** (`decideIngest` in `packages/store/src/domain.ts`, one pure function used by both
dialects):

- The hosted store is a replica and every session has one writer: the device that recorded it. Items
  are applied verbatim, keeping the device's segment revisions.
- A segment revision at or below the stored one is a no-op (re-pushes, snapshots).
- Anything that would break a store invariant (a segment or note for an unknown session, final → live,
  a track change, a mic segment not attributed to `me`) is rejected, reported back in `rejected`, and
  does not stop the rest of the batch; the cursor moves past it.
- Notes versions are append-only: a version number already present is a no-op.
- Speaker merges and attributions apply only when their session and every speaker they name exist.
- Deleting an absent session is a no-op. Settings and templates are device-local and skipped.
- Privacy is followed, not just filtered: making a synced session private pushes a delete; making it
  public again pushes a snapshot of its current state (split across pushes with `partial` when large).
- Edits made on the server (a rename through the API) are overwritten by the device's next update of
  that session: the device wins.

## Full offload (H-2, H-3, H-8)

```sh
kacola-agent record --remote https://you.example --token … --title "Standup"   # Ctrl-C to stop
kacola-agent resume --remote … --session ses_… --duration-ms N                  # after a crash
```

The agent records through the same capture code as the daemon (the WAVs are still written locally),
and uploads 5 s chunks of 16 kHz s16le as `PUT /sessions/:id/audio/chunks/:chunkSeq` — the k-th chunk of
the mic is seq 2k, of the far end 2k+1, so the numbering is recomputable from the WAVs. A byte-identical
retry is a no-op; different bytes under the same seq are a 409. `GET /sessions/:id/audio` lists what
arrived, so resuming sends only the rest. `POST …/audio/finalize` (with per-track chunk counts) refuses
while anything is missing, assembles per-track WAVs byte-exact, and — with `DEEPGRAM_API_KEY` set —
transcribes them (the far end with provider diarization → `speaker-1`, `speaker-2`, …; the mic is `me`).
Finalize is idempotent and resumable per track (a function killed mid-transcription redoes only the
unfinished track).

## Postgres and blobs (H-1)

`@kacola/store/pg` is the Postgres dialect: the same migrations (versions and names must match the
SQLite list — a test enforces it), the same single-writer rule (every commit takes the counter row
`FOR UPDATE` before reading state, so seq is gap-free and commits become visible in seq order), and a
mapping of FTS5 search onto a normalised `tsvector` (same query affordances; snippets computed in JS).
The one store contract suite runs on SQLite, on PGlite, and on a real Postgres 17 in podman when present;
a cross-dialect test drives both with the same history and requires byte-identical logs and results.

`@kacola/store/blob`: `FsBlobStore`, `VercelBlobStore` (private blobs, stable keys), `MemoryBlobStore`.

## Vercel (H-5)

`packages/vercel` builds a [Build Output API v3](https://vercel.com/docs/build-output-api) directory:

- `static/` — the web viewer;
- three Node functions (one esbuild bundle each, `nodejs22.x`, response streaming):
  - `api` (30 s) — every JSON route,
  - `events` (300 s) — `GET /events`; each stream ends itself 15 s before the cap and clients resume by
    cursor (`Last-Event-ID` / `?since=`),
  - `finalize` (300 s) — full-offload assembly + cloud transcription;
- `config.json` routing the protocol paths to them.

A stream opened without `since` ("new events only") starts with a data-less `id: <seq>` line naming
where it began; the protocol client adopts it as its cursor, so even a subscriber that has not yet seen
an event resumes exactly after a cap.

The event stream on a stateless host is the log itself: it pages `seq > cursor` from Postgres and polls
(`KACOLA_POLL_MS`, default 1 s). There is no replay→live seam to get wrong, and the exactness of resume
rests on the commit-order property above. V-8 proves it with a 150 ms cap and random byte cuts on SQLite,
PGlite and a real Postgres (`packages/server/test/sse-fuzz*.test.ts`), and through the built functions in
a harness that hard-kills responses at `maxDuration` (`packages/vercel/test/vercel.int.test.ts`).

### Deploying

Nothing in this repository deploys or logs in on its own. To deploy:

1. Create a Vercel project with **Root Directory** `packages/vercel` (the `vercel.json` there sets the
   install and build commands; the build emits `.vercel/output`, which Vercel uses as is).
2. Add storage: a **Neon** Postgres database (the integration sets `DATABASE_URL`/`POSTGRES_URL`) and a
   **Blob** store (sets `BLOB_READ_WRITE_TOKEN`; only needed for full offload).
3. Set environment variables:

   | variable | |
   | --- | --- |
   | `KACOLA_AUTH_SECRET` | required; ≥ 32 random characters (`openssl rand -hex 32`). Without it every request is refused (503). |
   | `KACOLA_ADMIN_TOKEN` | required in practice; ≥ 16 characters; the owner credential that approves the first device |
   | `DEEPGRAM_API_KEY` | optional; enables full-offload transcription |
   | `KACOLA_POLL_MS` | optional; event-stream poll interval (default 1000) |
   | `KACOLA_MAIL_WEBHOOK` | optional; team sharing: where magic-link codes are POSTed (`{to, subject, text}`); without it shared pages are read-only |
   | `KACOLA_PUBLIC_URL` | optional; base of the links in those emails (default the request's origin) |

4. Deploy: push to the connected Git repository, or from a checkout:
   ```sh
   cd packages/vercel
   vercel pull                      # links the project, fetches env (needs your login)
   vercel build                     # runs scripts/build.ts → .vercel/output
   vercel deploy --prebuilt         # preview; add --prod for production
   ```
   (`vercel build` also works offline without a login, given a `.vercel/project.json`; that is how it
   was checked here. `node scripts/build.ts` produces the same output.)
5. Pair your first device with the admin token: on the laptop `kacola pair --url https://…`, then
   approve it with `KACOLA_TOKEN=<admin token> kacola pair approve CODE --url https://…`. Open the
   URL in a browser, and approve the browser's code the same way (or from the paired laptop).
6. Smoke-test the preview: `KACOLA_PREVIEW_URL=… KACOLA_PREVIEW_ADMIN_TOKEN=… pnpm test:e2e
   packages/vercel/test/preview.e2e.test.ts` (add `VERCEL_AUTOMATION_BYPASS_SECRET` for a protected
   preview, `KACOLA_PREVIEW_WRITE=1` to round-trip a throwaway session).

Migrations run on the first request of a cold instance, under a Postgres advisory lock.

### Self-hosting without Vercel

`kacola-server --host 0.0.0.0 --db postgres://… --blobs /srv/kacola/blobs` with
`KACOLA_AUTH_SECRET` (it refuses a non-loopback host without it). `--db sqlite:/path` works for a
single box.

## Team sharing

The hosted server also holds shared agendas (only agendas — never transcripts): the organiser's daemon
pushes a strict projection, attendees' daemons follow with a magic-link code, invitees use the page at
`/a/<token>`. Everything — privacy model, merge rules, routes, limits — is in [docs/sharing.md](sharing.md).
On Vercel set `KACOLA_MAIL_WEBHOOK` (a relay that sends `{to, subject, text}`; optional
`KACOLA_MAIL_WEBHOOK_SECRET`) to let invitees contribute, and `KACOLA_PUBLIC_URL` if links in emails
should not use the request's origin. Without a mailer shared pages are read-only.

## Known limits

- `/pair/start` is necessarily anonymous and writes a row per call (expired rows are purged on the next
  call). Put a rate limit in front of it (Vercel Firewall rule on `/pair/start`) on a public deployment.
- Any paired device can approve another device, and every token has full read + sync rights; there are no
  scopes yet. Revoke a lost device with `kacola pair revoke dev_…` (immediate).
- Finalize assembles a session's audio in memory (≈ 115 MB per track-hour); very long full-offload
  recordings want the function's memory raised.

## What the hosted server does not do (v1)

Start/stop recording, devices, models, settings, the API key, Q&A (`/ask`), notes enhancement and
edits, templates and calendars answer a typed **501** (`calendarStatus` reports `off`): those belong to
the device that records. The viewer is read-only (a shared agenda page takes invitee items and comments — docs/sharing.md).
