import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  checkClipboardText,
  checkSaveRequest,
  MAX_TEXT_CHARS,
  safeFileName,
  saveText,
} from '../src/main/files.ts'

// Main's clipboard / "save as" handlers for the notes pane: the renderer is untrusted, so arguments are
// checked and the suggested name is reduced to one harmless path component.

describe('clipboard text', () => {
  it('accepts a bounded string and nothing else', () => {
    expect(checkClipboardText('# notes\n')).toBe('# notes\n')
    expect(() => checkClipboardText(42)).toThrow(TypeError)
    expect(() => checkClipboardText('x'.repeat(MAX_TEXT_CHARS + 1))).toThrow(RangeError)
  })
})

describe('save requests', () => {
  it('reduces the suggested name to one path component', () => {
    expect(safeFileName('Sprint retro.md')).toBe('Sprint retro.md')
    expect(safeFileName('../../etc/passwd')).toBe('etc passwd')
    expect(safeFileName('a/b\\c:d*e?.md')).toBe('a b c d e .md')
    expect(safeFileName('...hidden.md')).toBe('hidden.md')
    expect(safeFileName('\u0000\u0007')).toBe('notes.md')
    expect(safeFileName('x'.repeat(300))).toHaveLength(120)
  })

  it('checks the text and fills defaults', () => {
    expect(checkSaveRequest({ text: 'hi', defaultName: 'x/y.md', title: 'Export Notes' })).toEqual({
      text: 'hi',
      defaultName: 'x y.md',
      title: 'Export Notes',
    })
    expect(checkSaveRequest({ text: '' })).toEqual({ text: '', defaultName: 'notes.md', title: '' })
    expect(() => checkSaveRequest({ defaultName: 'a.md' })).toThrow(TypeError)
    expect(() => checkSaveRequest(null)).toThrow(TypeError)
    expect(() => checkSaveRequest({ text: 'x'.repeat(MAX_TEXT_CHARS + 1) })).toThrow(RangeError)
  })

  it('asks where (starting in Documents), then writes exactly the text there', async () => {
    const writeFile = vi.fn(async () => {})
    const showSaveDialog = vi.fn(async () => ({ canceled: false, filePath: '/tmp/out.md' }))
    const r = await saveText(
      { title: 'Export Notes', defaultName: 'Sprint retro.md', text: '# Sprint retro\n' },
      { showSaveDialog, writeFile, documentsDir: '/home/u/Documents', join },
    )
    expect(r).toEqual({ saved: true, path: '/tmp/out.md' })
    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Export Notes',
        defaultPath: '/home/u/Documents/Sprint retro.md',
        filters: expect.arrayContaining([{ name: 'Markdown', extensions: ['md'] }]),
      }),
    )
    expect(writeFile).toHaveBeenCalledWith('/tmp/out.md', '# Sprint retro\n')
  })

  it('writes nothing when the dialog is dismissed', async () => {
    const writeFile = vi.fn(async () => {})
    for (const answer of [{ canceled: true }, { canceled: false, filePath: '' }]) {
      const r = await saveText(
        { title: '', defaultName: 'a.md', text: 'x' },
        { showSaveDialog: async () => answer, writeFile, documentsDir: '/d', join },
      )
      expect(r).toEqual({ saved: false })
    }
    expect(writeFile).not.toHaveBeenCalled()
  })
})
