# Notes and enhancement (M7)

How meeting notes work: the version model that keeps the user's words safe, the block diff the review is
built on, enhancement, templates, export, and the tests behind each claim.

The rule everything below serves: **your own words are never lost or silently rewritten.** Enhancement
can disappoint; it can never eat your notes.

## Versions (N-1)

Notes are an append-only list of versions per session (`note_versions`), one durable `note.version`
event each. Nothing is ever updated in place; versions go only with their session.

| kind | written by | becomes the head? |
| --- | --- | --- |
| `user` | every autosave of the editor | yes |
| `enhanced` | an enhancement result | **no** — it waits beside the head as `pendingEnhancement` |
| `merge` | applying a review (records `enhancedVersion` and one choice per hunk) | yes, and clears the pending review |
| `restore` | bringing an old version back | yes |

`notes` holds only the head's version number and the pending enhanced version, both derived from the
events, so replaying the log reproduces the tables byte for byte (`packages/store/test/notes.test.ts`).

**Optimistic concurrency.** `PUT /sessions/:id/notes {markdown, baseVersion}` is a 409 unless
`baseVersion` is the current head; saving unchanged text writes nothing. The window autosaves 800 ms after
the last keystroke and flushes on leaving a session. On a 409 it re-reads the head and saves the draft
on top — the other text stays in history, so nothing is lost either way (`packages/ui-core/src/notes.ts`).

Routes (`packages/protocol/src/notes.ts`): `getNotes`, `putNotes`, `listNoteVersions`, `enhanceNotes`
(SSE), `mergeNotes`, `restoreNoteVersion`, `getActionItems`, `listTemplates`, `putTemplate`,
`deleteTemplate`. Reads of a private session's notes are 404 without `includePrivate`, like its
transcript; the CLI and the skill never pass it.

## The block diff (N-4)

`packages/protocol/src/notes-diff.ts`, shared by the daemon and every client so both agree on what
"hunk 7" is.

- **Blocks**: a heading line; a top-level list item with its continuation and nested lines; a fenced
  code block; a thematic break; a paragraph. Each block carries the blank lines after it, which makes
  `splitBlocks(md).join('') === md` for every string.
- **Diff**: LCS over block keys (text without trailing whitespace), then, inside each run of removed +
  added blocks, a monotonic alignment by shared vocabulary pairs "your line" with "its rewrite"
  (`changed`). Hunks: `same`, `added`, `removed`, `changed`.
- **Merge**: one choice per hunk, `mine` or `enhanced`. Blocks are concatenated verbatim; the only bytes
  ever inserted are line breaks where a block would otherwise run into its neighbour (a paragraph after
  a list item), or where the user's text meets the enhanced text.
- **Defaults**: take what enhancement added or rewrote; **keep every block of yours that enhancement left
  out** — dropping your words always takes an explicit choice.
- The daemon recomputes the hunks against its head inside the merge transaction and refuses a choice
  list of the wrong length (400) or a stale head (409), so a merge is exactly what the reviewer saw.

Properties tested over thousands of generated documents (structured markdown, model-like rewrites and
raw noise; `GNOMEOLA_PROPERTY_RUNS=40000` for a soak): the split is lossless; all-`mine` reproduces the
user's text byte for byte and all-`enhanced` the enhanced text; any choice set yields exactly the chosen
blocks, in order, each verbatim; toggling a hunk twice is a no-op and toggling one hunk changes only its
blocks; the defaults never drop a user block; re-diffing a merge against the enhanced version offers
back only what was declined, and accepting / reverting that second review reaches the enhanced text /
the first merge exactly. One documented exception: an unterminated ``` fence swallows what follows it
(as it does in any renderer) — its bytes are all still there.

## Enhancement (N-2)

`enhance()` in `packages/llm/src/enhance.ts`, behind the daemon's `NotesEngine` seam
(`engines/enhance.ts`; `fakes/notes.ts` for tests).

```
system     ENHANCE_SYSTEM_PROMPT — frozen, its own (not the Q&A one)
user turn  <session …> + <transcript_chunk …> blocks     ← cache_control on the last stable chunk
           <template id=… name=…>…</template>
           <my_notes>…</my_notes> + the instruction          volatile, last, uncached
```

- Same assembler as Q&A (`assemblePrompt` with `system` / `tail`), so the transcript prefix is
  byte-stable and re-enhancing a meeting (other template, more notes) reads the cache.
- `effort: high`, adaptive thinking, server-side fallbacks, as in docs/llm.md.
- The prompt makes the model keep **every line of the notes word for word** (typos included), add detail
  around them, never invent, write action items as
  `- [ ] <what> — owner: <who> — due: <when>`, and cite transcript lines as `[sN]` (rewritten to `[n]`
  markers indexing the version's `enhancement.citations`; aliases to other segments are dropped).
- Transcript text is data (the injection rule from Q&A); only `</template` and `</my_notes` are guarded
  in user text, so their lines can come back verbatim.
- A refusal (`stop_reason: refusal`) or an empty result stores nothing, and the stream's error says the
  notes are unchanged. Ollama works through the same provider seam.
- The stream: `started {templateId, baseVersion}`, `delta*`, then `done {version}` or `error`.

## Templates (N-3)

Built-ins in `packages/daemon/src/notes/templates.ts`: `general` (the default), `standup`, `one-on-one`,
`interview`. Custom templates are durable (`template.upserted` / `template.deleted`); built-in ids are
protected. The default for a meeting is chosen by whole-word keyword match — custom templates first, the
**calendar event title before the session title** — else `general`.

**Calendar hook:** `listTemplates` takes `calendarTitle`, and `enhanceNotes` takes `calendarTitle` in
its body; `suggestTemplate({ sessionTitle, calendarTitle }, custom)` is exported from `@gnomeola/daemon`.
Calendar integration (M4) only has to pass the event's title; nothing here depends on how it is found.

## Export and action items (N-5)

- Window: **Copy Notes as Markdown** (`# Title`, the date, then the notes exactly), **Export Notes**
  (GtkFileDialog, starts in `~/Documents`), and an **Action Items** list parsed live from the notes, with
  its own copy button.
- `extractActionItems()` (`packages/protocol/src/notes-actions.ts`) is deterministic: task-list items
  anywhere, list items under an action-items heading; owner from `owner:`, `@name`, `**Name**:`,
  `Name:` or `Name to …`; due from `due:` or `by <day/date>`. Only what the notes state.
- CLI: `gnomeola notes <session> [--actions | --versions | --version N] [--full]` (JSON when piped;
  golden-tested through the real daemon). MCP: `get_meeting_notes`. The meeting-context skill checks a
  meeting's notes before asking or fetching windows.

## The window

**Electron** (`packages/desktop/src/renderer/features/notes/`, the session frame's Notes tab):

- `notes-editor.tsx`: CodeMirror 6 over markdown, themed only from the kacola tokens (Instrument Sans
  body, Bricolage headings, Fraunces italic quotes, JetBrains Mono code; light / dark / high contrast
  follow the document's CSS variables). Enter is a bare newline (no list continuation, no auto-indent,
  no auto-closed brackets), so what is typed is what is saved. It lives in a **shadow root**: CodeMirror
  styles itself through style-mod, which injects a `<style>` element into a document and our CSP
  refuses that; in a shadow root it uses a constructable stylesheet instead.
- `notes-data.ts`: ui-core's `NotesFeed` (the same controller as the GTK window: 800 ms autosave, flush
  on leaving, 409 → re-read and save on top, enhance, merge, **restore**) wired to the window: reads via
  React Query (`['notes', id]`, `['templates', id]`), events from `EventBridge.listen`, writes over the
  protocol routes. The EventBridge folds `note.version` into `['notes', id]` and `['noteVersions', id]`
  with ui-core's `applyNotesEvent` / `applyVersionEvent`; template events invalidate `['templates']`.
- `notes-pane.tsx`: Enhance + template menu (built-ins and custom; the suggestion and why — calendar
  event or meeting title keyword), save status, the streaming progress (words so far + the text), the
  error banner (`enhanceProblem`: refused / rate-limited → Try Again / no provider → Preferences),
  Version History, Copy Notes as Markdown (main's clipboard), Export Notes (main's save dialog, starting
  in Documents), live Action Items with owner / due and their own copy button.
- `notes-review.tsx`: one card per change, "Your notes" beside "Enhanced", a switch "Use enhanced text
  for change N"; Use All Enhanced / Keep All Mine / Discard / Apply.
- `version-history.tsx`: every version newest first with a preview; Restore This Version appends a
  `restore` version (so a restore is itself undoable). `template-editor.tsx`: custom templates (name,
  keywords, body), built-ins read-only with Duplicate.
- `kit.tsx`: local brand primitives, to be replaced by `design/primitives` (phase 2A) at merge.

**GTK** (until the cut-over): `packages/ui/src/components/notes-pane.tsx`, the GtkSourceView 5 editor
(`notes-editor.tsx`, see docs/gtkx.md §3), and `notes-review.tsx` with the same review model.

## Tests

| tier | file | proves |
| --- | --- | --- |
| unit | `packages/protocol/test/notes-diff.test.ts` | the diff/merge properties above |
| unit | `packages/protocol/test/notes-actions.test.ts` | action-item parsing |
| unit | `packages/store/test/notes.test.ts` | concurrency, pending/merge/restore, replay == state, every user version recoverable over random histories, history append-only |
| unit | `packages/llm/test/enhance.test.ts` | request layout, cache prefix stable across notes/templates, citations, refusal, fence unwrapping, the eval scorer |
| unit | `packages/ui/test/notes.test.ts` | autosave, typing during a save, conflict → re-save on top, external heads, enhancement, merge |
| unit | `packages/daemon/test/templates.test.ts` | template choice by keyword / calendar title |
| int | `packages/daemon/test/notes.int.test.ts` | every route through the real daemon process, privacy, refusal/failure store nothing |
| int | `packages/llm/test/enhance.cassettes.int.test.ts` | the real SDK on two fixture meetings, scored against reference notes; Ollama |
| int | `packages/e2e/test/notes-chain.int.test.ts` | CLI → daemon → LlmNotesEngine → SDK → replayed API; refusal / 429 leave notes untouched |
| unit | `packages/ui-core/test/notes.test.ts` | the feed (incl. restore), the query-cache folds, enhance error classes |
| unit | `packages/desktop/test/notes.test.tsx`, `notes-files.test.ts` | review choices in/out, action items, template helpers + optimistic mutation; main's clipboard / save-dialog checks |
| e2e | `packages/e2e/test/desktop-notes.e2e.test.ts` | Playwright port of the GTK suite below (every assertion) + rate limiting, history restore, custom templates; axe in light / dark / high contrast; screenshot baselines (`test/__screenshots__/desktop-notes/`, `UPDATE_BASELINES=1` to refresh) |
| e2e | `packages/e2e/test/ui-notes.e2e.test.ts` | AT-SPI: type into the editor, autosave, enhance against the fake Anthropic server, revert some blocks and accept others, apply, and the stored merge equals the choices; every typed version recoverable; clipboard (wl-paste), file export through the real file dialog, refusal, flush on leaving |
| eval | `packages/llm/test/enhance.eval.test.ts` | live (needs `ANTHROPIC_API_KEY`): user lines kept verbatim (hard), fact / action recall vs reference notes (soft), injection not obeyed, cache read on re-enhance |

The committed enhancement cassettes are hand-authored (no key was available); regenerate their requests
with `node packages/llm/test/fixtures/make-cassettes.ts`. No live enhancement numbers exist yet.
