// Server-Sent Events wire format — one codec shared by the daemon (encode) and every client (decode),
// so the two ends cannot drift. The decoder is incremental and tolerant of arbitrary chunk boundaries,
// CRLF, comments and multi-line data; it is fuzzed on exactly that in its tests.

export type SseMessage = { id?: string; event?: string; data: string; retry?: number }

export function encodeSse(msg: SseMessage): string {
  let out = ''
  if (msg.id !== undefined) out += `id: ${msg.id}\n`
  if (msg.event !== undefined) out += `event: ${msg.event}\n`
  if (msg.retry !== undefined) out += `retry: ${msg.retry}\n`
  for (const line of msg.data.split(/\r\n|\r|\n/)) out += `data: ${line}\n`
  return `${out}\n`
}

export const encodeSseComment = (text: string): string => `: ${text.replace(/[\r\n]+/g, ' ')}\n\n`

export class SseDecoder {
  private buf = ''
  private data: string[] = []
  private id: string | undefined
  private event: string | undefined
  private retry: number | undefined
  private sawCR = false

  /** Feed a chunk; returns every message completed by it. */
  push(chunk: string): SseMessage[] {
    // A CR at the end of one chunk followed by LF at the start of the next is a single CRLF.
    if (this.sawCR && chunk.startsWith('\n')) chunk = chunk.slice(1)
    this.sawCR = chunk.endsWith('\r')
    this.buf += chunk
    const out: SseMessage[] = []
    let m: RegExpExecArray | null
    const re = /\r\n|\r|\n/g
    let start = 0
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex scan
    while ((m = re.exec(this.buf)) !== null) {
      // a lone trailing '\r' might be the first half of a CRLF split across chunks: that's fine, the
      // sawCR flag strips the '\n' next time, so we can treat the '\r' as a complete terminator now.
      const line = this.buf.slice(start, m.index)
      start = re.lastIndex
      const msg = this.line(line)
      if (msg) out.push(msg)
    }
    this.buf = this.buf.slice(start)
    return out
  }

  private line(line: string): SseMessage | null {
    if (line === '') {
      if (!this.data.length && this.event === undefined && this.id === undefined) return null
      const msg: SseMessage = { data: this.data.join('\n') }
      if (this.id !== undefined) msg.id = this.id
      if (this.event !== undefined) msg.event = this.event
      if (this.retry !== undefined) msg.retry = this.retry
      this.data = []
      this.event = undefined
      this.retry = undefined
      this.id = undefined
      return msg
    }
    if (line.startsWith(':')) return null
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') this.data.push(value)
    else if (field === 'event') this.event = value
    else if (field === 'id' && !value.includes('\0')) this.id = value
    else if (field === 'retry' && /^\d+$/.test(value)) this.retry = Number(value)
    return null
  }
}
