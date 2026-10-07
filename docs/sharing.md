# Team sharing (kacola phase 5)

An agenda shared through the organiser's hosted server: a web link for invitees without kacola, and a
live copy on every attendee's own kacola, all following one agenda. Code: `packages/protocol/src/sharing.ts`
(contracts), `packages/store/src/shares.ts` (the server's rules, pure) + `shares-apply.ts` (rows),
`packages/server/src/sharing.ts` (routes) + `mailer.ts`, `packages/daemon/src/agendas/sharing.ts` (the device
sync) + `share-projection.ts` (the privacy boundary), `packages/web/src/agenda*.ts` (the page).

## Who is who

| role | how they act | may |
| --- | --- | --- |
| **owner** | their own daemon, with the hosted server's pairing token (`KACOLA_SHARE_URL` / `KACOLA_SHARE_TOKEN`, else the hybrid-sync ones) | share, unshare, edit everything, share the recap, moderate |
| **member** | an attendee running kacola whose email the owner listed (`members`): their daemon follows with the link + a magic-link code and keeps a participant token | push their own status changes (person, tracker, agent), add and edit their own items |
| **invitee** | anyone with the link who confirmed an email (magic link), in the browser | add an item (topic or question), comment |
| anyone with the link | the page | read the agenda; outcomes only once the recap is shared |

## The privacy model (L-18)

Sharing never replicates the agenda's log. The device pushes a **projection**, built field by field from
an allow-list in `share-projection.ts`, and the server's push schema is strict (`z.strictObject`): any key
outside the projection is a 400, not silently dropped.

| leaves the device | never leaves |
| --- | --- |
| title; meeting (event UID, start, end, recurring) | transcripts, segments, **evidence** (no quotes and no segment ids — a status says who and when, not what was heard), status notes |
| goals — only with `shareGoals` (off by default: goals are often personal) | private context cards; cards made by the tracker or an agent (always private) |
| items: text, kind, owner, timebox, order, carried-from | suggestions; the session id; the calendar's name; local paths (a card's `path` source) |
| status changes: who (`user` / `tracker` / `agent:<name>` on that device), when, from → to, auto, confidence | notes, voiceprints, Q&A |
| outcomes — only for an occurrence whose recap the owner shared (L-22); un-sharing the recap deletes them on the server | |
| cards the owner marked `shared`: title, body, pinned, a source **URL** | |

Further rules:

- An agenda that is private, or belongs to a private recording, cannot be shared (409). Made private
  after sharing, it is **unshared** on the next sync (the link answers 410).
- **Unshare** (owner): the server deletes every item, change, card, comment and participant, and every
  participant token and code; a tombstone keeps the link answering **410**. Members' daemons detach
  (their local copy stays, marked `revoked`). Deleting the owner's agenda unshares it.
- Secrets — the link token, participant tokens, magic-link codes — are random, shown once and stored only
  as SHA-256 in bookkeeping tables (`share_tokens`, `share_participant_tokens`, `share_codes`), never in an
  event, never over `/events`. Locally they live in `<dataDir>/agenda-shares.json` (0600).
- `decideIngest` (hybrid sync) still **skips** a device's `agenda.*` events and **rejects** `share.*`
  events: a device cannot replicate its agenda log, nor forge server state.
- The page shows people by name or masked email (`i…@example.com`); only the owner sees participants'
  addresses (members get an empty list).

The wire is checked, not assumed: `packages/daemon/test/team-sharing.int.test.ts` runs every byte between
two daemons and the server through a recording proxy and asserts no transcript text, segment or session
id, evidence quote, note, private card or goal is on it (nor in the server's log).

## Merge rules across devices (L-20)

Every status change any device submits reaches the server with an idempotency key and is **recorded**
(`share.change`) with its outcome — nothing is silently lost. Per item (`decideSharedStatus`):

| standing | |
| --- | --- |
| 3 | the owner, in person (`user` on the owner's device) |
| 2 | a member, in person |
| 1 | anyone's tracker or agent |

- `refused` — a change from below the item's lock; or a backwards move by a tracker or agent (forward-only).
- `superseded` — a person's backwards move older (device time) than the status already applied: latest wins.
- `agreed` — the item already had that status (two trackers saw the same thing).
- `applied` — otherwise. A person's backwards move (an override) locks the item at their standing; a
  person's forward move clears the lock — the local "manual wins" rule, across devices.

Each device mirrors the server's verdict into its local agenda attributed `peer:<label>` (a person),
`peer:<label>/tracker`, `peer:<label>/agent:<name>`, or `invitee:<email>` — written only by the sync
(`AgendaStore.mirrorItem/mirrorStatus/mirrorCard`; a request body claiming `peer:` is a 403). A peer's
override in person locks the item locally too, so a device's own tracker stays quiet over the owner's
(or a member's) hand-set status. Push comes before mirror, and an item that changed locally while the
push was in flight is left for the next round. `checkAgendaLog` treats `peer:` changes as the server's
verdicts (they may move either way) and requires them to carry no evidence.

## Recurring meetings and the recap (L-21, L-22)

A share is per **series**: the link stays the same. When the owner's recording stops, the daemon rolls
the series over (carry-over of unresolved items, invitees' and members' included) and the new occurrence
joins the share as `current`; a carried item keeps who added it (`createdBy` copied on the server). A
member's daemon creates its copy of the new occurrence from the server (linked to its own calendar
occurrence when it has the event) and does not roll its copy over by itself. The page opens the current
occurrence and lists the others; a past one shows its recap if the owner shared it
(`PUT /agendas/:id/share/recap {shared}` — per occurrence).

## Contracts

Hosted server (`sharingRoutes`; schemas in `protocol/src/sharing.ts`):

| route | who | |
| --- | --- | --- |
| `POST /shared` | owner | `{ownerName, ownerLabel, options {allowInvitees, members}, occurrence}` → `{share, token}` (token once) |
| `PATCH` / `DELETE /shared/:shareId` | owner | options · unshare (410 afterwards) |
| `POST /shared/:shareId/push` | owner, member | `{ops: ShareOp[]}` (strict) → `{applied, unchanged, refused[], changes[], state}` |
| `GET /shared/:shareId/state` | owner, member | `SharedAgendaState` (items of every occurrence, cards, comments, participants for the owner) |
| `GET /shared/:shareId/changes?occurrence` | owner, member | the merge history, oldest first |
| `POST /shared/:shareId/participants/:id/revoke`, `…/comments/:id/hide` | owner | moderation |
| `GET /shared/link/:token?occurrence` | anyone | `SharedAgendaPage` |
| `POST /shared/link/:token/verify {email, name?}` | anyone | always `{sent: true}`; mails a code only to a listed member or, with invitees allowed, anyone |
| `POST /shared/link/:token/confirm {email, code}` | anyone | `{shareId, participant, token}` — present the token in `x-kacola-participant` |
| `POST /shared/link/:token/items` · `…/comments` | participant | an item (topic / question) · a comment (on an item or the agenda) |

Durable events (hosted only, appended to `DurableEventData`): `share.upserted`, `share.revoked`,
`share.participant.upserted`, `share.item.upserted`, `share.item.deleted`, `share.change`,
`share.card.upserted`, `share.card.deleted`, `share.comment.upserted`. Migration **7 `sharing`** (SQLite,
with its Postgres twin; the lead renumbers at merge).

Abuse limits (`SHARE_LIMITS`): codes expire in 15 min; 3 codes per address per 15 min, 10 per day; 50
codes per link per hour; 5 wrong guesses burn a code; 20 contributions per participant per hour; 100
contributed items and 500 comments per share; 300 items per occurrence. A hit is a **429** with
`retry-after`. Verifying never reveals whether an address may join.

Mailer (`packages/server/src/mailer.ts`): `KACOLA_MAIL_WEBHOOK` (+ `KACOLA_MAIL_WEBHOOK_SECRET`, sent
as a Bearer token) POSTs `{to, subject, text}` to a relay you run; `KACOLA_MAILER=console` logs (dev);
none → the page is read-only and `verify` is a 501. `KACOLA_PUBLIC_URL` sets the base of the links in
emails (default: the request's origin).

## What the window needs (routes on the local daemon)

| route | |
| --- | --- |
| `GET /agendas/:id/share` | `ShareStatus`: `shared`, `role` (owner · member · null), `link` (`https://<host>/a/<token>`), `state` (off · ok · syncing · error · revoked), `error`, `lastSyncAt`, `pending` (local changes not yet pushed), `refused` (changes the merge refused or superseded), `recapShared`, `shareGoals`, `allowInvitees`, `members`, `comments` (invitee and member comments on this occurrence), `participants` (owner) |
| `PUT /agendas/:id/share` | share, or update options: `{ownerName?, shareGoals?, allowInvitees?, members?}` → `ShareStatus` (503 without a host configured; 409 for a private agenda or a member's copy) |
| `DELETE /agendas/:id/share` | owner: unshare; member: stop following (the copy stays) |
| `PUT /agendas/:id/share/recap {shared}` | owner: share / un-share this occurrence's recap |
| `POST /agendas/:id/share/sync` | push and pull now ("Sync now") |
| `GET /agendas/:id/share/history` | `SharedChange[]`: every change from every device with `actor {label, name, role, by}`, `outcome` (applied · agreed · refused · superseded), `reason`, `before → after` |
| `POST /agendas/follow {link, email, name?}` → `{pending, expiresAt}`; `POST /agendas/follow/confirm {link, email, code}` → `ShareStatus` (its `agendaId` is the local copy) | follow someone's agenda |

- Ephemeral `agenda.share {agendaId, status}` on `/events` whenever a sync finishes or sharing changes:
  refetch nothing, just render `status`.
- Contributions arrive in the agenda itself: items with `createdBy: invitee:<email>` or `peer:<label>`,
  status changes with `changedBy` / history `by` in the same forms (render `peer:ben@x.com/tracker` as
  "Ben's tracker"). Comments are not agenda entities: they are in `ShareStatus.comments`.
- `agendaInviteBlock` now carries `web: <link>` once the agenda is shared (no web link before).
- Owner-only routes refuse an agent's lease token (403), like the rest of the owner surface.

Configuration (daemon): `KACOLA_SHARE_URL`, `KACOLA_SHARE_TOKEN` (default the `KACOLA_SYNC_*`
ones), `KACOLA_OWNER_NAME`, `KACOLA_OWNER_EMAIL` (your `peer:` label on others' devices),
`KACOLA_AGENDA_WEB_BASE` (the link's base, default the host), `KACOLA_SHARE_POLL_MS` (default 15 000),
`KACOLA_SHARE_DEBOUNCE_MS` (default 500).

## The window, the CLI and MCP (L-23…L-27)

**Window** (`packages/desktop/src/renderer/features/agendas/share*.tsx`, `follow.tsx`; docs/desktop-app.md,
"Team sharing"): the agenda editor's **Share…** button opens the Share dialog (your name, invitees may add
items and comment, share the goals too — off —, attendees who use kacola), then the link with **Copy Link**,
the sync state and its error, **Sync Now**, **Unshare…** (confirmed). A **Sharing** tab appears while the
agenda is shared or followed: comments, people (owner), the merge history (each change with who made it,
its outcome and why). Invitee and peer contributions are attributed in place: "added by Ivy
(ivy@example.com)" with the comment under the item, "marked by Ben", "by Ben's tracker", "checked by Ben's
Claude" — in the status chips, the history popover and the live panel. The recap has **Share recap**.
**Follow a shared agenda**: the sidebar's Coming up, the main menu, or a `https://…/a/<token>` link handed
to the app (main accepts https, or http on loopback, and the renderer opens the dialog prefilled) — link +
email → the emailed code → the local copy opens. The EventBridge folds the ephemeral `agenda.share` into
`['agendaShare', id]` (nothing refetched; a merge history on screen refetches).

**CLI** (`packages/cli/src/commands/agenda-share.ts`; all `--json`): `agenda share <agenda> [--name N]
[--members a@x,b@y] [--goals] [--no-invitees]`, `agenda unshare`, `agenda share-status`, `agenda
share-recap [--off]`, `agenda share-history`, `agenda follow <link> --email E [--name N]`, `agenda
follow-confirm <link> --email E --code C`. The invitation block moved to `agenda invite [--write|--remove]`
(`agenda share --write` is a usage error that says so). Exit codes: 6 no sharing host (503), 1 refused (409:
a private agenda, someone else's copy, history of an unshared agenda), 5 a wrong or expired code (403), 2
usage. **MCP**: `agenda_share_status`, `agenda_share_history` — reads only; sharing stays the user's act.
The skill's "Prepare a meeting" offers to share only on the user's say-so.

## The page (L-19)

`https://<host>/a/<token>` (a Vercel rewrite to `agenda.html`): the kacola tokens (light, dark, high
contrast, reduced motion), the two brand typefaces, landmarks, labelled lists and fields, statuses as
words (never colour alone), everything people wrote escaped (no markdown, no HTML; card sources linked
only for http(s)). It refreshes every 20 s (never under someone typing). Contributing: email → code (or
the magic link `#verify=<email>/<code>`) → add an item or a comment; the participant token is kept in
localStorage per link. A quiet line at the foot says what made it.

## Verification

| claim | test |
| --- | --- |
| the merge rule (table); random multi-device histories: every distinct pushed change recorded exactly once, outcomes by the rules (checked independently), items = fold of applied changes, carried items keep their author, outcomes only with a shared recap, no secret in the log, replay == state; revoke purges everything; abuse limits; `decideIngest` rejects `share.*` | `packages/store/test/shares.test.ts` |
| the same history on SQLite, PGlite and a real Postgres 17 (podman): byte-identical logs, equal snapshots; replays both ways | `packages/store/test/contract/shares-dialect.int.test.ts` |
| HTTP: owner vs participant auth, strict projection (evidence/notes refused), verify reveals nothing, 429, 501 without a mailer, 410 after unsharing, participant removal | `packages/server/test/sharing.test.ts`, `app.test.ts`, `auth.test.ts` |
| the device projection never contains evidence, notes, private/agent cards, goals (unless opted in), the session or the calendar; passes the strict schema; idempotent | `packages/daemon/test/share-projection.test.ts` |
| **two daemons + the hosted server (PGlite and real Postgres)** following one recurring agenda: share, follow by magic link, invitee item + comment, per-item merges attributed (applied / refused / agreed), nothing lost, local "manual wins" across devices, recap only when shared, carry-over into the next occurrence on the same link and the attendee following it, the wire assertion, private → unshared, unshare → 410 and an empty server | `packages/daemon/test/team-sharing.int.test.ts` |
| the page in headless Chrome against the Vercel build: content, landmarks, light/dark, invitee code flow (wrong code refused), item + comment seen by the owner, magic link, recap, unshared | `packages/vercel/test/agenda-web.e2e.test.ts` |
| the CLI verbs through real daemons and a local hosted server (PGlite): goldens, exit codes 6 / 1 / 5 / 2, the merge history with a refused change, recap on/off on the page, unshare → 410 and the follower revoked; MCP lists only the two read tools | `packages/e2e/test/cli-agenda-share.int.test.ts`, `__golden__/agenda-{share,share-status,follow,follow-confirm,share-history,share-recap,unshare}.json` |
| the window: share + copy link, an invitee's item and comment attributed, follow from Coming up (a wrong code refused), a refused change in the merge history, Share recap reaching the link, unshare (confirmed) → 410 and the follower's banner; axe in light / dark / high contrast; baselines `sharing-*` ≤ 1 % | `packages/e2e/test/desktop-sharing.e2e.test.ts` |
| the screens' logic (jsdom): options sent, link + copy, `agenda.share` re-rendering, unshare confirmation, no host, attribution of invitee / peer / peer tracker / peer agent, comments, the merge history entries, revoked banner, recap switch, the follow flow and a share link handed to the app | `packages/desktop/test/agendas.test.tsx` (team sharing), `event-bridge.test.ts`, `deep-link.test.ts`, `packages/ui-core/test/agendas.test.ts` |
| the atlas: window states (`agenda-share__*`, `agenda-team__shared__teammate-items` with a peer agent's check-off) and the page (`agenda-invitee__web__*`) | `packages/e2e/test/atlas.e2e.test.ts`, `packages/vercel/test/atlas-web.e2e.test.ts` |
| every route schema-valid (daemon and hosted) | `packages/daemon/test/contract.test.ts`, `packages/server/test/app.test.ts` |

## Not done / limits

- Member edits of other people's items (text) are not supported; members add and edit their own.
- A member's daemon that already built its own agenda for the next occurrence by carry-over (outside the
  share) would push those carried items as its own; the follower filter only stops the automatic roll-over.
- The public page polls (20 s); there is no SSE for anonymous readers.
- Rate limits count rows in the store (fine for a team; a public, viral link wants a firewall rule too).
