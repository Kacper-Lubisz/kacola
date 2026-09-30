import { createClient, DEFAULT_BASE_URL, type GnomeolaClient } from '@gnomeola/protocol'
import { tokenFor } from './hosts.ts'
import type { ActiveLease } from './lease.ts'
import type { Format, Io } from './output.ts'

export type Ctx = {
  io: Io
  client: GnomeolaClient
  format: Format
  now: Date
  /** Agent channel: the lease this command acts under (its client then presents it). */
  lease?: ActiveLease | null
}

export function makeClient(url: string | undefined, io: Io, token?: string): GnomeolaClient {
  const baseUrl = url ?? io.env.GNOMEOLA_URL ?? DEFAULT_BASE_URL
  // A remote host needs the token from `gnomeola pair` (M8); a loopback daemon needs none.
  const t = tokenFor(io.env, baseUrl, token)
  return createClient({
    baseUrl,
    timeoutMs: 30_000,
    headers: { 'x-gnomeola-client': 'cli' },
    ...(t ? { token: t } : {}),
  })
}
