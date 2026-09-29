// Store errors carry a wire-level code so every layer above (daemon, hosted server) maps them to the same
// HTTP status. Kept free of any driver import so the Postgres build can use it without better-sqlite3.
export class StoreError extends Error {
  readonly code: 'not_found' | 'conflict' | 'bad_request'
  constructor(code: StoreError['code'], message: string) {
    super(message)
    this.name = 'StoreError'
    this.code = code
  }
}
