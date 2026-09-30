export type {
  AudioChunkRecord,
  CommitListener,
  DeviceRecord,
  DomainSnapshot,
  PairingClaim,
  PairingRecord,
  StoreApi,
} from './api.ts'
export { decideIngest, type IngestDecision, type IngestFacts } from './domain.ts'
export { capSnippet, SNIPPET_MAX_CHARS, SNIPPET_TOKENS, toFtsQuery } from './fts.ts'
export {
  BOOKKEEPING_TABLES,
  type Migration,
  type MigrationResult,
  migrate,
  migrations,
  SchemaError,
  schemaVersion,
} from './migrations.ts'
export { NoteStore } from './notes.ts'
export { parseQuery, searchText, snippet, toTsQuery } from './search-text.ts'
export { SqliteStoreApi } from './sqlite-api.ts'
export {
  type ListSessionsOptions,
  type SearchOptions,
  type SegmentInput,
  Store,
  StoreError,
  type StoreOptions,
  type TranscriptOptions,
  type TranscriptWindow,
} from './store.ts'
