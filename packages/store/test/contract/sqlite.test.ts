import { SqliteStoreApi } from '../../src/index.ts'
import { storeContract } from './suite.ts'

// V-8: the dialect contract on SQLite (the local build), through the async StoreApi adapter.
storeContract('sqlite', async (o) => SqliteStoreApi.open(':memory:', o?.now ? { now: o.now } : {}))
