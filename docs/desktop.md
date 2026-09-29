# The desktop side: calendar, D-Bus, top bar, auto-record (M4)

How gnomeolad reaches into the GNOME session, and how each piece is tested without touching the real one.

```
 Evolution Data Server ──ECal──▶ cal-agent (GJS) ──JSON lines──▶ gnomeolad ◀──HTTP── CLI / window
 (GNOME Calendar, Online Accounts)                                  │  │
                                                                    │  └─JSON lines──▶ dbus-bridge (GJS)
 PipeWire graph ──pw-dump (polled)──▶ mic-activity rule ────────────┘                  │ org.gnome.Gnomeola
                                                                                        ▼ (session bus)
                                                                     GNOME Shell extension (top bar)
```

## Calendar (C-1 … C-3)

- **Source of truth is the calendar, not us.** Meetings live in memory in `CalendarService`
  (`packages/daemon/src/calendar/service.ts`); only the link from a session to the meeting it recorded is
  durable (`Session.meeting`, migration 2, carried by `session.upserted` so replay covers it).
- **Providers** (`calendar/providers.ts`): `EdsCalendarProvider` spawns `gjs -m packages/daemon/gjs/cal-agent.js`
  under `LineChild` supervision (restart with backoff, exits on stdin EOF); `FileCalendarProvider` reads a
  JSON file of `RawOccurrence`s (tests, demos, scripts); `NoCalendar`.
- **cal-agent does only what needs EDS**: enabled sources, recurrence expansion (`generate_instances_for_object_sync`
  — overrides and EXDATEs applied), time zones (UTC instants out; all-day as local dates), which attendee is
  "me" (Mail Identity addresses + `cal-email-address`). Protocol: `calendar/agent-protocol.ts`.
- **Everything else is TypeScript, unit-tested**: join links (`join-links.ts`: Meet/Zoom/Teams/Webex/Jitsi/
  Whereby, SafeLinks + Google redirects, HTML entity bodies; field order X-props → URL → LOCATION →
  DESCRIPTION), dedupe across calendars, current/next/upcoming (`meetings.ts`).
- **Window**: recurrences are expanded from the start of yesterday to 15 days ahead, rolled hourly. A
  `GET /meetings` outside it widens the window on demand and waits for the re-expanded snapshot.
- **Moments**: `meeting.starting` (ephemeral + D-Bus `MeetingStarting`) 60 s before a timed meeting;
  `begin` at its start (auto-record). Meetings already under way when first seen never fire `begin` late.
- **Routes**: `GET /calendar`, `GET /meetings?from&to&includeDeclined`, `GET /meetings/next`,
  `POST /meetings/:id/join` (records first, then returns the link for the *caller* to open — the caller owns
  the desktop). CLI: `gnomeola meetings [--next | --today]`, MCP tool `calendar_meetings`.

## D-Bus: `org.gnome.Gnomeola` (C-4)

- The contract is `packages/daemon/dbus/org.gnome.Gnomeola.xml`. The bridge exports exactly that file; the
  extension embeds a generated copy (`node scripts/extension-dbus.ts`; `--check` and a unit test catch drift).
- **Why a GJS bridge and not a Node D-Bus library**: GDBus is what the Shell itself speaks (ownership
  queuing, PropertiesChanged semantics are the reference ones), no new npm dependency (the pure-JS libraries
  are unmaintained), and gjs is already required for cal-agent. The bridge is dumb: every value comes from
  `dbus/view.ts` (pure, unit-tested); method calls come back to `RecordingControl`.
- **Private sessions** show as recording (you must be able to see and stop a capture) but with the title
  "Private meeting", no transcript line and no meeting id — every process of the user can read the bus.
- The bridge owns the name without replacement: a second daemon queues and takes over when the first exits.

## Top-bar extension (C-5 … C-7, C-9)

`extensions/gnomeola@gnomeola.org/` (Shell 50, ESM). `model.js` decides everything the menu shows and is
unit-tested under Node; `extension.js` renders it. Talks only to D-Bus, never auto-starts the daemon, shows
"not running" while the name has no owner. `scripts/install.sh` packs it with `gnome-extensions pack` and
unpacks it into `${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions/` — it never enables it.

## Auto-record (C-8)

Both rules off by default (Preferences → Auto-record). Calendar: record a timed, not-declined meeting at its
start, never auto-stopped. Microphone: poll `pw-dump` for `Stream/Input/Audio` nodes in `running` state that
are not ours (`gnomeola-capture-*`), not sink monitors, not level meters; stop a session *this rule started*
after `GNOMEOLA_MIC_IDLE_STOP_MS` (30 s) without one. A rule never interrupts a running recording.

## Configuration

| env | values | default |
| --- | --- | --- |
| `GNOMEOLA_CALENDAR` | `eds`, `off`, `file:PATH` | `eds` (`off` with `--fake`) |
| `GNOMEOLA_DBUS` | `session`, `off` | `session` (`off` with `--fake`) |
| `GNOMEOLA_MIC_ACTIVITY` | `pipewire`, `pipewire:SOURCE`, `off` | `pipewire` (`off` with `--fake`) |
| `GNOMEOLA_MIC_IDLE_STOP_MS` | ms | 30000 |
| `GNOMEOLA_GJS` | path | `gjs` |

The testkit daemon harness sets all three integrations `off` unless a test opts in: a test daemon must never
read the user's calendars or claim a name on their session bus.

## Tests (nothing here touches the real session)

| tier | file | what |
| --- | --- | --- |
| unit | `daemon/test/join-links.test.ts`, `calendar.test.ts`, `auto-record.test.ts` | link shapes, selection, moments (fake timers), rules, view |
| e2e | `daemon/test/dbus.e2e.test.ts` (V-4a) | private `dbus-daemon`, real bridge, observed through a `Gio.DBusProxy` (`@gnomeola/testkit/dbus`): every property, method, signal, error, bridge crash, name hand-over |
| e2e | `daemon/test/cal-agent.e2e.test.ts` (V-4c) | isolated EDS (`@gnomeola/testkit/eds`: private bus, temp XDG dirs, registry + calendar factory): 25 exact occurrences across two DST ends, exceptions, declined, links; live add/modify/delete; disabled calendars |
| e2e | `e2e/test/meetings-eds.e2e.test.ts` | the same EDS through the real daemon's HTTP API |
| e2e | `e2e/test/shell-extension*.e2e.test.ts` (V-4b) | nested `gnome-shell --headless` with the extension enabled; a test-only companion extension turns on unsafe mode in *that* Shell so `Eval` can read the indicator; fake URL handler captures Join; real daemon over the nested bus |
| e2e | `e2e/test/auto-record-mic.e2e.test.ts` | mic rule on the real PipeWire graph via the rig's virtual microphone |
| int | `e2e/test/cli-meetings.int.test.ts` | `gnomeola meetings` goldens through the real daemon |

GJS lessons: call `registry.run_dispose()` before exiting (GJS otherwise segfaults finalising an
`ESourceRegistry`) but never on an `ECalClient`; use async `ECal.Client.connect` with the main loop running
(`connect_sync` at top level deadlocked); use `GioUnix.InputStream`/`OutputStream` (the `Gio.Unix*` aliases
warn on GLib 2.86).
