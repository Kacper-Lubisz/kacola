// THIRD_PARTY_NOTICES.md → the About dialog's "Third-Party Components" legal section. The file is
// generated from the production dependency tree (scripts/third-party-notices.ts) and bundled into the
// app at build time, so the dialog always lists exactly what this build ships.

export type Notice = { name: string; version: string; licence: string; homepage: string }

/** Every row of every markdown table in the file that has package/version/licence columns. */
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

/** Plain text for AdwAboutDialog.addLegalSection (shown in a wrapping label). */
export function noticesText(notices: readonly Notice[]): string {
  return notices.map((n) => `${n.name} ${n.version} — ${n.licence}`).join('\n')
}
