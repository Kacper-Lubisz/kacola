// @gnomeola/daemon — gnomeolad. The entry point is ./main.ts; this module is for composing a daemon in
// process (tests, or an alternative entry point) and for implementing the injectable interfaces.
export { MAX_CROSS_SESSION } from './ask.ts'
export { type BusListener, EventBus } from './bus.ts'
export { defaultDataDir, type MainConfig, parseConfig, UsageError } from './config.ts'
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
export type * from './interfaces.ts'
export { MemoryKeyring, NoKeyring, SecretToolKeyring, type SecretToolOptions } from './keyring.ts'
export { ACTIVE, isActive, type LifecycleAction, nextStatus } from './lifecycle.ts'
export { type LogFields, Logger, type LoggerOptions, type LogLevel, REDACTED } from './logger.ts'
export type { EnhanceChunk, EnhanceRequest, NotesEngine } from './notes/engine.ts'
export {
  BUILT_IN_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  keywordMatches,
  suggestTemplate,
} from './notes/templates.ts'
export { SessionManager } from './sessions.ts'
export { DEFAULT_SETTINGS, mergeSettings, SettingsService } from './settings.ts'
