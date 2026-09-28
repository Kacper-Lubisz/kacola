import { createClient, DEFAULT_BASE_URL, type GnomeolaClient } from '@gnomeola/protocol'
import type { Format, Io } from './output.ts'

export type Ctx = {
  io: Io
  client: GnomeolaClient
  format: Format
  now: Date
}

export function makeClient(url: string | undefined, io: Io): GnomeolaClient {
  return createClient({
    baseUrl: url ?? io.env.GNOMEOLA_URL ?? DEFAULT_BASE_URL,
    timeoutMs: 30_000,
    headers: { 'x-gnomeola-client': 'cli' },
  })
}
