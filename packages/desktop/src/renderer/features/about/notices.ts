// THIRD_PARTY_NOTICES.md (served by main: the copy shipped in resources/, or the checkout's) → the About
// dialog's component list (the parser the GTK app's About used).

export type Notice = { name: string; version: string; licence: string; homepage: string }

/** Every row of every markdown table in the file that has package (or name) / version / licence columns. */
export function parseNotices(md: string): Notice[] {
  const out: Notice[] = []
  let cols: string[] | null = null
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('|')) {
      cols = null
      continue
    }
    const cells = line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((c) => c.trim())
    if (!cols) {
      cols = cells.map((c) => c.toLowerCase())
      continue
    }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue
    const at = (name: string) => {
      const i = cols!.indexOf(name)
      return i === -1 ? '' : (cells[i] ?? '')
    }
    const name = at('package') || at('name')
    if (!name) continue
    out.push({
      name,
      version: at('version'),
      licence: at('licence') || at('license'),
      homepage: at('homepage'),
    })
  }
  return out
}

/** "name version — licence", one per line (version omitted when the row has none). */
export const noticeLine = (n: Notice): string => `${n.name}${n.version ? ` ${n.version}` : ''} — ${n.licence}`
