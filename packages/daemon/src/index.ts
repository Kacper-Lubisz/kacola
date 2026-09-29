// @gnomeola/daemon — gnomeolad. The entry point is ./main.ts; this module is for composing a daemon in
// process (tests, or an alternative entry point) and for implementing the injectable interfaces.
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
export { type ApiErrorCode, DaemonError, STATUS, toDaemonError } from './errors.ts'
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
export {
  ManualMicActivity,
  type MicActivitySource,
  type MicUser,
  otherMicUsers,
  PwDumpMicActivity,
} from './mic-activity.ts'
export { SessionManager } from './sessions.ts'
export { DEFAULT_SETTINGS, mergeSettings, SettingsService } from './settings.ts'
