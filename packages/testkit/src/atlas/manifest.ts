// The screen atlas manifest: every state a user story in docs/user-stories.md touches, in story order.
// `built` entries are captured by the atlas suites (packages/e2e/test/atlas*.e2e.test.ts,
// packages/vercel/test/atlas-web.e2e.test.ts), which fail if one is not; `planned` entries have no
// image yet and show as gaps on the atlas page. When a planned screen lands: flip it to `built` and
// add one `atlas.shoot(page, '<id>', { expect: … })` where the suite reaches that state.
//
// Id = `<story>__<step>__<state>`; files are `<id>__<light|dark>__<width>.png`. Pure data: no imports,
// so scripts/build-atlas.ts reads it directly.

export type Surface = 'window' | 'shell' | 'web' | 'cli'
export type AtlasStatus = 'built' | 'planned'
export type AtlasEntry = {
  id: string
  story: string
  step: string
  state: string
  /** What the screen shows, for the filmstrip caption. */
  label: string
  surface: Surface
  status: AtlasStatus
  /** A main screen: also captured at 800 and 360 px. */
  responsive?: boolean
  /**
   * A terminal frame: the argv the atlas suite runs through the real CLI against its daemon (output saved
   * as <id>.txt), or `mcp` for the MCP server's tools/list over stdio.
   */
  cli?: { argv: string[]; mcp?: boolean }
  note?: string
}

export const WIDTHS_ONE = [1280] as const
export const WIDTHS_MAIN = [1280, 800, 360] as const

type Opts = Partial<Pick<AtlasEntry, 'responsive' | 'cli' | 'note'>>
const mk =
  (surface: Surface, status: AtlasStatus) =>
  (story: string, step: string, state: string, label: string, o: Opts = {}): AtlasEntry => ({
    id: `${story}__${step}__${state}`,
    story,
    step,
    state,
    label,
    surface,
    status,
    ...o,
  })
const win = mk('window', 'built')
const shell = mk('shell', 'built')
const web = mk('web', 'built')
const cli = mk('cli', 'built')
const planned = mk('window', 'planned')
const plannedWeb = mk('web', 'planned')
const plannedShell = mk('shell', 'planned')
const plannedCli = mk('cli', 'planned')

export const ATLAS: AtlasEntry[] = [
  // ---- The Day story: home is your day, a meeting is one page (Prep → Live → Outcome)
  win(
    'day',
    'home',
    'next-meeting',
    'Home at 13:52: search-and-ask, today on a time rail with the 1:1 expanded, earlier days',
    {
      responsive: true,
    },
  ),
  win(
    'day',
    'home',
    'messy-busy',
    'Home on a messy real day: all-day strip, one row per invitation, overlaps, the 1:1 under way in its place, untitled recordings quiet',
    { responsive: true },
  ),
  win('day', 'home', 'messy-afternoon', 'Late afternoon: the next meeting expanded just above the now line', {
    responsive: true,
  }),
  win('day', 'home', 'empty-day', 'An empty day: nothing on the calendar, earlier days below', {
    responsive: true,
  }),
  win('day', 'home', 'calendar-offline', 'Calendars not up to date: one quiet line, with Refresh'),
  win(
    'day',
    'search',
    'moments',
    'Search in place of the day: moments (meeting · day · time · speaker · line)',
    {
      responsive: true,
    },
  ),
  win(
    'day',
    'search',
    'answer',
    'Ask from the same box: a cited answer above the moments, private meetings left out',
  ),
  win(
    'day',
    'prep',
    'agenda',
    'The 1:1’s page in Prep: agenda, context, earlier meetings, Ask, Join and record',
    {
      responsive: true,
    },
  ),
  win(
    'day',
    'live',
    'suggestion',
    'Live, minimal: recording pill, agenda checklist, the notepad, one suggestion',
    {
      responsive: true,
    },
  ),
  win('day', 'live', 'ask', 'Ask on demand (Ctrl+K): a bar over the notepad, answers pinned to notes'),
  win('day', 'live', 'paused', 'Paused: no red, “Paused”, Resume'),
  win(
    'day',
    'outcome',
    'outcome',
    'Outcome: decided, to do (yours first), carried over; then the clean notes',
    {
      responsive: true,
    },
  ),
  win(
    'day',
    'outcome',
    'transcript-cited',
    'The transcript as evidence: a side panel opened at the cited line',
  ),
  win('day', 'outcome', 'share-summary', 'Share summary: exactly what they get, to copy or save'),
  // ---- Get started
  win(
    'first-run',
    'welcome',
    'checks',
    'Welcome: speech models, audio capture, calendar and the CLI + skill offer',
    {
      responsive: true,
    },
  ),
  win(
    'first-run',
    'skipped',
    'empty-window',
    'Onboarding skipped: home with nothing recorded yet, and the missing-model banner',
    {
      responsive: true,
    },
  ),
  win(
    'integrations',
    'preferences',
    'integration-page',
    'Preferences › Integration: command-line tool + skill, top-bar extension, background',
  ),
  win(
    'integrations',
    'sidebar',
    'extension-card',
    'On GNOME, until the top-bar extension is on: the card on home with Install & Enable (dismissible)',
  ),
  win(
    'integrations',
    'sidebar',
    'extension-login',
    'After Install & Enable: the Shell loads new extensions at login, so "log out and back in"',
  ),
  win(
    'integrations',
    'preferences',
    'extension-update',
    'Preferences › Integration: an older copy of the top-bar extension, Update',
  ),
  win(
    'integrations',
    'preferences',
    'extension-on',
    'Preferences › Integration: the top-bar extension On, with Disable and Remove',
  ),
  win(
    'integrations',
    'enable',
    'ask-extensions',
    'Extensions switched off in GNOME: asked before Enable turns them all back on',
  ),

  // ---- Start a recording
  win(
    'record-now',
    'idle',
    'record-button',
    'Home: today and earlier days in time order, with Record now for a call not in the calendar',
    {
      responsive: true,
    },
  ),
  win(
    'record-now',
    'recording',
    'live-transcript',
    'Recording: the live page with the transcript beside it (Ctrl+T), a partial line; no level meters',
    {
      responsive: true,
      note: 'held by the fake pipeline at 30 s of audio; the elapsed timer is masked',
    },
  ),
  win('record-now', 'paused', 'paused', 'Paused: no red, “Paused”, Resume; nothing is transcribed', {
    note: 'the elapsed timer is masked',
  }),
  win('record-now', 'stopped', 'finished', 'Stopped: the page moves on to the outcome, with Share summary', {
    responsive: true,
  }),
  shell(
    'topbar-join',
    'idle',
    'upcoming-meetings',
    'Top bar menu: Record now and the upcoming meetings with Join',
  ),
  shell(
    'topbar-join',
    'starting',
    'notification',
    'A meeting is about to start: the "Join and record" notification',
  ),
  shell(
    'topbar-join',
    'recording',
    'indicator',
    'Recording from the top bar: red indicator, title, last line, Pause and Stop',
  ),
  shell('topbar-join', 'paused', 'indicator', 'Paused in the top bar: Resume and Stop'),
  shell('topbar-join', 'idle', 'no-meetings', 'Top bar menu with no upcoming meetings'),
  win(
    'topbar-join',
    'window',
    'joined-session',
    'The meeting joined from the top bar: its live page in the window, recording',
  ),
  win(
    'auto-record-calendar',
    'preferences',
    'rule-on',
    'Preferences › Auto-record: "When a calendar meeting starts" switched on',
  ),
  win(
    'auto-record-calendar',
    'begins',
    'recording-row',
    'The meeting began: recorded, titled after the event, pinned on top of home',
  ),
  win(
    'auto-record-mic',
    'preferences',
    'rule-on',
    'Preferences › Auto-record: "When another app uses the microphone" switched on',
  ),
  win(
    'agent-record',
    'window',
    'session-appears',
    'A recording started by the CLI / Claude appears pinned on top of home',
  ),
  cli('agent-record', 'cli', 'record-status', '`gnomeola record status` while that recording runs', {
    cli: { argv: ['record', 'status'] },
  }),
  win(
    'deep-link',
    'open',
    'meeting-link',
    'kacola://meeting/<eventUid>: the app opens that meeting’s page in Prep (creates its agenda)',
  ),
  win('deep-link', 'live', 'join-offer', 'The meeting is under way: "Join and record" offered'),
  planned('deep-link', 'open', 'agenda-link', 'kacola://agenda/<id>: the agenda opens'),

  // ---- During the meeting
  win('live-transcript', 'search', 'live', 'Searching the transcript panel while it grows (Ctrl+F)'),
  win('live-transcript', 'detached', 'jump-to-live', 'Scrolled back while recording: "Jump to Live" appears'),
  win('speakers', 'transcript', 'chips', 'Who said what: speaker chips on a diarized meeting'),
  win('speakers', 'dialog', 'list', 'The Speakers dialog: everyone in the meeting and how much they said'),
  win('speakers', 'rename', 'field', 'Naming a speaker inline'),
  win('speakers', 'merge', 'menu', 'Merging two speakers who are the same person'),
  win('speakers', 'line', 'someone-else', 'A far-end line selected: "Someone else said this" splits it off'),
  win(
    'speakers',
    'preferences',
    'voiceprints',
    'Preferences › Speakers: tell apart, and recognise people across meetings',
  ),
  win(
    'ask-live',
    'during',
    'empty',
    'Ask while recording (Ctrl+K): a bar over the notepad, never a screen of its own',
  ),
  win('ask-live', 'during', 'answered', 'An answer during the meeting, with citations and Pin to notes'),
  win(
    'private-session',
    'view',
    'private',
    'A private meeting’s outcome: marked Private, hidden from the CLI and the Claude skill',
    {
      responsive: true,
    },
  ),
  win(
    'private-session',
    'details',
    'switch',
    'Meeting actions › Details › Private: the switch that hides a meeting from agents',
  ),
  shell(
    'private-session',
    'topbar',
    'private-meeting',
    'Recording a private meeting: the top bar says only "Private meeting"',
  ),

  // ---- After the meeting
  win(
    'find-meeting',
    'search',
    'matches',
    'Home’s search: titles and transcripts as moments that open at the line',
  ),
  win('find-meeting', 'search', 'no-matches', 'Home’s search with nothing that matches'),
  win(
    'find-meeting',
    'open',
    'transcript',
    'A meeting opened from home: its outcome, the transcript beside it',
    { responsive: true },
  ),
  win(
    'find-meeting',
    'transcript-search',
    'matches',
    'Search inside the transcript panel (Ctrl+F): "1 of 2"',
  ),
  win(
    'find-meeting',
    'details',
    'details',
    'Meeting actions › Details: when, how long, tracks, title, private',
  ),
  win('ask-meeting', 'open', 'empty', 'Ask about this meeting (Ctrl+K): the bar over the outcome', {
    responsive: true,
  }),
  win('ask-meeting', 'asking', 'streaming', 'The answer streaming in', {
    note: 'the provider stream is held mid-answer',
  }),
  win('ask-meeting', 'answered', 'citations', 'Answered, with citation chips', { responsive: true }),
  win(
    'ask-meeting',
    'citation',
    'line-highlighted',
    'A citation followed: the transcript panel opens at the line; the answer stays',
  ),
  win('ask-meeting', 'refused', 'notice', 'The model declined: the notice replaces the partial answer'),
  win(
    'ask-across',
    'answered',
    'cross-meeting',
    'Asked from home’s box, across meetings: a cited answer; private meetings left out',
  ),
  cli('ask-across', 'cli', 'ask-since', '`gnomeola ask … --since 14d` from Claude', {
    cli: { argv: ['ask', 'What did we decide about the retry budget?', '--since', '30d'] },
  }),
  win(
    'notes-write',
    'editor',
    'notes',
    'The outcome’s notes (markdown marks drawn quietly), under the outcome block',
    {
      responsive: true,
    },
  ),
  win(
    'notes-write',
    'actions',
    'action-items',
    'The outcome’s To do: action items from the notes with owner and due date, yours first',
  ),
  win('notes-templates', 'menu', 'open', 'Choose a Template: enhance as standup / 1:1 / interview …'),
  win('notes-templates', 'manage', 'dialog', 'Notes templates: built-in and custom'),
  win('notes-templates', 'new', 'form', 'A new template: name, keywords, instructions'),
  win('notes-templates', 'suggested', 'calendar', 'A template suggested by the calendar event'),
  win('notes-enhance', 'enhancing', 'mid-stream', 'Enhancing: the enhanced notes streaming in', {
    note: 'the provider stream is held mid-answer',
  }),
  win(
    'notes-enhance',
    'applied',
    'notes',
    'Enhance replaced the draft with the tidied notes; Back to my draft undoes it',
  ),
  win('notes-history', 'dialog', 'versions', 'Version History: every version, restorable'),
  win('notes-export', 'copied', 'toast', 'Copy Notes as Markdown: "Notes copied as Markdown"'),
  win(
    'notes-export',
    'exported',
    'toast',
    'Export Notes: saved through the file dialog, "Notes exported to …"',
  ),

  // ---- Settings
  win(
    'settings-provider',
    'general',
    'anthropic',
    'Preferences › General: Anthropic configured (the key is never shown)',
    {
      responsive: true,
    },
  ),
  win('settings-provider', 'provider', 'menu', 'Choosing a provider: Anthropic, OpenAI, Ollama, none'),
  win('settings-provider', 'openai', 'key', 'OpenAI selected: its key field'),
  win('settings-provider', 'ollama', 'url', 'Ollama selected: its URL'),
  planned(
    'settings-provider',
    'decisions',
    'provider',
    'Runs on (jev, OpenAI, Anthropic, Ollama, local) and its key',
  ),
  win(
    'settings-capture',
    'preferences',
    'devices',
    'Preferences › Capture: microphone and system audio devices, accurate pass',
  ),
  win('settings-capture', 'models', 'speech-models', 'Speech models: downloaded, missing, download progress'),
  win(
    'settings-storage',
    'preferences',
    'retention',
    'Preferences › Storage: keep audio N days, archive as Opus',
  ),
  win('help-about', 'menu', 'main-menu', 'The main menu'),
  win('help-about', 'shortcuts', 'dialog', 'Keyboard shortcuts (Ctrl+?)'),
  win('help-about', 'about', 'dialog', 'About kacola: version, licence, Granola credit'),
  win('help-about', 'legal', 'notices', 'About › Legal: third-party notices'),

  // ---- Agents and other surfaces
  cli('cli-skill', 'search', 'hits', '`gnomeola search` — ranked snippets with ids', {
    cli: { argv: ['search', 'retry budget'] },
  }),
  cli('cli-skill', 'notes', 'actions', '`gnomeola notes <id> --actions` — the action items', {
    cli: { argv: ['notes', 'ses_000000001aaaaaaaaaaa1', '--actions'] },
  }),
  cli('cli-skill', 'transcript', 'window', '`gnomeola transcript --around` — a narrow window', {
    cli: { argv: ['transcript', 'ses_000000001aaaaaaaaaaa1', '--around', '1:05', '--context', '10s'] },
  }),
  cli('cli-skill', 'sessions', 'list', '`gnomeola sessions list` — private meetings are absent', {
    cli: { argv: ['sessions', 'list'] },
  }),
  cli('cli-skill', 'meetings', 'today', '`gnomeola meetings --today` — the calendar', {
    cli: { argv: ['meetings', '--today'] },
  }),
  cli(
    'cli-skill',
    'refused',
    'whole-transcript',
    'A whole transcript is refused (exit 5): the discipline working',
    {
      cli: { argv: ['transcript', 'ses_000000001aaaaaaaaaaa1'] },
    },
  ),
  cli('mcp', 'tools', 'list', '`gnomeola mcp` — the same operations as MCP tools', {
    cli: { argv: ['mcp'], mcp: true },
  }),
  planned(
    'byo-agent',
    'attach',
    'connected',
    'Claude Code attached (`gnomeola live attach`): presence in the window',
  ),
  planned('byo-agent', 'suggest', 'card', 'A suggestion from the connected agent'),
  planned('byo-agent', 'context', 'card', 'A context card the agent fetched from this machine'),
  plannedCli(
    'byo-agent',
    'cli',
    'live-attach',
    '`gnomeola live attach --as claude` — NDJSON events until the meeting ends',
  ),
  web('web-viewer', 'pair', 'code', 'Web viewer, not signed in: the pairing code', { responsive: true }),
  web('web-viewer', 'list', 'sessions', 'Signed in: the meetings list', { responsive: true }),
  web('web-viewer', 'session', 'transcript-notes', 'A meeting: transcript and notes', { responsive: true }),
  web('web-viewer', 'search', 'hits', 'Search with highlighted matches', { responsive: true }),

  // ---- When things go wrong
  win('daemon-down', 'window', 'cant-reach', 'Can’t Reach kacola, with Try again', { responsive: true }),
  shell('daemon-down', 'topbar', 'not-running', 'Top bar: gnomeola is not running'),
  cli('daemon-down', 'cli', 'exit-3', 'The CLI says the daemon is unreachable (exit 3)', {
    cli: { argv: ['search', 'retry budget'] },
  }),
  win('connection-lost', 'window', 'reconnecting', 'Lost the connection to the daemon: reconnecting'),
  win('recovered-session', 'list', 'recovered', 'Home: a recording recovered after a crash, labelled'),
  win('no-models', 'window', 'banner', 'A speech model is missing: the banner offers Set Up'),
  win(
    'provider-errors',
    'ask',
    'no-provider',
    'No AI provider: the daemon says so, with one action, Set up a provider',
  ),
  win(
    'provider-errors',
    'enhance',
    'no-provider',
    'Enhance without an AI provider: the notes unchanged, Set up a provider',
  ),
  win(
    'provider-errors',
    'ask',
    'no-credits',
    'The provider refused for billing (no credits): the error, nothing lost',
  ),
  win(
    'provider-errors',
    'ask',
    'overloaded',
    'The provider is overloaded: its message after retries, and Try again',
  ),
  win(
    'provider-errors',
    'ask',
    'private-meeting',
    'Asking about a private meeting with a cloud provider: “Private meetings stay on this computer”, not an error',
  ),
  shell('calendar-offline', 'topbar', 'unavailable', 'Top bar: calendar unavailable, and why'),
  shell('calendar-offline', 'topbar', 'off', 'Top bar: calendar access is off'),
  win(
    'calendar-offline',
    'onboarding',
    'calendar-status',
    'Onboarding / Preferences: calendar not available',
  ),

  // ---- Agendas, live intelligence and BYO agent (the window's states built; the rest planned)
  win('agenda-plan', 'window', 'delete-undo', 'Prep: an item deleted at once, Undo in the toast restores it'),
  plannedCli(
    'agenda-plan',
    'skill',
    'interview',
    'Claude Code + skill: goals interview, past sessions with the attendees, draft items',
  ),
  win('agenda-plan', 'saved', 'agenda', 'Prep: the agenda saved in kacola, linked to the calendar event'),
  win('agenda-plan', 'edit', 'items', 'Editing an item: text, kind, owner, outcome (no timebox asked for)'),
  win('agenda-plan', 'context', 'share-or-keep', 'Context cards: private by default, shared only when asked'),
  planned(
    'agenda-invite',
    'write',
    'invite-block',
    '"Agenda: kacola://… · web: https://…" written into the invite (opt-in)',
  ),
  win(
    'agenda-invite',
    'fallback',
    'copy-link',
    'Sent, but the calendar is read-only: the invitation text (a web link anyone can open) to paste',
  ),
  win(
    'agenda-live',
    'panel',
    'items',
    'Live: the narrow agenda checklist — covered ticked and quiet, the current one highlighted',
  ),
  win(
    'agenda-live',
    'check-off',
    'auto-covered',
    'An item ticked off from what was said: quietly “ticked by kacola”, with Undo',
  ),
  win(
    'agenda-live',
    'presence',
    'agent',
    'Your Claude in the live header, its permission said plainly; the popover: mode, activity, Disconnect',
  ),
  win(
    'agenda-live',
    'suggest',
    'looks-covered',
    'The one suggestion slot: “Looks covered?” with Accept / Not now',
  ),
  win('agenda-live', 'next-point', 'card', 'The one suggestion slot: “Say next” with its line'),
  win(
    'agenda-live',
    'context',
    'panel',
    'Private context in the live rail: hidden in case you share your screen, shown on demand',
  ),
  win(
    'agenda-recap',
    'per-item',
    'outcomes',
    'Outcome: decided and to do from the recap, the agenda as a recap beside it',
  ),
  win(
    'agenda-recap',
    'carry-over',
    'next-occurrence',
    'The next meeting’s Prep: the open items carried over',
  ),
  win(
    'agenda-share',
    'share',
    'dialog',
    'Send the agenda: a preview of exactly what attendees get; private notes stay on this computer',
  ),
  win(
    'agenda-share',
    'shared',
    'link',
    'Shared: your name, attendees who run kacola, the web link to copy, the sync state, Unshare',
  ),
  win(
    'agenda-share',
    'follow',
    'code',
    'An attendee follows the link in their own kacola: their email, then the code it was sent',
  ),
  win(
    'agenda-share',
    'history',
    'merge',
    'Prep › Sharing: comments, people, and every device’s changes with their outcome',
  ),
  win('agenda-share', 'recap', 'shared', 'Share recap: the outcomes reach the link'),
  win('agenda-share', 'revoked', 'banner', 'The organiser stopped sharing: the attendee keeps a copy'),
  win(
    'agenda-team',
    'shared',
    'teammate-items',
    'A recurring meeting’s agenda: teammates’ items, each person’s agent checking off',
  ),
  web('agenda-invitee', 'web', 'agenda', 'Invitee without kacola: the agenda on the web', {
    responsive: true,
  }),
  web('agenda-invitee', 'web', 'add-item', 'Invitee adds an item with their email (a one-time code)'),
  web('agenda-invitee', 'web', 'recap', 'Invitee sees the outcome recap, never private notes', {
    responsive: true,
  }),
  plannedShell('agenda-live', 'topbar', 'next-point', 'Top bar: the next talking point while recording'),
]
