# Agendas (kacola phases 1–2)

What the agenda core is, the contracts later waves build on (the live tracker, the agent channel, the
window, team sharing), and the tests behind each claim. Code identifiers stay `gnomeola`; user-facing
deep links already use the `kacola://` scheme.

The rules everything below serves:

- **One agenda per calendar occurrence.** A recurring meeting has one per instance; a new instance is
  seeded with the previous instance's unresolved items (carry-over).
- **Items move forward only** — `open → in-progress → covered | skipped | parked`. The user may move an
  item anywhere (an *override*); an automated changer (the tracker, an agent) then may not change it
  again ("manual wins"). Every change records who made it and lands in the history.
- **Private stays private.** An agenda marked private, or linked to a private recording, is invisible to
  the CLI, the skill and MCP unless `includePrivate` (the window passes it). Context cards are private by
  default; sharing one is a deliberate act.
- **Suggestions never change the agenda by themselves.** Accepting one does.

## Data model (`packages/protocol/src/agendas.ts`)

| entity | key fields |
| --- | --- |
| `Agenda` | `id` (`agd_…`), `title`, `meeting: AgendaMeeting \| null`, `sessionId`, `owner`, `goals[]`, `private`, `carriedFrom`, `version`, timestamps |
| `AgendaMeeting` | `eventUid` (iCalendar UID), `start`, `end`, `recurrenceId`, `meetingId` (`mtg_…`), `title`, `calendar`, `recurring` |
| `AgendaItem` | `id` (`itm_…`), `text` (one line), `kind` (topic · question · must-cover · decision · info-to-get · competency), `owner` (me · them · a name), `timeboxMin`, `order`, `status`, `evidence[]`, `outcome`, `changedBy`, `createdBy`, `carriedFrom` |
| `StatusChange` | `itemId`, `from`, `to`, `by`, `at`, `note`, `evidence[]`, `override`, `auto`, `confidence` |
| `Evidence` | `segmentId` (null when typed by a person), `quote`, `confidence` |
| `ContextCard` | `id` (`ctx_…`), `title`, `body` (markdown, ≤ 20 000 chars), `source {kind: user·path·url·session·agent, ref}`, `visibility` (private default · shared), `pinned`, `createdBy` |
| `Suggestion` | `id` (`sug_…`), `kind` (next-point · question · missed · fact-check · looks-covered), `text`, `itemId`, `source` (tracker · `agent:<name>`), `expiresAt`, `state` (open · accepted · dismissed), `resolvedBy` |
| `AgentLease` | `id` (`lse_…`), `sessionId`, `agendaId`, `name`, `mode` (observe · suggest · act), `expiresAt`, `heartbeatAt` — token only in `LeaseGrant`, once |

`changedBy` is `user` (the owner: the window, the CLI, their own Claude preparing with them), `tracker`,
`agent:<name>` or `invitee:<email>`.

The occurrence key: a recurring event's occurrence is its `recurrenceId` (or start); a one-off is its UID
alone, so moving a one-off never makes a second agenda. `resolved` statuses (not carried over) are
`covered` and `skipped`; `parked` is terminal for this meeting but rolls to the next one.

## Durable events

All appended at the end of `DurableEventData`. Each carries the **full post-state** it writes, and each
agenda-scoped one the agenda's new `version` and the time, so applying an event never reads state — one
list of statements (`packages/store/src/agendas-apply.ts`) applies it on SQLite and Postgres alike.

| event | writes |
| --- | --- |
| `agenda.upserted {agenda}` | create, header change (title, goals, privacy, meeting link, session link) |
| `agenda.deleted {agendaId}` | the agenda and everything hanging off it |
| `agenda.item.upserted {agendaId, version, at, item}` | add / edit (text, kind, owner, timebox, outcome; never status) |
| `agenda.item.status {…, item, change}` | a status change + its history row |
| `agenda.item.deleted {…, itemId}` | the item and its history |
| `agenda.items.reordered {…, itemIds}` | positions (the full order) |
| `agenda.context.upserted {…, card}` / `agenda.context.deleted {…, cardId}` | context cards |
| `agenda.suggestion.upserted {agendaId, suggestion}` | create or resolve (does not bump `version`) |

`session.deleted` also unlinks the session's agendas and **drops every evidence quote** taken from its
transcript (items and history), so nothing of a deleted meeting's words survives in an agenda.

Ephemeral (appended to `EphemeralEventData`): `agent.presence {leaseId, name, mode, state:
connected·reading·disconnected}` — emitted by the agent-channel wave.

Hosted sync: agenda events are device-local for now (`decideIngest` skips them, the sync agent does not
push them, the hosted server answers the agenda routes 501). Team sharing decides what an invitee may see.

## Store (`packages/store/src/agendas.ts`, `agendas-apply.ts`)

Migration **6 `agendas`** (SQLite, STRICT) with its Postgres twin of the same version and name
(`src/pg/migrations.ts`; the M8 parity test enforces it): `agendas`, `agenda_items`,
`agenda_item_history` (keyed by agenda + the version the change produced), `agenda_context`,
`agenda_suggestions`. Keys and indexed columns plus a JSON `data` column; flags are integers in both
dialects. No foreign key to `sessions`: an agenda belongs to the occurrence and outlives its recording.
The lead renumbers at merge; tests never hard-code the version.

`AgendaStore` (over the local `Store`) holds the domain rules: `create` (one transaction; carry-over;
refuses a second agenda for an occurrence), `update`, `attachSession`, `addItems` (an item may arrive with
a status — recorded as a change), `updateItem`, `deleteItem`, `reorder`, **`setStatus`** (the forward-only
/ override / manual-wins rules, evidence accumulation), context and suggestions (`resolveSuggestion`:
accepting `looks-covered` covers the item as the acceptor), `importMarkdown`, reads (`view`, `list`,
`history`, `forOccurrence`, `previousOccurrence`, `bySession`, `isVisible`). `DomainSnapshot` gains
`agendas`, `agendaItems`, `agendaHistory`, `agendaContext`, `agendaSuggestions` on both dialects.

## Daemon (`packages/daemon/src/agendas/`)

`AgendaService` — everything that needs the calendar or the recording:

- **create** from `meetingId`, or `eventUid` (+ `start`; without it the current-or-next occurrence), or
  unlinked with a title; `markdown` fills title/goals/items; recurring meetings carry over from the
  previous occurrence unless `carryOver: false`; `ifExists: 'reuse'` hands back the existing agenda.
- **attach**: when a session with a calendar meeting starts recording, its agenda gets the `sessionId`
  (also at creation if recording is already under way).
- **roll over**: when that recording stops, a recurring meeting's unresolved items go to the next
  occurrence (its agenda is created, seeded by carry-over, if it has none).
- **recap hook**: `daemon.agendas.onRecap(({agenda, session}) => …)` — called once per linked recording
  when it stops. No LLM here; the recap wave plugs in.
- **`resolveMeetingLink(eventUid, start)`** / `resolveLink({link})`: what a deep link opens.
- **invite block**: `inviteBlock(id, {write, remove})` through `CalendarService.editDescription`.

The web link base is `DaemonOptions.agendaWebBase` or `GNOMEOLA_AGENDA_WEB_BASE` (`<base>/a/<id>`); unset,
blocks carry only the `kacola://` link.

## Routes (`agendaRoutes`)

| route | |
| --- | --- |
| `GET /agendas` `listAgendas` | `?eventUid&sessionId&since&limit&includePrivate` → summaries with counts |
| `POST /agendas` `createAgenda` | `CreateAgendaBody` → `AgendaView` (201) |
| `POST /agendas/resolve` `resolveAgendaLink` | `{link \| eventUid+start, create?, includePrivate?}` → `{agenda, meeting, live, created}` |
| `GET/PATCH/DELETE /agendas/:id` | view (`?includePrivate`) · header + relink (`baseVersion`) · delete |
| `GET /agendas/:id/history` | every `StatusChange`, oldest first |
| `POST /agendas/:id/items` · `PATCH/DELETE /agendas/:id/items/:itemId` | add (`before`) · edit · remove |
| `POST /agendas/:id/items/:itemId/status` | `{status, by?, evidence?, note?, outcome?, auto?, confidence?}` → `{item, change}` (409 on a refused move) |
| `PUT /agendas/:id/order` | full order |
| `GET/PUT /agendas/:id/markdown` | export `{markdown, version}` · import `{markdown, baseVersion, mode: replace\|merge}` |
| `POST /agendas/:id/context` · `PATCH/DELETE …/context/:cardId` | context cards |
| `POST /agendas/:id/suggestions` · `…/:suggestionId/accept` · `…/dismiss` | suggestions |
| `POST /agendas/:id/invite` | `{write?, remove?}` → `{block, appLink, webLink, written, reason}` |
| `POST /sessions/:id/leases` · `POST /leases/:leaseId/heartbeat` · `DELETE /leases/:leaseId` · `GET /sessions/:id/live` (SSE of `LiveEvent`) | **contract only**: 501 until the agent-channel wave |

`by` is taken from the body today (loopback trust, like every other route); binding `agent:<name>` to a
lease token is the agent-channel wave's job.

## Deep links and the invitation block (`agendas-links.ts`)

- `kacola://agenda/<id>`, `kacola://meeting/<uid>?start=<iso>` (one occurrence), `kacola://meeting/<uid>`
  (a series: its current or next occurrence). `formatAgendaLink`, `formatMeetingLink`, `parseKacolaLink`.
- The block: `-- kacola agenda --` / `Agenda: kacola://… · web: https://…` / `-- /kacola --`.
  `upsertInviteBlock` appends it after the organiser's text (never changing it) or replaces only what lies
  between our markers (idempotent); `removeInviteBlock` takes it out. A series gets the series link, a
  one-off its agenda link.
- **Write path**: `CalendarProvider.editDescription?` — only EDS implements it. cal-agent protocol **2**
  adds `read-description` / `write-description` (compare-and-swap on the current description, one retry on
  a conflict); a series is edited on its master so every occurrence carries the block, detached instances
  keep their own text. Refused, with a reason the user can act on: read-only calendars, events the user
  does not organise, providers that cannot write (ICS, a JSON file) — the block is then returned to paste.
- **App side** (the UI wave): register `x-scheme-handler/kacola` (desktop file, Flatpak), macOS
  `CFBundleURLTypes`, `setAsDefaultProtocolClient` in dev; hand the URL to `resolveAgendaLink` with
  `includePrivate: true` (and `create: true` to offer creation); `live: true` → offer Join and record.

## The markdown form (`agendas-markdown.ts`)

```markdown
# 1:1 with Ana

## Goals
- agree the promo timeline

## Items
- [ ] Promo timeline (10m, @ana) [must-cover]
- [~] Hiring plan (@me)
- [x] Budget sign-off [decision]
  > approved at 40k
- [>] Offsite dates
```

`[ ]` open, `[~]` in progress, `[x]` covered, `[-]` skipped, `[>]` parked; `(timebox, @owner)` and
`[kind]` in either order; indented `> ` lines are the outcome. Plain bullets under Goals are goals; every
other bullet, and every task-list bullet anywhere, is an item. Export → import is lossless (text that
would read as metadata is backslash-escaped). Import matches items by text: matched items take the new
fields (status through `setStatus`, so it is recorded), new ones are added, missing ones deleted
(`replace`) or kept (`merge`); `baseVersion` guards against overwriting a concurrent edit.

## CLI and MCP

The CLI's read-only rule gains exactly the agenda verbs (owner's writes; still nothing deletes meetings or
notes): `agenda create|list|show|add|edit|remove|status|export|import|link|share`, `context add`,
`suggest`. All `--json` (compact when piped), golden-tested through the real daemon
(`packages/e2e/test/cli-agenda.int.test.ts`, `__golden__/agenda-*.json`), under `BUDGET.agenda` (3 000
tokens; `show` refuses with exit 5 above it, `--full` bypasses) and `BUDGET.contextCard` (2 000). Refs:
`agd_…`/prefix, `next`, `latest`; items by position, id or text. Exit codes: 1 conflict (e.g. the meeting
already has an agenda → `--reuse`; a refused status move), 2 usage, 4 not found, 5 over budget, 6 calendar
off. `suggest` posts as `agent:<--as, default claude>`.

`gnomeola mcp` adds `list_agendas`, `get_agenda`, `create_agenda`, `add_agenda_items`, `edit_agenda_item`,
`remove_agenda_item`, `set_agenda_item_status`, `export_agenda_markdown`, `import_agenda_markdown`,
`add_context_card`, `suggest_for_agenda`, `agenda_invite_block` — each runs the CLI command function, so
budgets, refusals and privacy are shared. The live resource subscription is the agent-channel wave's.

The skill (`skills/meeting-context/SKILL.md`, installed by `gnomeola skill install`) has the "Prepare a
meeting" workflow; the copilot section states live attach is not available yet.

## Verification

| claim | test |
| --- | --- |
| markdown round trip is lossless (1 000 random agendas), links, invite block idempotent + organiser text untouched (300 random descriptions) | `packages/protocol/test/agendas.test.ts` |
| rules: one per occurrence, carry-over, forward-only, override, manual wins, history, privacy, session deletion scrubs quotes; replay == state over random histories covering every agenda event (6 seeds × 400 ops); reopen == dump | `packages/store/test/agendas.test.ts` |
| an independent reading of the log (`checkAgendaLog` in `@gnomeola/testkit/invariants`): change continuity, forward-only for everyone but the user, override flags, manual wins, versions step by one — on every random history and the daemon's own log (and it flags forged logs) | `packages/store/test/agendas.test.ts`, `packages/daemon/test/agendas.int.test.ts` |
| the same log gives the same snapshot on SQLite and Postgres, both ways | `packages/store/test/contract/agendas-dialect.int.test.ts` |
| every route schema-valid through the typed client | `packages/daemon/test/contract.test.ts` |
| attach on record, roll over + recap on stop, deep links, private recordings, invite block written / refused | `packages/daemon/test/agendas.int.test.ts` |
| cal-agent write path on a real isolated EDS (prefix preserved, idempotent, series master, not-organiser, read-only) | `packages/daemon/test/cal-agent-write.e2e.test.ts`, `eds-provider-write.test.ts` |
| the real daemon writes the block through EDS | `packages/e2e/test/agenda-invite-eds.e2e.test.ts` |
| CLI goldens, budgets, exit codes; MCP tools against the real daemon | `packages/e2e/test/cli-agenda.int.test.ts`, `mcp-agenda.int.test.ts` |
| Claude turns a scripted conversation into a correct agenda through the CLI (opt-in, skips without headless Claude) | `pnpm test:agenda-eval` (`packages/e2e/scripts/agenda-agent-eval.ts`) |

## For the next waves

- **Tracker**: call `AgendaStore.setStatus(agendaId, itemId, {status, by: 'tracker', evidence, auto,
  confidence})` — the store refuses backward moves and anything over a user override (409 / `StoreError
  conflict`; treat as "stay quiet"). Post 0.5–0.8 confidence as `addSuggestion({kind: 'looks-covered',
  itemId, source: 'tracker', ttlSec})`. The agenda of a live session: `bySession(sessionId)`.
- **Agent channel**: implement the four lease/live handlers in `agendaHandlers` (they 501 today), bind
  `by`/`source` to the lease (`agent:<name>`), emit `agent.presence`, stream `LiveEvent`.
- **Recap**: `daemon.agendas.onRecap(hook)`; write outcomes with `updateItem(…, {outcome})`.
- **Window**: `resolveAgendaLink` for the scheme; `AgendaView` + the `agenda.*` events on `/events` to stay
  current; `version` for optimistic edits (import `baseVersion`, `updateAgenda.baseVersion`).
- **Team sharing**: decide which agenda events replicate (never private cards), the invitee routes, and
  serve `<GNOMEOLA_AGENDA_WEB_BASE>/a/<id>`.
