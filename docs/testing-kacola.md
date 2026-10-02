# Testing kacola by hand: the sandbox and its missions

`pnpm sandbox` runs a second, complete kacola next to your everyday one, with a mock calendar, scripted
meetings and a local sharing server, so you can try every feature alone without a real meeting. Each
mission below takes 2–5 minutes. For each one: the steps, what you should see, and what counts as a bug.

## What the sandbox is (and what it never touches)

`pnpm sandbox start` brings up, all under `~/.local/share/kacola-sandbox` (or `--dir`):

| piece | where | notes |
| --- | --- | --- |
| a daemon | `http://127.0.0.1:8790` | its own data dir (`data/`), an in-memory keyring, no D-Bus name, no microphone auto-record |
| a mock calendar | `calendar.json` | read by the daemon's file calendar provider, which picks up edits within a second |
| a sharing server | `http://127.0.0.1:8791` | the real hosted app plus the shared agenda page, so links open in any browser |
| a window | "kacola · sandbox" | a separate Electron profile with a **Sandbox** badge in the bottom-left corner |

It never reads or writes your everyday data dir (`~/.local/share/gnomeola`), daemon (port 8787),
keyring, calendar or window. The two daemons hold different data-dir locks, so both run at once. Your
everyday window keeps its title "kacola" and shows no badge. With `--audio mic`, the sandbox reads your
installed speech models through links and never changes them; a model you download from the sandbox
lands in the sandbox.

The mock day, relative to when you started:

- **1:1 with Ana**, in 2 minutes (Google Meet). It is a weekly series, so last week's 1:1 is in history.
- **Intro call with Sam**, in 15 minutes (Zoom).
- **Prototype feedback with the PM**, in 40 minutes (Google Meet).
- Past meetings: **Design review: checkout flow** (yesterday), **Hiring sync** (3 days ago, private).

The day is kept across `stop` and `start` while its meetings are still ahead, so agendas stay linked to
them. `pnpm sandbox start --fresh` moves the day to now.

## Commands

```sh
pnpm sandbox start                 # daemon, sharing server, mock calendar, the sandbox window
pnpm sandbox status                # what is running, and which providers are in use
pnpm sandbox scenarios             # the scripted meetings and what each should do
pnpm sandbox agenda one-on-one     # load a scenario's suggested agenda into its meeting
pnpm sandbox play one-on-one       # record the meeting and speak its script live, in real time
pnpm sandbox meeting add "Coffee with Ben" --in 5m --for 15m --with "Ben Okafor"
pnpm sandbox meeting list | meeting clear [--all]
pnpm sandbox mail                  # sign-in codes the sharing server would have emailed
pnpm sandbox providers --llm none --decisions jev     # switch providers live
pnpm sandbox cli -- sessions list  # the gnomeola CLI against the sandbox
pnpm sandbox card one-on-one       # the script as a card to read aloud (--audio mic)
pnpm sandbox stop                  # stop everything the sandbox started
pnpm sandbox reset                 # delete the sandbox directory (asks first)
```

**Providers.** `start` picks providers from your environment and prints them:

- **Live check-offs:** jev if `TYPESAFE_API_KEY` or `TYPESAFE_AI_API_KEY` is set, otherwise OpenAI if
  `OPENAI_API_KEY` is set, otherwise on-device.
- **Ask, Enhance and recaps:** Anthropic if `ANTHROPIC_API_KEY` is set, otherwise OpenAI if
  `OPENAI_API_KEY` is set, otherwise canned answers. Canned answers are real enough to click through,
  and they follow the cloud privacy rules, but they are not real answers.

Override either with `--decisions jev|openai|local` and `--llm anthropic|openai|ollama|fake|none`.

**Scenarios.** Each scenario matches one meeting on the mock calendar. `pnpm sandbox scenarios` prints
what each should do, item by item.

- `one-on-one` (1:1 with Ana): three of five items are settled outright, one only loosely ("I think we
  can probably make it work"), and one is never mentioned.
- `intro-call` (Intro call with Sam): every question is answered, out of order. The budget comes first,
  before you ask, and the next steps come last.
- `pm-feedback` (Prototype feedback with the PM): four clear answers, and a decision (the beta date)
  that is explicitly left open.

`play` speaks the script at real speed (about 1.5–2 minutes), and `--speed 3` makes it faster. If the
meeting is not recording yet, `play` starts recording it (as Join and record would), loading the
suggested agenda first if the meeting has none (`--no-agenda` skips that). If you already pressed
Record in the window, the script plays into that recording. The terminal follows along: each line, each
tick, each suggestion. Recording continues after the script ends, until you stop it.

---

## Mission 1: First look at home and the mock day (2 min)

1. `pnpm sandbox start`. Wait for "kacola sandbox is running" and the "kacola · sandbox" window.
2. Look at home: search on top, **Today** on a time rail, the next meeting expanded.
3. Scroll down to the earlier days.

**You should see:**

- The badge **Sandbox** in the bottom-left corner, and "kacola · sandbox" as the window title in the
  overview.
- "1:1 with Ana" expanded, "starts in 2 min", Google Meet, "Recording will work", and the buttons
  **Plan an agenda** and **Join and record**.
- "Intro call with Sam" (Zoom) and "Prototype feedback with the PM" under it, each with "No agenda".
- Yesterday: "Design review: checkout flow". Earlier: "Hiring sync" marked **Private**, and last week's
  "1:1 with Ana".
- Your everyday window, if it is open, is unchanged: no badge and none of these meetings.

**It's a bug if:**

- The sandbox window replaces or focuses your everyday window instead of opening beside it.
- Either window shows the other's meetings.
- The countdown does not move.
- After `pnpm sandbox meeting add "Coffee" --in 3m`, the new meeting does not appear within a few
  seconds.

## Mission 2: Prep an agenda by hand (3 min)

1. Open "Intro call with Sam" from home. This is the meeting page in **Prep**.
2. Add three or four items by hand: type one, press Enter, and repeat. Make one a question.
3. Reorder an item, edit one, and delete one.
4. Go Back to Today, then open the meeting again.

**You should see:** the items exactly as you left them, in your order, with no times asked for. Home
now says how many items the meeting's agenda has, instead of "No agenda".
`pnpm sandbox cli -- agenda show next --full` prints the same list.

**It's a bug if:** an edit is lost after navigating away, the order changes by itself, or the CLI and
the window disagree.

## Mission 3: Have Claude plan it from the terminal (4 min)

1. In a new terminal, run `export GNOMEOLA_URL=http://127.0.0.1:8790` (`pnpm sandbox env` prints this
   line). Then start `claude` in that shell, so the meeting-context skill and the `gnomeola` CLI talk
   to the sandbox.
2. Ask: "Plan the 1:1 with Ana."
3. Watch the meeting's page in the sandbox window while Claude works.

**You should see:**

- Claude finds the mock "1:1 with Ana" in about 2 minutes, from `gnomeola meetings`.
- Claude reads last week's 1:1. In it, Ana asked to put the promotion first, and the nightly billing
  export handover and the Berlin conference budget were left for this week.
- Claude writes an agenda that reflects all of that. The items appear in the window without a reload.

**It's a bug if:**

- Claude cannot find the meeting.
- Claude reads your everyday kacola instead. Check `echo $GNOMEOLA_URL`.
- The agenda is written to a different meeting.
- The window needs a reload to show the agenda.

Note: **Plan an agenda** in the window drafts with the language model itself, so it needs a real
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. With canned answers, it explains what is missing.

## Mission 4: Send the agenda and open the link as Ana (4 min)

1. Open a meeting with an agenda. If you need one, `pnpm sandbox agenda intro-call` loads it.
2. Press **Send the agenda**. Check what attendees will see, then press **Send**.
3. The mock calendar is read-only, so the dialog gives you invitation text to paste. Copy the
   `http://127.0.0.1:8791/a/…` link from it.
4. Open the link in a private browser window. You are now Ana.
5. Under "Add an item or a comment", enter `ana@sandbox.test` and press **Send code**. Then run
   `pnpm sandbox mail`, type the code it shows, and add an item and a comment.
6. Back in the sandbox window, wait a few seconds.

**You should see:**

- The page shows the meeting, its time and every item, with no transcript or notes.
- Ana's item and comment appear in the window, attributed to Ana, within a few seconds.
- After **Unshare**, the link stops working.

**It's a bug if:**

- The page shows anything you did not choose to share.
- The code is refused.
- Ana's item never arrives, or arrives as yours.
- The link still works after unsharing.

## Mission 5: Record the 1:1 with the scripted meeting (5 min)

1. Run `pnpm sandbox agenda one-on-one`, then open "1:1 with Ana" in the window.
2. Run `pnpm sandbox play one-on-one`. Alternatively, press **Join and record** in the window first,
   then run `play`. Join and record also opens the fake Meet link in your browser: close that tab.
3. Watch the live page and the terminal side by side.

**You should see:**

- The live page: one recording pill, Pause and Stop, a narrow checklist, and the notepad.
- The transcript (Ctrl+T) fills line by line as Ana and "me".
- The tracker ticks items off as they are settled: the promotion when Ana says "Agreed: …", then the
  billing export handover and the demo feedback. Each tick is marked "ticked by kacola", with **Undo**
  and a quote as evidence.
- The Berlin conference stays in progress. With jev or OpenAI, it may instead show a "Looks covered?"
  suggestion. The on-device provider never makes "looks covered" suggestions (docs/tracker.md).
- December vacation stays open.
- One suggestion slot shows "Say next" cards.

**It's a bug if:**

- December vacation gets ticked (a false tick).
- The promotion is never ticked (a missed tick).
- A tick has no evidence, or its evidence quotes a line that does not support it.
- Undo does not stick.
- A tick you undid comes back on its own.
- More than one suggestion shows at once.

See "How to judge the check-offs" below.

## Mission 6: Pause and resume (2 min)

1. During `play` (start another scenario, or replay one), press **Pause** in the window.
2. Wait 15 seconds, then press **Resume**.

**You should see:**

- Paused looks plainly different, with no red.
- The transcript stops while paused: the script waits too, because a paused recording hears nothing.
- After Resume, the script continues from where it stopped, with no lost or doubled lines.
- `pnpm sandbox cli -- record status` agrees with the window.

**It's a bug if:** lines arrive while paused, a line is skipped or repeated after Resume, or the
recording pill and the CLI disagree.

## Mission 7: Stop and read the outcome (3 min)

1. After the script ends, press **Stop**.
2. Read the **Outcome**: what was decided, what there is to do (yours first), what carries over, then
   the notes.
3. Click a citation.

**You should see:**

- Decided: the promotion (lead the migration, nomination in March), the handover (Priya from Monday)
  and the demo (five slides, a dry run).
- To do: telling Priya and the budget sheet.
- Carried over: the open items (December vacation, and the conference if it was not ticked).
- The citation opens the transcript at the cited line.

Recaps need a language model, so with canned answers or `--llm none` the outcome says so instead of
inventing one.

**It's a bug if:**

- The outcome lists something never said.
- Vacation appears as decided.
- A citation opens the wrong line.
- The next "1:1 with Ana" does not offer the carried-over items. To check, add another occurrence with
  `pnpm sandbox meeting add "1:1 with Ana" --in 1h`; it is a new meeting, so compare by hand.

## Mission 8: Enhance and Back to my draft (3 min)

1. On the outcome, type a few rough notes ("promo march?", "priya monday").
2. Press **Enhance**.
3. Read the result, then press **Back to my draft**.

**You should see:**

- The enhanced notes stream in and replace your draft.
- Back to my draft restores exactly what you typed.
- Version history shows both versions.
- With canned answers, the enhanced text is generic, but the flow is real.

**It's a bug if:** any word of your draft is lost, Back to my draft gives something other than what you
typed, or a failed enhancement changes your notes.

## Mission 9: Ask during and after (3 min)

1. During a recording, open Ask (Ctrl+K) and ask "What did Ana say about the promotion?"
2. After stopping, ask the same question on the outcome.
3. On home, type "who owns the confirmation copy" and press Enter. This asks across meetings.

**You should see:**

- Answers with citations. Clicking one jumps to the line.
- With a real provider, the answer across meetings cites the design review: Ben, by Wednesday. With
  canned answers, the "answer" only quotes the transcript, but the citations, scope line and errors are
  real.
- A line saying where the question is sent, for example "Sends N meetings to Anthropic · 1 private left
  out".

**It's a bug if:**

- Citations point at lines that do not say it.
- The private "Hiring sync" is sent to a cloud provider.
- Ask hangs without an error.

## Mission 10: Search for something said (2 min)

1. On home, type `retry banner` without pressing Enter.
2. Then try `nightly billing export` and `ninety-five`.

**You should see:**

- Moments, not just meetings, in place of the day. `retry banner` opens the design review at the line.
- `nightly billing export` finds last week's 1:1 and today's recording.
- `ninety-five` (said only in the private Hiring sync) shows in the window, which is yours. It does
  not show in `pnpm sandbox cli -- search "ninety-five"`: the CLI never sees private meetings.

**It's a bug if:** a hit opens the meeting at the wrong place, today's lines are not searchable after
Stop, or the CLI shows the private meeting.

## Mission 11: A private meeting stays local (3 min)

1. Open "Hiring sync" (it is already private), or mark any meeting private in its details.
2. Ask a question on it.
3. Run `pnpm sandbox cli -- sessions list`.

**You should see:**

- With a cloud provider (Anthropic or OpenAI, and also with canned answers, which act as a cloud
  provider): "Private meetings stay on this computer", and nothing is sent.
- The CLI does not list the meeting at all.
- Sending the agenda of a private meeting does not leak its notes.

**It's a bug if:** a private meeting's text reaches a cloud provider, or it appears in the CLI,
`search` or Claude's answers.

## Mission 12: Provider errors (3 min)

1. Run `pnpm sandbox stop`, then `pnpm sandbox start --llm none --decisions jev`, with no
   `TYPESAFE_API_KEY` in this shell.
2. Ask a question, press Enhance, and record with `play one-on-one`.
3. Run `pnpm sandbox providers --llm anthropic` with no key set, and ask again.

**You should see:**

- Ask: "Questions aren't available", with a link to Preferences.
- Enhance: "Enhancing needs a language model provider", and your notes untouched.
- The tracker says the selected decisions provider cannot run (no `TYPESAFE_API_KEY`) and falls back to
  on-device, so items still get ticked. `pnpm sandbox status` shows the daemon's decisions state.
- With Anthropic and no key, the error names the missing key.

**It's a bug if:** anything spins forever, an error is blank or technical, notes change, or the tracker
silently stops ticking.

Put things back with `pnpm sandbox stop && pnpm sandbox start`.

## Mission 13: Do it again live with your own voice (5 min)

1. Run `pnpm sandbox stop`, then `pnpm sandbox start --audio mic --scenario one-on-one`. This uses
   your microphone and the speech models you already installed.
2. Load the agenda (`pnpm sandbox agenda one-on-one`), open "1:1 with Ana", and press **Record now** or
   **Join and record**.
3. Read the printed card aloud (`pnpm sandbox card one-on-one` prints it again). Read your lines in
   your own voice and Ana's in a different voice, with a short pause between turns.

**You should see:**

- Partial words while you speak, then final lines.
- The same ticks as in Mission 5, a little later and less tidily.
- Everything is on the microphone track, so every line says "me". That is expected: there is no
  second track to tell you and "Ana" apart.

**It's a bug if:**

- Nothing is transcribed. Check `pnpm sandbox status` and the window's capture state.
- Ticks fire on the wrong items.
- Your everyday kacola starts recording too. It must not: the sandbox claims no D-Bus name and has no
  microphone rule.

---

## How to judge the check-offs

The tracker can be wrong in two ways, and they cost different things.

- **A false tick:** an item ticked that was not actually settled, such as December vacation in the 1:1,
  or the beta date in the PM call ("let us not decide that today"). It is the worse error, because a
  ticked item drops out of your attention. Also count **premature** ticks as false: an item ticked the
  moment it is introduced ("Next, the handover …"), before anyone settled it.
- **A missed tick:** an item clearly settled but left open, such as the promotion after Ana's "Agreed:
  …". It is cheaper, because you notice it and tick it yourself, but a tracker that misses most items
  is useless.

The loosely settled conference budget is the deliberate grey zone. A good tracker shows "Looks
covered?" or leaves it in progress, rather than a confident tick. Count a confident tick there as half
a false tick.

**Where to see the evidence:**

- **In the window:** every automatic tick says "ticked by kacola", with **Undo**. Its evidence chip
  quotes the line it relied on. Check that the quote really settles the item.
- **In the terminal:** `pnpm sandbox play` prints each tick right after the line that caused it, so a
  premature tick is easy to spot.
- **Full detail:** `pnpm sandbox cli -- agenda show <agenda> --history --full` lists each status change
  with who made it, the evidence segment and the quote. `curl -s
  http://127.0.0.1:8790/agendas/<agenda>/tracker` shows the tracker's own state: provider, degraded
  fallbacks, and dropped triggers.

To compare providers, run the same scenario once per provider and score each item as right, false tick
or missed tick:

```sh
pnpm sandbox start --decisions local     # then: play one-on-one, note the ticks, stop the recording
pnpm sandbox providers --decisions jev   # then: start --fresh or add a new meeting, and play again
```

The on-device provider's offline numbers are in docs/tracker.md: auto-tick precision about 0.75, and it
never makes "looks covered" suggestions. Fewer false ticks than that from jev or OpenAI is the point of
using them.

## When something is off

- **Logs:** `~/.local/share/kacola-sandbox/logs/{daemon,host,window}.log`.
- **"Something already listens on 8790":** an old sandbox is still running (`pnpm sandbox stop`), or
  pass `--port`.
- **A clean slate:** `pnpm sandbox stop && pnpm sandbox reset && pnpm sandbox start`.
