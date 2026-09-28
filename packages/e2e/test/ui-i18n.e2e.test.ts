import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, describe, expect, it } from 'vitest'
import { APP, buildUi, capture, launchUi, logTail } from '../src/ui.ts'

// S-5: the gettext scaffolding works end to end. Only English ships, so the test brings its own
// catalog: a German .po compiled with msgfmt into a temporary locale dir, and the real bundle run
// with LANGUAGE=de must show those strings — through bindtextdomain + GLib's dgettext, exactly the
// path a packaged translation would take.

const PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

msgid "Record"
msgstr "Aufnehmen"

msgid "Search sessions"
msgstr "Sitzungen durchsuchen"

msgid "No Session Selected"
msgstr "Keine Sitzung ausgewählt"

msgid "Transcript"
msgstr "Mitschrift"

msgid "Ask"
msgstr "Fragen"
`

describe('translations through gettext', () => {
  let d: HeadlessDisplay
  let dir: string

  afterAll(async () => {
    await d?.close()
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('shows strings from a compiled catalog when LANGUAGE asks for it', async () => {
    buildUi()
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-locale-'))
    const po = join(dir, 'de.po')
    writeFileSync(po, PO)
    mkdirSync(join(dir, 'de', 'LC_MESSAGES'), { recursive: true })
    execFileSync('msgfmt', ['--check', '-o', join(dir, 'de', 'LC_MESSAGES', 'gnomeola.mo'), po])

    d = await startHeadlessDisplay({ size: '1280x800' })
    const app = launchUi(d, {
      GNOMEOLA_UI_DEMO: '1',
      GNOMEOLA_UI_DEMO_INTERVAL_MS: '600000',
      GNOMEOLA_LOCALE_DIR: dir,
      LANGUAGE: 'de',
      LC_ALL: 'de_DE.UTF-8',
      LANG: 'de_DE.UTF-8',
    })
    await d.findOne({ app: APP, role: 'button', name: 'Aufnehmen' }, 30_000).catch((e: Error) => {
      throw new Error(`${e.message}\n${logTail(app)}`)
    })
    await d.findOne({ app: APP, role: 'entry', name: 'Sitzungen durchsuchen' })
    await d.findOne({ app: APP, role: 'label', name: 'Keine Sitzung ausgewählt' })
    // untranslated messages fall back to English, as gettext does
    await d.click(await d.findOne({ app: APP, role: 'list item', name: '1:1 with Sam' }))
    await d.findOne({ app: APP, role: 'page tab', name: 'Mitschrift' })
    await d.findOne({ app: APP, role: 'page tab', name: 'Fragen' })
    await d.findOne({ app: APP, role: 'page tab', name: 'Details' })
    expect(await d.find({ app: APP, role: 'button', name: 'Record' })).toEqual([])
    await capture(d, 'i18n-de')
  })
})
