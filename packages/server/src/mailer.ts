// Team sharing sends one kind of email: the magic-link code an invitee (or a member's daemon) asks for.
// The mailer is pluggable so the server never depends on a mail provider:
//
//   MemoryMailer    tests: keeps every message
//   webhookMailer   POSTs {to, subject, text} as JSON to a URL you run (a relay to SES, Postmark, Resend,
//                   an SMTP bridge, …) — GNOMEOLA_MAIL_WEBHOOK, optional GNOMEOLA_MAIL_WEBHOOK_SECRET sent
//                   as a Bearer token
//   consoleMailer   development only (GNOMEOLA_MAILER=console): writes the message to the log
//
// Without a mailer, contributions are off: the page shows the agenda read-only.

export type Mail = { to: string; subject: string; text: string }

export interface Mailer {
  readonly name: string
  send(m: Mail): Promise<void>
}

export class MemoryMailer implements Mailer {
  readonly name = 'memory'
  readonly sent: Mail[] = []
  async send(m: Mail): Promise<void> {
    this.sent.push(m)
  }
  /** The latest message to `to`. */
  last(to: string): Mail | undefined {
    return this.sent.filter((m) => m.to === to).at(-1)
  }
}

export function webhookMailer(url: string, secret?: string, f: typeof fetch = fetch): Mailer {
  return {
    name: 'webhook',
    async send(m) {
      const res = await f(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(m),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`mail webhook answered ${res.status}`)
    },
  }
}

export function consoleMailer(
  log: (m: Mail) => void = (m) => console.error(JSON.stringify({ mail: m })),
): Mailer {
  return {
    name: 'console',
    async send(m) {
      log(m)
    },
  }
}

export function mailerFromEnv(env: Record<string, string | undefined>): Mailer | null {
  if (env.GNOMEOLA_MAIL_WEBHOOK)
    return webhookMailer(env.GNOMEOLA_MAIL_WEBHOOK, env.GNOMEOLA_MAIL_WEBHOOK_SECRET)
  if (env.GNOMEOLA_MAILER === 'console') return consoleMailer()
  return null
}
