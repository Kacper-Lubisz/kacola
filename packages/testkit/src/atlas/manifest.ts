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
    'Onboarding skipped: the empty window, with the missing-model banner',
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

  // ---- Start a recording
  win(
    'record-now',
    'idle',
    'record-button',
    'The window with meetings in the sidebar and the Record button',
    {
      responsive: true,
    },
  ),
  win('record-now', 'recording', 'live-transcript', 'Recording: live lines, a partial line, level meters', {
    responsive: true,
    note: 'held by the fake pipeline at 30 s of audio; the elapsed timer is masked',
  }),
  win('record-now', 'paused', 'paused', 'Paused: the timer stops, nothing is transcribed', {
    note: 'the elapsed timer is masked',
  }),
  win('record-now', 'stopped', 'finished', 'Stopped: the finished recording, every line final', {
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
    'The window shows the meeting joined from the top bar, recording and linked',
  ),
  win(
    'auto-record-calendar',
    'preferences',
    'rule-on',
    'Preferences › Auto-record: "When a Calendar Meeting Starts" switched on',
  ),
  win(
    'auto-record-calendar',
    'begins',
    'recording-row',
    'The meeting began: recorded, titled after the event, live in the sidebar',
  ),
  win(
    'auto-record-mic',
    'preferences',
    'rule-on',
    'Preferences › Auto-record: "When Another App Uses the Microphone" switched on',
  ),
  win(
    'agent-record',
    'window',
    'session-appears',
    'A recording started by the CLI / Claude appears live in the window',
  ),
  cli('agent-record', 'cli', 'record-status', '`gnomeola record status` while that recording runs', {
    cli: { argv: ['record', 'status'] },
  }),
  win(
    'deep-link',
    'open',
    'meeting-link',
    'kacola://meeting/<eventUid>: the app opens that meeting (creates its agenda)',
  ),
  win('deep-link', 'live', 'join-offer', 'The meeting is under way: "Join and record" offered'),
  planned('deep-link', 'open', 'agenda-link', 'kacola://agenda/<id>: the agenda opens'),

  // ---- During the meeting
  win('live-transcript', 'search', 'live', 'Searching the transcript while it grows (Ctrl+F)'),
  win('live-transcript', 'detached', 'jump-to-live', 'Scrolled back while recording: "Jump to Live" appears'),
  win('speakers', 'transcript', 'chips', 'Who said what: speaker chips on a diarized meeting'),
  win('speakers', 'dialog', 'list', 'The Speakers dialog: everyone in the meeting and how much they said'),
  win('speakers', 'rename', 'field', 'Naming a speaker inline'),
  win('speakers', 'merge', 'menu', 'Merging two speakers who are the same person'),
  win('speakers', 'line', 'someone-else', 'A far-end line selected: "Someone Else Said This" splits it off'),
  win(
    'speakers',
    'preferences',
    'voiceprints',
    'Preferences › Speakers: tell apart, and recognise people across meetings',
  ),
  win('ask-live', 'during', 'empty', 'Ask while recording: the question field over the live meeting'),
  win(
    'ask-live',
    'during',
    'answered',
    'An answer during the meeting, with citations into the live transcript',
  ),
  win(
    'private-session',
    'view',
    'private',
    'A private meeting: marked, hidden from the CLI and the Claude skill',
    {
      responsive: true,
    },
  ),
  win(
    'private-session',
    'details',
    'switch',
    'Details › Private: the switch that hides a meeting from agents',
  ),
  shell(
    'private-session',
    'topbar',
    'private-meeting',
    'Recording a private meeting: the top bar says only "Private meeting"',
  ),

  // ---- After the meeting
  win('find-meeting', 'search', 'matches', 'Searching the sidebar by title'),
  win('find-meeting', 'search', 'no-matches', 'No matching sessions'),
  win('find-meeting', 'open', 'transcript', 'A meeting opened: its transcript', { responsive: true }),
  win('find-meeting', 'transcript-search', 'matches', 'Search inside the transcript (Ctrl+F): "1 of 2"'),
  win('find-meeting', 'details', 'details', 'Details: when, how long, tracks, recording gaps'),
  win('ask-meeting', 'open', 'empty', 'Ask About This Meeting: empty', { responsive: true }),
  win('ask-meeting', 'asking', 'streaming', 'The answer streaming in', {
    note: 'the provider stream is held mid-answer',
  }),
  win('ask-meeting', 'answered', 'citations', 'Answered, with citation chips', { responsive: true }),
  win(
    'ask-meeting',
    'citation',
    'line-highlighted',
    'A citation followed: the cited line selected in the transcript',
  ),
  win('ask-meeting', 'refused', 'notice', 'The model declined: the notice replaces the partial answer'),
  win('ask-across', 'scope', 'last-30-days', 'Scope set to the last 30 days'),
  win('ask-across', 'answered', 'cross-meeting', 'An answer across meetings: chips open the cited meeting'),
  cli('ask-across', 'cli', 'ask-since', '`gnomeola ask … --since 14d` from Claude', {
    cli: { argv: ['ask', 'What did we decide about the retry budget?', '--since', '30d'] },
  }),
  win('notes-write', 'editor', 'notes', 'The notes editor (markdown) with this meeting’s notes', {
    responsive: true,
  }),
  win('notes-write', 'actions', 'action-items', 'Action items with owner and due date'),
  win('notes-templates', 'menu', 'open', 'Choose a Template: enhance as standup / 1:1 / interview …'),
  win('notes-templates', 'manage', 'dialog', 'Notes Templates: built-in and custom'),
  win('notes-templates', 'new', 'form', 'A new template: name, keywords, instructions'),
  win('notes-templates', 'suggested', 'calendar', 'A template suggested by the calendar event'),
  win('notes-enhance', 'enhancing', 'mid-stream', 'Enhancing: the enhanced notes streaming in', {
    note: 'the provider stream is held mid-answer',
  }),
  win('notes-enhance', 'review', 'changes', 'Review Enhanced Notes: accept or revert each change', {
    responsive: true,
  }),
  win('notes-enhance', 'applied', 'notes', 'Applied: the reviewed notes; the original stays in history'),
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
    'Decisions provider (jev, OpenAI, Anthropic, Ollama, local) and its key',
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
  win('help-about', 'shortcuts', 'dialog', 'Keyboard Shortcuts (Ctrl+?)'),
  win('help-about', 'about', 'dialog', 'About gnomeola: version, licence, Granola credit'),
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
  win('daemon-down', 'window', 'cant-reach', 'Can’t Reach gnomeola, with Try Again', { responsive: true }),
  shell('daemon-down', 'topbar', 'not-running', 'Top bar: gnomeola is not running'),
  cli('daemon-down', 'cli', 'exit-3', 'The CLI says the daemon is unreachable (exit 3)', {
    cli: { argv: ['search', 'retry budget'] },
  }),
  win('connection-lost', 'window', 'reconnecting', 'Lost the connection to the daemon: reconnecting'),
  win('recovered-session', 'list', 'recovered', 'A recording the daemon recovered after a crash'),
  win('no-models', 'window', 'banner', 'A speech model is missing: the banner offers Set Up'),
  win('provider-errors', 'ask', 'no-provider', 'Questions aren’t available: no provider, Open Preferences'),
  win('provider-errors', 'enhance', 'no-provider', 'Enhancing needs a language model provider'),
  win(
    'provider-errors',
    'ask',
    'no-credits',
    'The provider refused for billing (no credits): the error, nothing lost',
  ),
  win('provider-errors', 'ask', 'overloaded', 'The provider is overloaded: the error after retries'),
  shell('calendar-offline', 'topbar', 'unavailable', 'Top bar: calendar unavailable, and why'),
  shell('calendar-offline', 'topbar', 'off', 'Top bar: calendar access is off'),
  win(
    'calendar-offline',
    'onboarding',
    'calendar-status',
    'Onboarding / Preferences: calendar not available',
  ),

  // ---- Agendas, live intelligence and BYO agent (the window's states built; the rest planned)
  win('agenda-plan', 'window', 'plan-with-claude', 'The meeting’s "Plan with Claude" entry'),
  plannedCli(
    'agenda-plan',
    'skill',
    'interview',
    'Claude Code + skill: goals interview, past sessions with the attendees, draft items',
  ),
  win('agenda-plan', 'saved', 'agenda', 'The agenda saved in kacola, linked to the calendar event'),
  win('agenda-plan', 'edit', 'items', 'Editing items: kind, owner, timebox, order'),
  win('agenda-plan', 'context', 'share-or-keep', 'Context cards: private by default, shared only when asked'),
  planned(
    'agenda-invite',
    'write',
    'invite-block',
    '"Agenda: kacola://… · web: https://…" written into the invite (opt-in)',
  ),
  win('agenda-invite', 'fallback', 'copy-link', 'Read-only calendar: copy the link instead'),
  win('agenda-live', 'panel', 'items', 'Live agenda panel: open / in progress / covered'),
  win(
    'agenda-live',
    'check-off',
    'auto-covered',
    'An item checked off from what was said (undoable), with its evidence',
  ),
  win(
    'agenda-live',
    'presence',
    'agent',
    'The connected Claude in the header: reading, its mode, its activity, Disconnect',
  ),
  win('agenda-live', 'suggest', 'looks-covered', '"Looks covered?" when the tracker is unsure'),
  win('agenda-live', 'next-point', 'card', 'The one "next talking point" card with a bridge line'),
  win('agenda-live', 'time', 'not-covered', 'Five minutes before the end: what is not covered yet'),
  win('agenda-live', 'context', 'panel', 'The context panel: cards from the agenda and the connected agent'),
  win(
    'interview-mode',
    'panel',
    'told-not-told',
    'Interview: Told / Not told yet, with the answer heard and a quote',
  ),
  planned('interview-mode', 'nudge', 'not-covered', 'The five-minute "not covered" nudge'),
  win('interview-mode', 'interviewer', 'competencies', 'Interviewer: competencies covered'),
  win('agenda-recap', 'per-item', 'outcomes', 'The recap: outcome, decisions and actions per item'),
  win('agenda-recap', 'carry-over', 'next-occurrence', 'Open items rolled to the next occurrence'),
  planned(
    'agenda-team',
    'shared',
    'teammate-items',
    'A recurring meeting’s agenda: teammates’ items, each person’s agent checking off',
  ),
  plannedWeb('agenda-invitee', 'web', 'agenda', 'Invitee without kacola: the agenda on the web'),
  plannedWeb('agenda-invitee', 'web', 'add-item', 'Invitee adds an item with their email'),
  plannedWeb('agenda-invitee', 'web', 'recap', 'Invitee sees the outcome recap, never private notes'),
  plannedShell('agenda-live', 'topbar', 'next-point', 'Top bar: the next talking point while recording'),
]
