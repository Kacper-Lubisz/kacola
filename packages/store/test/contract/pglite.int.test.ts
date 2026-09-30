import { pgliteStore } from './pglite.ts'
import { storeContract } from './suite.ts'

// V-8: the dialect contract on Postgres, embedded (PGlite: the real Postgres engine compiled to WASM).
// Int tier because each test boots its own database (~0.2 s from a template).
storeContract('postgres/pglite', (o) => pgliteStore(o))
