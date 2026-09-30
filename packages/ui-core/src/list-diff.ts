// The one splice that turns one key list into another: keep the common prefix and suffix, replace
// the middle. Exact for appends, removals, in-place revisions and single insertions — what a live
// transcript does — and still correct (if not minimal) for anything else.

export type Splice = { position: number; removed: number; added: string[] }

export function diffKeys(prev: readonly string[], next: readonly string[]): Splice | null {
  let start = 0
  const max = Math.min(prev.length, next.length)
  while (start < max && prev[start] === next[start]) start++
  if (start === prev.length && start === next.length) return null
  let endPrev = prev.length
  let endNext = next.length
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--
    endNext--
  }
  return { position: start, removed: endPrev - start, added: next.slice(start, endNext) }
}

/** Apply a splice to a plain array (the reference the model is checked against in tests). */
export function applySplice(list: readonly string[], s: Splice | null): string[] {
  if (!s) return [...list]
  return [...list.slice(0, s.position), ...s.added, ...list.slice(s.position + s.removed)]
}
