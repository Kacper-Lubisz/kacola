import { randomBytes } from 'node:crypto'

// Time-prefixed ids: lexicographic order == creation order, which makes logs and listings readable
// and lets the CLI accept an unambiguous prefix of an id.
export type IdKind = 'ses' | 'seg' | 'qa' | 'req'

export function newId(kind: IdKind, now: number = Date.now()): string {
  return `${kind}_${now.toString(36).padStart(9, '0')}${randomBytes(6).toString('hex')}`
}

export const idKind = (id: string): IdKind | null => {
  const k = id.split('_')[0]
  return k === 'ses' || k === 'seg' || k === 'qa' || k === 'req' ? k : null
}
