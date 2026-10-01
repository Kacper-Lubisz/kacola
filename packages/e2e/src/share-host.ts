import { PGlite } from '@electric-sql/pglite'
import { createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { createHostedApp, MemoryMailer, type Served, serve } from '@gnomeola/server'
import type { StoreApi } from '@gnomeola/store/core'
import { openPglite } from '@gnomeola/store/pg'

// A local hosted server for team sharing (docs/sharing.md), the same set-up as the daemon's
// team-sharing.int test: the real hosted app over PGlite (Postgres in WASM), its pairing admin token
// for the owner's daemon (GNOMEOLA_SHARE_URL / GNOMEOLA_SHARE_TOKEN), and an in-memory mailer the test
// reads magic-link codes from. Tests that need it: the CLI's sharing goldens, the window's sharing e2e,
// the atlas.

export const SHARE_ADMIN = 'e2e-share-admin-token-0123456789abcdef'

export type ShareHost = {
  url: string
  store: StoreApi
  mailer: MemoryMailer
  /** The daemon environment that makes it share on this host as `name` <`email`>. */
  ownerEnv: (o: { name: string; email: string }) => Record<string, string>
  /** The magic-link code last mailed to `email`. */
  codeFor: (email: string) => string
  /** A client acting through the public link (an invitee's browser). */
  web: (participantToken?: string) => GnomeolaClient
  /** An invitee confirms `email` on the link: returns a client that adds items and comments as them. */
  invitee: (token: string, email: string, name?: string) => Promise<GnomeolaClient>
  close: () => Promise<void>
}

export async function startShareHost(): Promise<ShareHost> {
  const store = await openPglite(new PGlite())
  const mailer = new MemoryMailer()
  const served: Served = await serve(
    createHostedApp({
      store,
      blobs: new (await import('@gnomeola/store/blob')).MemoryBlobStore(),
      auth: { secret: 's'.repeat(40), adminToken: SHARE_ADMIN },
      trustLoopback: false,
      mailer,
    }),
  )
  const codeFor = (email: string) => {
    const m = /code is ([A-Z]{4}-[A-Z]{4})/.exec(mailer.last(email)?.text ?? '')
    if (!m) throw new Error(`no code was mailed to ${email}`)
    return m[1]!
  }
  const web = (participantToken?: string) =>
    createClient({
      baseUrl: served.url,
      ...(participantToken ? { headers: { 'x-gnomeola-participant': participantToken } } : {}),
    })
  return {
    url: served.url,
    store,
    mailer,
    ownerEnv: ({ name, email }) => ({
      GNOMEOLA_SHARE_URL: served.url,
      GNOMEOLA_SHARE_TOKEN: SHARE_ADMIN,
      GNOMEOLA_OWNER_NAME: name,
      GNOMEOLA_OWNER_EMAIL: email,
    }),
    codeFor,
    web,
    invitee: async (token, email, name) => {
      await web().call('shareVerify', { params: { token }, body: { email, ...(name ? { name } : {}) } })
      const conf = await web().call('shareConfirm', {
        params: { token },
        body: { email, code: codeFor(email) },
      })
      return web(conf.token)
    },
    close: async () => {
      await served.close()
      await store.close()
    },
  }
}

/** The token of a `…/a/<token>` link. */
export const linkToken = (link: string): string => link.split('/a/')[1]!
