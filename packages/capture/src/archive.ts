import { execFile } from 'node:child_process'
import { existsSync, renameSync, rmSync, statSync } from 'node:fs'
import type { Settings } from '@gnomeola/protocol'

// R-7: compact archives and audio retention.
//
// Two artefacts per track: the WAV (lossless working copy that STT reads) and, optionally, an Opus
// archive (≈24 kbit/s, ~10 MB per hour of speech per track — about 1/20 of the WAV).
//
// Policy (settings.retention):
//   audio = keep                       WAVs are kept.
//   audio = delete-after-transcription WAVs are deleted once the session's final transcription is done.
//   audio = delete-after-days          all audio (WAV *and* archive) of sessions that ended more than
//                                      `days` ago is deleted.
//   archive = true                     once a session has ended, each WAV is encoded to Opus; a WAV is
//                                      never deleted before its archive exists.
// Safety rules that hold under every policy: nothing is touched while a session is still recording;
// a WAV is never deleted before final transcription has completed (except by delete-after-days, whose
// whole point is an age limit); archives are only ever deleted by delete-after-days.

export type Retention = Settings['retention']

export type RetentionTrack = { wavPath: string | null; archivePath: string | null }

export type RetentionSession = {
  id: string
  /** null while recording. */
  endedAt: Date | null
  /** When the final (tier-2) transcription finished; null if it has not. */
  transcribedAt: Date | null
  tracks: RetentionTrack[]
}

export type RetentionAction =
  | { type: 'encode'; sessionId: string; wavPath: string; archivePath: string }
  | { type: 'delete'; sessionId: string; path: string; what: 'wav' | 'archive'; reason: string }

export const DAY_MS = 86_400_000

export function archivePathFor(wavPath: string): string {
  return `${wavPath.replace(/\.wav$/i, '')}.opus`
}

/** Pure: what should happen to each session's audio now. Encodes come before deletes of the same WAV. */
export function planRetention(
  sessions: readonly RetentionSession[],
  policy: Retention,
  now: Date,
): RetentionAction[] {
  const actions: RetentionAction[] = []
  for (const s of sessions) {
    if (!s.endedAt) continue // still recording: hands off
    const expired =
      policy.audio === 'delete-after-days' && now.getTime() - s.endedAt.getTime() > policy.days * DAY_MS
    for (const t of s.tracks) {
      if (expired) {
        if (t.wavPath)
          actions.push({
            type: 'delete',
            sessionId: s.id,
            path: t.wavPath,
            what: 'wav',
            reason: `older than ${policy.days} days`,
          })
        if (t.archivePath)
          actions.push({
            type: 'delete',
            sessionId: s.id,
            path: t.archivePath,
            what: 'archive',
            reason: `older than ${policy.days} days`,
          })
        continue
      }
      if (!t.wavPath) continue
      const needsArchive = policy.archive && !t.archivePath
      if (needsArchive)
        actions.push({
          type: 'encode',
          sessionId: s.id,
          wavPath: t.wavPath,
          archivePath: archivePathFor(t.wavPath),
        })
      if (policy.audio === 'delete-after-transcription' && s.transcribedAt) {
        // With archive on, the delete is only valid if the encode (planned just above, or done earlier)
        // succeeds — applyRetention enforces that ordering.
        actions.push({ type: 'delete', sessionId: s.id, path: t.wavPath, what: 'wav', reason: 'transcribed' })
      }
    }
  }
  return actions
}

export type EncodeOptions = { bitrate?: string; outPath?: string; ffmpeg?: string; timeoutMs?: number }

/**
 * Encode a WAV to Ogg/Opus with ffmpeg (libopus, VoIP tuning). Writes to a temp name and renames, so a
 * crash never leaves a truncated archive under the final name. Resolves to the archive path.
 */
export function encodeArchive(wavPath: string, opts: EncodeOptions = {}): Promise<string> {
  const out = opts.outPath ?? archivePathFor(wavPath)
  const tmp = `${out}.partial`
  const args = [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    wavPath,
    '-c:a',
    'libopus',
    '-b:a',
    opts.bitrate ?? '24k',
    '-application',
    'voip',
    '-f',
    'ogg',
    tmp,
  ]
  return new Promise((resolve, reject) => {
    execFile(
      opts.ffmpeg ?? 'ffmpeg',
      args,
      { timeout: opts.timeoutMs ?? 600_000 },
      (err, _stdout, stderr) => {
        if (err) {
          rmSync(tmp, { force: true })
          return reject(
            new Error(`ffmpeg failed to encode ${wavPath}: ${stderr || err.message}`, { cause: err }),
          )
        }
        renameSync(tmp, out)
        resolve(out)
      },
    )
  })
}

export type AppliedAction = RetentionAction & { ok: boolean; error?: string }

/**
 * Execute a plan. An encode failure blocks the delete of that same WAV (the only copy is never lost to a
 * failed encode). Deleting an already-missing file counts as success.
 */
export async function applyRetention(
  actions: readonly RetentionAction[],
  opts: { encode?: (wavPath: string, archivePath: string) => Promise<string> } = {},
): Promise<AppliedAction[]> {
  const encode = opts.encode ?? ((wav, out) => encodeArchive(wav, { outPath: out }))
  const failedEncodes = new Set<string>()
  const results: AppliedAction[] = []
  for (const a of actions) {
    if (a.type === 'encode') {
      try {
        await encode(a.wavPath, a.archivePath)
        if (!existsSync(a.archivePath) || statSync(a.archivePath).size === 0)
          throw new Error(`archive ${a.archivePath} missing or empty after encode`)
        results.push({ ...a, ok: true })
      } catch (e) {
        failedEncodes.add(a.wavPath)
        results.push({ ...a, ok: false, error: (e as Error).message })
      }
    } else {
      if (a.what === 'wav' && failedEncodes.has(a.path)) {
        results.push({ ...a, ok: false, error: 'archive encode failed; keeping the WAV' })
        continue
      }
      try {
        rmSync(a.path, { force: true })
        results.push({ ...a, ok: true })
      } catch (e) {
        results.push({ ...a, ok: false, error: (e as Error).message })
      }
    }
  }
  return results
}
