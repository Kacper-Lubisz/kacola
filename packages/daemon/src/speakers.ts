import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_SPEAKER_SETTINGS,
  newId,
  type Speaker,
  type SpeakerSummary,
  type StoredSettings,
  type Voiceprint,
  type VoiceprintSummary,
} from '@kacola/protocol'
import type { Store } from '@kacola/store'
import type { KnownVoice, SpeakerVoices } from './interfaces.ts'
import type { Logger } from './logger.ts'
import type { SessionManager } from './sessions.ts'

// M3 — attribution in the daemon: rename / merge / split far-end speakers, and voiceprints (A-6).
//
// Voiceprints are opt-in (settings.speakers.voiceprints) and local. With them on:
//   · at the end of each recording, each far-end speaker's voice (the diarizer's centroid) is written
//     beside the session's audio (`voices.json`), and speakers already linked to a voiceprint refine it;
//   · naming a speaker — mid-meeting or afterwards — makes (or refines) the voiceprint of that name;
//   · a new recording is seeded with every voiceprint, so a recognised speaker arrives named.
// Switching them off forgets everything: every voiceprint and every session's `voices.json`.

const VOICES_FILE = 'voices.json'

export type SpeakerServiceDeps = {
  store: Store
  sessions: SessionManager
  settings: () => StoredSettings
  logger: Logger
}

export class SpeakerService {
  private readonly d: SpeakerServiceDeps

  constructor(deps: SpeakerServiceDeps) {
    this.d = deps
    // forget every voice the moment voiceprints are switched off
    let on = this.enabled()
    deps.store.onCommit((e) => {
      if (e.data.type !== 'settings.updated') return
      const now = this.enabled()
      if (on && !now) this.forgetAll()
      on = now
    })
  }

  private enabled(): boolean {
    return (this.d.settings().speakers ?? DEFAULT_SPEAKER_SETTINGS).voiceprints
  }

  list(sessionId: string): SpeakerSummary[] {
    return this.d.store.speakerSummaries(sessionId)
  }

  rename(sessionId: string, speakerId: string, label: string): Speaker {
    const spk = this.d.store.renameSpeaker(sessionId, speakerId, label)
    if (this.enabled()) return this.remember(sessionId, spk)
    return spk
  }

  merge(sessionId: string, fromId: string, intoId: string): Speaker {
    return this.d.store.mergeSpeakers(sessionId, fromId, intoId)
  }

  split(sessionId: string, fromId: string, segmentIds: string[]): Speaker {
    return this.d.store.splitSpeaker(sessionId, fromId, segmentIds)
  }

  voiceprints(): VoiceprintSummary[] {
    return this.d.store.voiceprints().map(({ embedding: _e, ...v }) => v)
  }

  deleteVoiceprint(id: string): void {
    this.d.store.deleteVoiceprint(id)
  }

  /** What a new recording should recognise. */
  knownVoices(): KnownVoice[] {
    if (!this.enabled()) return []
    return this.d.store.voiceprints().map((v) => ({ id: v.id, model: v.model, embedding: v.embedding }))
  }

  /** A recording ended: keep its voices beside its audio and refine the voiceprints it matched. */
  recordingVoices(sessionId: string, v: SpeakerVoices): void {
    if (!this.enabled() || !v.voices.length) return
    const dir = this.d.sessions.sessionDir(sessionId)
    if (existsSync(dir)) writeFileSync(join(dir, VOICES_FILE), `${JSON.stringify(v)}\n`, { mode: 0o600 })
    for (const voice of v.voices) {
      const spk = this.d.store.resolveSpeaker(voice.speakerId)
      if (!spk?.voiceprintId) continue
      const vp = this.d.store.getVoiceprint(spk.voiceprintId)
      if (vp && vp.model === v.model) this.d.store.upsertVoiceprint(refine(vp, voice.embedding, this.now()))
    }
  }

  /**
   * A speaker was named: make their voice the voiceprint of that name (refining one that exists for the
   * same model), and link them to it. Without a voice on record there is nothing to remember.
   */
  private remember(sessionId: string, spk: Speaker): Speaker {
    const heard = this.d.sessions.liveVoices(sessionId) ?? this.savedVoices(sessionId)
    const voice = heard?.voices.find((x) => this.d.store.resolveSpeaker(x.speakerId)?.id === spk.id)
    if (!heard || !voice) return spk
    const now = this.now()
    const existing = this.d.store
      .voiceprints()
      .find((x) => x.model === heard.model && x.name.toLowerCase() === spk.label.toLowerCase())
    const vp = existing
      ? refine(existing, voice.embedding, now)
      : {
          id: newId('vp'),
          name: spk.label,
          model: heard.model,
          embedding: unit(voice.embedding),
          samples: 1,
          createdAt: now,
          updatedAt: now,
        }
    this.d.store.upsertVoiceprint(vp)
    this.d.logger.info('voiceprint remembered', { sessionId, speakerId: spk.id, voiceprintId: vp.id })
    return this.d.store.linkVoiceprint(sessionId, spk.id, vp.id)
  }

  private savedVoices(sessionId: string): SpeakerVoices | null {
    const p = join(this.d.sessions.sessionDir(sessionId), VOICES_FILE)
    if (!existsSync(p)) return null
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as SpeakerVoices
    } catch (err) {
      this.d.logger.warn('unreadable voices file', { sessionId, err: (err as Error).message })
      return null
    }
  }

  private forgetAll(): void {
    for (const v of this.d.store.voiceprints()) this.d.store.deleteVoiceprint(v.id)
    const root = this.d.sessions.sessionsDir
    if (existsSync(root))
      for (const id of readdirSync(root)) rmSync(join(root, id, VOICES_FILE), { force: true })
    this.d.logger.info('voiceprints switched off: every remembered voice forgotten')
  }

  private now(): string {
    return new Date().toISOString()
  }
}

function unit(v: readonly number[]): number[] {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0))
  return n > 0 ? v.map((x) => x / n) : [...v]
}

/** Fold one more session's voice into a voiceprint: the running mean of unit vectors. */
function refine(vp: Voiceprint, embedding: readonly number[], now: string): Voiceprint {
  if (embedding.length !== vp.embedding.length) return vp
  const e = unit(embedding)
  const mean = vp.embedding.map((x, i) => (x * vp.samples + e[i]!) / (vp.samples + 1))
  return { ...vp, embedding: unit(mean), samples: vp.samples + 1, updatedAt: now }
}
