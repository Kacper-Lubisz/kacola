// @gnomeola/daemon — gnomeolad. The entry point is ./main.ts; this module is for composing a daemon in
// process (tests, or an alternative entry point) and for implementing the injectable interfaces.
// ---- agent channel: leases, the live stream, the SpeechGuard seam

// ---- Agendas wave 2: the live tracker, its SpeechGuard, the recap, and eval runners over them
export { formatOutcome } from './agendas/recap.ts'
// (the SpeechGuard / SpeechInput types themselves are the agent channel's export; this is structurally one)
export { type DecisionSpeechGuard, decisionSpeechGuard } from './agendas/speech-guard.ts'
export { AgendaTracker, type TrackerDecisions, type TrackerOptions } from './agendas/tracker.ts'
export {
  trackerInjectionRunner,
  trackerInterviewRunner,
  trackerNextPointRunner,
  trackerRelevanceRunner,
  trackerStatusRunner,
} from './agendas/tracker-eval.ts'
export {
  AgentChannel,
  type AgentChannelDeps,
  type AgentLimits,
  DEFAULT_AGENT_LIMITS,
} from './agents/channel.ts'
export {
  heuristicGuard,
  INJECTION_FLAG,
  looksSecret,
  passThroughGuard,
  runGuard,
  type SpeechGuard,
  type SpeechInput,
  type SpeechVerdict,
} from './agents/guard.ts'
export { MAX_CROSS_SESSION } from './ask.ts'
export { type BusListener, EventBus } from './bus.ts'
// ---- M4: calendar, D-Bus, auto-record
export { extractJoinLink } from './calendar/join-links.ts'
export {
  type CalendarProvider,
  EdsCalendarProvider,
  FileCalendarProvider,
  ManualCalendarProvider,
  NoCalendar,
} from './calendar/providers.ts'
export { CalendarService } from './calendar/service.ts'
export { defaultDataDir, type MainConfig, parseConfig, UsageError } from './config.ts'
export { RecordingControl } from './control.ts'
export {
  type Ctx,
  createDaemon,
  type Daemon,
  type DaemonOptions,
  type Handlers,
  type JsonHandler,
  LOOPBACK_HOSTS,
  type SseHandler,
  VERSION,
} from './daemon.ts'
export { LlmNotesEngine } from './engines/enhance.ts'
export { type ApiErrorCode, DaemonError, STATUS, toDaemonError } from './errors.ts'
export { FakeNotesEngine } from './fakes/notes.ts'
export { FakePipeline, type FakePipelineOptions, FakeRecording } from './fakes/pipeline.ts'
export {
  FakeDevices,
  FakeModels,
  FakeQaEngine,
  NoDevices,
  NoModels,
  UnavailablePipeline,
} from './fakes/providers.ts'
export { loadScript, type MeetingScript, ScriptedRecording, type ScriptLine } from './fakes/scripted.ts'
export { ScriptedPipeline } from './fakes/scripted-pipeline.ts'
export type * from './interfaces.ts'
export { MemoryKeyring, NoKeyring, SecretToolKeyring, type SecretToolOptions } from './keyring.ts'
export { ACTIVE, isActive, type LifecycleAction, nextStatus } from './lifecycle.ts'
export { type LogFields, Logger, type LoggerOptions, type LogLevel, REDACTED } from './logger.ts'
export {
  ManualMicActivity,
  type MicActivitySource,
  type MicUser,
  otherMicUsers,
  PwDumpMicActivity,
} from './mic-activity.ts'
export type { EnhanceChunk, EnhanceRequest, NotesEngine } from './notes/engine.ts'
export {
  BUILT_IN_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  keywordMatches,
  suggestTemplate,
} from './notes/templates.ts'
export { SessionManager } from './sessions.ts'
export { DEFAULT_SETTINGS, mergeSettings, SettingsService } from './settings.ts'
