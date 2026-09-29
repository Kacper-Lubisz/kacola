import type {
  AnyEvent,
  AskStreamEvent,
  AudioDevice,
  BodyIn,
  EnhanceStreamEvent,
  Health,
  ModelInfo,
  Note,
  NotesState,
  NoteTemplate,
  QaMessage,
  Session,
  Settings,
  SettingsPatch,
  Speaker,
  SpeakerSummary,
  TemplateSuggestion,
  Transcript,
} from '@gnomeola/protocol'

// Where the UI's data comes from. Two implementations: the real daemon over the protocol client,
// and an in-process demo that fabricates a live-updating list (GNOMEOLA_UI_DEMO=1). The store and
// every component see only this interface, so the demo exercises exactly the UI code the daemon does.

export type Snapshot = {
  sessions: Session[]
  /** The durable seq the snapshot is known to include; subscribe from here. */
  seq: number
  /** The health report the cursor came from (capture availability, models, LLM readiness). */
  health: Health | null
}

export type SubscribeHandlers = {
  since: number
  signal: AbortSignal
  onEvent: (e: AnyEvent) => void
  onConnect: () => void
  onDisconnect: (err: unknown) => void
}

export interface DataSource {
  /** Human-readable origin for status text: a URL, or "demo". */
  readonly origin: string
  load(signal: AbortSignal): Promise<Snapshot>
  /** Stream events after `since` until the signal aborts, reconnecting on its own. */
  subscribe(h: SubscribeHandlers): Promise<void>
  /** Create a session and start recording it. */
  startRecording(): Promise<Session>
  stopRecording(id: string): Promise<Session>

  /** The whole transcript of one session (best quality per segment), private sessions included. */
  transcript(sessionId: string, signal?: AbortSignal): Promise<Transcript>
  qaHistory(sessionId: string, signal?: AbortSignal): Promise<QaMessage[]>
  /** POST /ask: question, delta*, then answer | error. Throws before the stream on a 4xx/5xx. */
  ask(body: BodyIn<'ask'>, signal?: AbortSignal): AsyncIterable<AskStreamEvent>

  health(signal?: AbortSignal): Promise<Health>
  getSettings(signal?: AbortSignal): Promise<Settings>
  updateSettings(patch: SettingsPatch): Promise<Settings>
  /** Store (or with null, clear) the LLM API key. The key is write-only: nothing ever reads it back. */
  setApiKey(key: string | null): Promise<{ configured: boolean }>
  listDevices(signal?: AbortSignal): Promise<AudioDevice[]>
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>
  downloadModel(id: string): Promise<ModelInfo>

  // ---- M7: notes + enhancement (private sessions included: this is the window)
  notes(sessionId: string, signal?: AbortSignal): Promise<NotesState>
  putNotes(sessionId: string, body: BodyIn<'putNotes'>): Promise<Note>
  /** POST enhance: started, delta*, then done | error. Throws before the stream on a 4xx/5xx. */
  enhanceNotes(
    sessionId: string,
    body: BodyIn<'enhanceNotes'>,
    signal?: AbortSignal,
  ): AsyncIterable<EnhanceStreamEvent>
  mergeNotes(sessionId: string, body: BodyIn<'mergeNotes'>): Promise<Note>
  templates(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ templates: NoteTemplate[]; suggested: TemplateSuggestion }>

  // ---- M3: attribution (the resulting changes also arrive as durable events)
  /** `me`, each far-end speaker, and `them` while anything is unattributed. */
  listSpeakers(sessionId: string, signal?: AbortSignal): Promise<SpeakerSummary[]>
  renameSpeaker(sessionId: string, speakerId: string, label: string): Promise<Speaker>
  /** Fold `speakerId` into `into`; returns the surviving speaker. */
  mergeSpeaker(sessionId: string, speakerId: string, into: string): Promise<Speaker>
  /** Move these segments of `speakerId` (or of `them`) to a new speaker; returns it. */
  splitSpeaker(sessionId: string, speakerId: string, segmentIds: string[]): Promise<Speaker>
}
