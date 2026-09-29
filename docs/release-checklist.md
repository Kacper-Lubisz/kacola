# T5 — pre-release manual smoke checklist

Everything below is something no automated tier can honestly verify: real people on real calls, real
hardware, and whether the output is *useful* rather than merely accurate. Every automated tier (T0–T4) must be
green before starting. Perform on the release candidate as installed by `scripts/install.sh`, not from the repo.

Record each item as **pass / fail / n/a** with a one-line note. A release ships only with every item pass or n/a
and this file (filled in) committed under `docs/releases/<version>.md`.

| # | Scenario | How | Pass when |
|---|---|---|---|
| 1 | **Real call, browser** | Join a Google Meet from Firefox or Chrome with a second device on the far end. Talk on both ends for 5 minutes, including talking over each other. | Two tracks recorded; your lines are `me`, theirs are `them`; live partials appear within ~1 s; final text replaces them; nothing from the far end is attributed to you. |
| 2 | **Real call, desktop app** | Same with the Zoom or Teams desktop client. | As 1. The app's own audio device switching does not break capture. |
| 3 | **Bluetooth mid-meeting** | During a recording, connect a Bluetooth headset, talk, then disconnect it. | Capture continues on each device change; `gnomeola sessions show current` lists the gaps; no audio or transcript after the switch is lost. |
| 4 | **Wired headphones** | Plug and unplug wired headphones mid-recording. | As 3. |
| 5 | **Suspend mid-meeting** | Close the lid for ~60 s during a recording, reopen. | Session still recording afterwards; the suspended time is recorded as a gap, and timestamps after it are on the session timeline. |
| 6 | **Kill the daemon** | `systemctl --user kill -s KILL gnomeolad` during a recording, then `systemctl --user start gnomeolad`. | The session shows `recovered`; audio and transcript up to the kill are intact; `gnomeola transcript <id> --around <last minute>` works. |
| 7 | **Back-to-back day** | Three meetings (~2 h total) in a row on battery. Watch `top` and the fan. | Transcription keeps up (partials stay within a few seconds); no thermal throttling that makes the machine unpleasant; battery drain noted. If CPU is too high, switching *final pass* to `after` in Preferences resolves it. |
| 8 | **Is it useful?** | Read 5 minutes of a real transcript against your memory of the call. | You'd trust it for decisions and owners. Note error classes (names, numbers, jargon) as issues even on pass. |
| 9 | **Claude reads it** | In a Claude Code session: *"what did we decide about X in today's standup?"* | The `meeting-context` skill triggers; Claude runs `search` (or `ask`) before any `transcript`; never prints a whole transcript; answer is right and cites meeting + time. |
| 10 | **Private session** | Mark a session private in the window. | Still visible in the window; `gnomeola sessions list` / `search` / `ask` from the CLI cannot see it. |
| 11 | **Ask in the window** | Ask a question during and after a meeting from the Ask pane. | Streaming answer; citation chips seek the transcript to the right moment. |
| 12 | **No key, no problem** | Remove the API key in Preferences. | Everything except Ask works; Ask explains why it's unavailable instead of failing obscurely. |
| 13 | **Fresh install** | On a clean user account: `scripts/install.sh`, open the app. | First-run flow downloads models with progress, checks mic and system audio, and records a test meeting end to end. |
| 14 | **Uninstall** | `scripts/install.sh --uninstall`. | Service, desktop entry, CLI shim and skill removed; your recordings are kept unless you chose to delete them. |
| 15 | **Top bar, real session** | `gnome-extensions enable gnomeola@gnomeola.org`, log out and in. | The mic icon is in the top bar; the menu lists today's meetings from GNOME Calendar / Online Accounts with the right local times; Join opens the call in the browser *and* the icon turns red with a ticking time and the live line; Stop from the menu ends it. |
| 16 | **Real calendars** | With a Google or Microsoft 365 account in Online Accounts, check `gnomeola meetings --today` against GNOME Calendar. | Same meetings, same times (incl. recurring ones and any you declined being hidden); Meet/Teams/Zoom links found. |
| 17 | **Auto-record** | Turn on *When another app uses the microphone*, start a browser call; then turn on *When a calendar meeting starts* before a meeting. | A recording starts on its own each time (named after the meeting when one is on), the call ending stops the mic-triggered one ~30 s later; nothing starts while a recording is already running. |

Sign-off: name, date, version, machine (CPU / RAM / GNOME version), and the filled table.
