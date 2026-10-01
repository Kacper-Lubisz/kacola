// @gnomeola/store/core — the driver-free part of the store: the StoreApi contract, its error type and
// the pure domain rules. The hosted server imports this (plus ./pg or the SQLite entry at its edge), so
// its request handling never pulls in a database driver.
export type * from './api.ts'
export { decideIngest, type IngestDecision, type IngestFacts } from './domain.ts'
export { StoreError } from './errors.ts'
export { BOOKKEEPING_TABLES } from './migrations.ts'
export * as shares from './shares.ts'
export {
  decideSharedStatus,
  SHARE_LIMITS,
  ShareForbidden,
  ShareGone,
  type SharePlan,
  ShareRateLimited,
} from './shares.ts'
export type { ShareKey, ShareState } from './shares-apply.ts'
