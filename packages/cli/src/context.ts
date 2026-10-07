import { createClient, DEFAULT_BASE_URL, type KacolaClient } from '@kacola/protocol'
import { tokenFor } from './hosts.ts'
import type { ActiveLease } from './lease.ts'
import type { Format, Io } from './output.ts'

export type Ctx = {
  io: Io
  client: KacolaClient
  format: Format
  now: Date
  /** Agent channel: the lease this command acts under (its client then presents it). */
  lease?: ActiveLease | null
}

export function makeClient(url: string | undefined, io: Io, token?: string): KacolaClient {
  const baseUrl = url ?? io.env.KACOLA_URL ?? DEFAULT_BASE_URL
  // A remote host needs the token from `kacola pair` (M8); a loopback daemon needs none.
  const t = tokenFor(io.env, baseUrl, token)
  return createClient({
    baseUrl,
    timeoutMs: 30_000,
    headers: { 'x-kacola-client': 'cli' },
    ...(t ? { token: t } : {}),
  })
}
