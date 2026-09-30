import type { SaveTextRequest, SaveTextResult } from '../shared/bridge.ts'

// Clipboard and "save as" for the renderer (it has no Node and no file system): the notes pane's Copy
// as Markdown and Export. Pure argument checks + a small orchestration over injected Electron calls, so
// both are unit-tested without Electron; index.ts wires them to ipcMain, clipboard and dialog.

/** Enough for any notes document (the daemon caps one version at 200 000 characters) plus a header. */
export const MAX_TEXT_CHARS = 1_000_000

/** The renderer is untrusted: a clipboard write is a string of bounded size, nothing else. */
export function checkClipboardText(v: unknown): string {
  if (typeof v !== 'string') throw new TypeError('clipboard text must be a string')
  if (v.length > MAX_TEXT_CHARS) throw new RangeError('clipboard text is too long')
  return v
}

/** A suggested file name reduced to one harmless path component (no directories, no dot-files). */
export function safeFileName(name: string, fallback = 'notes.md'): string {
  const base = name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
  return base || fallback
}

export function checkSaveRequest(v: unknown): SaveTextRequest {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Partial<Record<keyof SaveTextRequest, unknown>>
  if (typeof o.text !== 'string') throw new TypeError('save: text must be a string')
  if (o.text.length > MAX_TEXT_CHARS) throw new RangeError('save: text is too long')
  return {
    title: typeof o.title === 'string' ? o.title.slice(0, 200) : '',
    defaultName: safeFileName(typeof o.defaultName === 'string' ? o.defaultName : ''),
    text: o.text,
  }
}

export type SaveDialogOptions = {
  title: string
  defaultPath: string
  filters: { name: string; extensions: string[] }[]
  properties: ('createDirectory' | 'showOverwriteConfirmation')[]
}

export type SaveDeps = {
  /** dialog.showSaveDialog, bound to the asking window. */
  showSaveDialog: (o: SaveDialogOptions) => Promise<{ canceled: boolean; filePath?: string }>
  writeFile: (path: string, text: string) => Promise<void>
  /** app.getPath('documents'), or home when there is none. */
  documentsDir: string
  join: (...parts: string[]) => string
}

/** Ask where to save (starting in Documents, like the GTK app), then write the text there. */
export async function saveText(req: SaveTextRequest, deps: SaveDeps): Promise<SaveTextResult> {
  const r = await deps.showSaveDialog({
    title: req.title,
    defaultPath: deps.join(deps.documentsDir, req.defaultName),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  })
  if (r.canceled || !r.filePath) return { saved: false }
  await deps.writeFile(r.filePath, req.text)
  return { saved: true, path: r.filePath }
}
