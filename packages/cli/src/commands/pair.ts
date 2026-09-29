import { GnomeolaApiError, PairToken } from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT } from '../errors.ts'
import { hostKey, readHosts, saveHost } from '../hosts.ts'
import { renderJson } from '../output.ts'

// H-6 on the command line — the device-code flow:
//
//   gnomeola pair --url https://you.vercel.app          on the NEW device: prints a code, waits
//   gnomeola pair approve BDFG-HJKL [--url …]           on a TRUSTED one (or the machine running the
//                                                       daemon, where loopback needs no token)
//   gnomeola pair token --url …                         print the saved token (for GNOMEOLA_SYNC_TOKEN)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function pair(ctx: Ctx, opts: { name?: string; timeoutMs?: number }): Promise<void> {
  const { client, io } = ctx
  const name = opts.name ?? io.env.HOSTNAME ?? 'gnomeola CLI'
  const start = await client.call('pairStart', { body: { name } })
  const url = `${hostKey(client.baseUrl)}${start.verificationPath}`
  if (ctx.format === 'json') {
    io.stdout(
      renderJson(
        { event: 'pending', userCode: start.userCode, verificationUrl: url, expiresAt: start.expiresAt },
        io,
      ),
    )
  } else {
    io.stdout(
      `To pair this device with ${client.baseUrl}, approve code  ${start.userCode}  on a trusted device:\n`,
    )
    io.stdout(`    gnomeola pair approve ${start.userCode}      (on the machine running gnomeolad)\n`)
    io.stdout(`    ${url}      (the web viewer, signed in)\n`)
    io.stdout(`Waiting for approval (expires ${start.expiresAt})…\n`)
  }
  const deadline = Math.min(
    Date.parse(start.expiresAt),
    Date.now() + (opts.timeoutMs ?? Number.POSITIVE_INFINITY),
  )
  for (;;) {
    let r: PairToken
    try {
      r = PairToken.parse(await client.call('pairToken', { body: { deviceCode: start.deviceCode } }))
    } catch (err) {
      if (err instanceof GnomeolaApiError && err.code === 'not_found')
        throw new CliError(EXIT.ERROR, 'the pairing request expired or was used; run `gnomeola pair` again')
      throw err
    }
    if (r.status === 'approved') {
      const file = saveHost(io.env, client.baseUrl, {
        token: r.token,
        deviceId: r.deviceId,
        name,
        pairedAt: new Date().toISOString(),
      })
      if (ctx.format === 'json')
        io.stdout(renderJson({ event: 'paired', deviceId: r.deviceId, hostsFile: file }, io))
      else io.stdout(`Paired as ${r.deviceId}. Token saved to ${file}\n`)
      return
    }
    if (Date.now() + start.intervalMs > deadline)
      throw new CliError(
        EXIT.ERROR,
        `code ${start.userCode} was not approved in time; run \`gnomeola pair\` again`,
      )
    await sleep(start.intervalMs)
  }
}

export async function pairApprove(ctx: Ctx, code: string | undefined): Promise<void> {
  if (!code) throw new CliError(EXIT.USAGE, 'usage: gnomeola pair approve <CODE>')
  const r = await ctx.client.call('pairApprove', { body: { userCode: code } }).catch((err: unknown) => {
    if (err instanceof GnomeolaApiError && err.code === 'not_found')
      throw new CliError(EXIT.NOT_FOUND, `no pending pairing request with code ${code} (it may have expired)`)
    throw err
  })
  if (ctx.format === 'json') ctx.io.stdout(renderJson(r, ctx.io))
  else ctx.io.stdout(`Approved “${r.name}” as ${r.deviceId}.\n`)
}

export function pairToken(ctx: Ctx): void {
  const entry = readHosts(ctx.io.env)[hostKey(ctx.client.baseUrl)]
  if (!entry)
    throw new CliError(
      EXIT.NOT_FOUND,
      `this device is not paired with ${ctx.client.baseUrl}; run \`gnomeola pair\``,
    )
  ctx.io.stdout(`${entry.token}\n`)
}
