import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { type CaptureSource, PipeWireCaptureSource, type TrackSpec } from '@gnomeola/capture'
import type { GnomeolaClient, Session, TrackKind } from '@gnomeola/protocol'
import { ChunkUploader, retrying, TrackChunker, type UploadStats } from './upload.ts'

// H-2 — the capture-agent: the half of gnomeola that can never leave the laptop (PipeWire capture),
// split from the half that can (sessions, transcripts, search, the event stream). With it, the daemon
// is relocatable: point the agent at any gnomeola server — the local daemon, a self-hosted box, Vercel —
// and it records locally and streams the audio up as chunked, idempotent uploads (H-3); the server
// transcribes with a cloud provider on finalize (H-8, full offload).
//
// The WAVs are still written locally (the capture package always does), which is what makes an
// interrupted upload resumable after a crash: `resumeUpload()` re-chunks them identically.
//
// The default, recommended topology is NOT this one but hybrid sync (./sync.ts): the unchanged local
// daemon records and transcribes, and only text goes up. This agent is for people who want the cloud to
// do the transcription.

export type CaptureAgentOptions = {
  /** The server to upload to (with its token). */
  remote: GnomeolaClient
  /** Where the local WAVs go: `<spoolDir>/<sessionId>/{mic,system}.wav`. */
  spoolDir: string
  /** The capture source (default: PipeWire, following the default devices). */
  source?: () => CaptureSource
  tracks?: TrackSpec[]
  log?: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void
}

export type AgentRecording = {
  readonly session: Session
  readonly sessionDir: string
  readonly uploads: UploadStats
  /** Stop capture, upload the tail, finalize. Resolves with the server's finalized session. */
  stop(): Promise<Session>
}

const toBytes = (s: Int16Array) => new Uint8Array(s.buffer, s.byteOffset, s.byteLength)

export class CaptureAgent {
  private readonly o: CaptureAgentOptions
  constructor(opts: CaptureAgentOptions) {
    this.o = opts
  }

  async record(opts: { title?: string; private?: boolean } = {}): Promise<AgentRecording> {
    const { remote } = this.o
    const session = await remote.call('createSession', { body: { title: opts.title, private: opts.private } })
    const sessionDir = join(this.o.spoolDir, session.id)
    mkdirSync(sessionDir, { recursive: true, mode: 0o700 })
    const source = (this.o.source ?? (() => new PipeWireCaptureSource()))()
    const uploader = new ChunkUploader({ client: remote, sessionId: session.id, log: this.o.log })
    const chunkers: Record<TrackKind, TrackChunker> = {
      mic: new TrackChunker('mic'),
      system: new TrackChunker('system'),
    }
    // Every frame — synthetic gap silence included — goes into the chunk stream, exactly as it goes into
    // the WAV, so the uploaded bytes and the local file are identical.
    const off = source.on('frame', (f) => {
      for (const c of chunkers[f.track].push(toBytes(f.samples))) uploader.enqueue(f.track, c.seq, c.data)
    })
    const offErr = source.on('error', (e) =>
      this.o.log?.(e.fatal ? 'error' : 'warn', 'capture error', { ...e }),
    )
    await source.start(sessionDir, this.o.tracks ?? [{ kind: 'mic' }, { kind: 'system' }])
    this.o.log?.('info', 'recording', { sessionId: session.id })

    let stopping: Promise<Session> | null = null
    return {
      session,
      sessionDir,
      uploads: uploader.stats,
      stop: () => {
        stopping ??= (async () => {
          const result = await source.stop()
          off()
          offErr()
          for (const k of ['mic', 'system'] as const) {
            const last = chunkers[k].end()
            if (last) uploader.enqueue(k, last.seq, last.data)
          }
          await uploader.drain()
          // finalize is idempotent on the server, so a lost response is simply asked again
          return retrying(() =>
            remote.call('finalizeAudio', {
              params: { id: session.id },
              body: {
                chunks: { mic: chunkers.mic.count, system: chunkers.system.count },
                durationMs: Math.round(result.durationMs),
              },
            }),
          )
        })()
        return stopping
      },
    }
  }
}
