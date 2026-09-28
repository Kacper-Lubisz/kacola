import { closeSync, existsSync, mkdirSync, openSync, renameSync, statSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

// Structured logger: JSON lines to a file under the data dir, plus an in-memory ring buffer that
// /diagnostics serves. Secrets are redacted before a line exists anywhere — registered secret values
// (the API key, once known), anything shaped like an Anthropic key, and any field whose name says
// it is a credential.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

export const REDACTED = '[REDACTED]'
const SECRET_FIELD = /(api[-_]?key|secret|token|password|authorization|credential)/i
const KEY_SHAPES = [/sk-ant-[A-Za-z0-9_-]{8,}/g]

export type LoggerOptions = {
  /** Log file path. Omit for memory only. */
  file?: string
  /** Lines kept for /diagnostics. */
  capacity?: number
  /** Also echo lines to stderr (for journald under systemd). */
  echo?: boolean
  minLevel?: LogLevel
  /** Rotate the file at startup if it is larger than this. */
  maxFileBytes?: number
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export class Logger {
  private readonly ring: string[] = []
  private readonly capacity: number
  private readonly secrets = new Set<string>()
  private fd: number | null = null
  private readonly echo: boolean
  private readonly min: number

  constructor(opts: LoggerOptions = {}) {
    this.capacity = opts.capacity ?? 1000
    this.echo = opts.echo ?? false
    this.min = ORDER[opts.minLevel ?? 'debug']
    if (opts.file) {
      mkdirSync(dirname(opts.file), { recursive: true })
      if (existsSync(opts.file) && statSync(opts.file).size > (opts.maxFileBytes ?? 5 * 1024 * 1024))
        renameSync(opts.file, `${opts.file}.1`)
      this.fd = openSync(opts.file, 'a', 0o600)
    }
  }

  /** Register a secret value; it will be replaced in every subsequent line. */
  addSecret(value: string | null | undefined): void {
    if (value && value.length >= 4) this.secrets.add(value)
  }

  redact(text: string): string {
    let out = text
    for (const s of this.secrets) out = out.split(s).join(REDACTED)
    for (const re of KEY_SHAPES) out = out.replace(re, REDACTED)
    return out
  }

  log(level: LogLevel, msg: string, fields: LogFields = {}): void {
    if (ORDER[level] < this.min) return
    const safe: LogFields = {}
    for (const [k, v] of Object.entries(fields)) {
      safe[k] = SECRET_FIELD.test(k)
        ? REDACTED
        : v instanceof Error
          ? { name: v.name, message: v.message }
          : v
    }
    let line: string
    try {
      line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...safe })
    } catch {
      line = JSON.stringify({ t: new Date().toISOString(), level, msg, fields: '[unserialisable]' })
    }
    line = this.redact(line)
    this.ring.push(line)
    if (this.ring.length > this.capacity) this.ring.splice(0, this.ring.length - this.capacity)
    if (this.fd !== null) {
      try {
        writeSync(this.fd, `${line}\n`)
      } catch {
        // a full disk must not take the daemon down with it
      }
    }
    if (this.echo) process.stderr.write(`${line}\n`)
  }

  debug(msg: string, f?: LogFields): void {
    this.log('debug', msg, f)
  }
  info(msg: string, f?: LogFields): void {
    this.log('info', msg, f)
  }
  warn(msg: string, f?: LogFields): void {
    this.log('warn', msg, f)
  }
  error(msg: string, f?: LogFields): void {
    this.log('error', msg, f)
  }

  tail(n = 200): string[] {
    return this.ring.slice(-n)
  }

  close(): void {
    if (this.fd !== null) closeSync(this.fd)
    this.fd = null
  }
}
