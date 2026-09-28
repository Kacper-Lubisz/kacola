import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type * as Adw from '@gtkx/gi/adw'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwAboutDialog } from '@gtkx/jsx/adw'
import { useCallback, useRef } from 'react'
import notices from '../../../../THIRD_PARTY_NOTICES.md?raw'
import pkg from '../../package.json' with { type: 'json' }
import { noticesText, parseNotices } from '../data/notices.ts'
import { _ } from '../i18n/index.ts'
import { nameInternalLists } from './a11y.ts'

// S-4: About. The licence is GPL-3.0-or-later (Gtk.License.GPL_3_0 is "GPL 3.0 or later" in GTK). The
// Granola credit is part of the main page's text, not buried in a sub-page: gnomeola is a clean-room
// project and must say so plainly. The "Legal" page lists every third-party component this build
// ships, from the THIRD_PARTY_NOTICES.md bundled into it.

export const APP_VERSION: string = pkg.version

export const granolaCredit = (): string =>
  _(
    'gnomeola is an independent clean-room project inspired by Granola. It is not affiliated with or endorsed by Granola.',
  )

/**
 * Where the full notices file is on this machine: beside the bundle (a packaged build), the
 * system doc dir, or the source checkout the bundle was built in. Null if none exists.
 */
export function noticesUri(entry: string = fileURLToPath(import.meta.url)): string | null {
  const here = dirname(entry)
  for (const p of [
    join(here, 'THIRD_PARTY_NOTICES.md'),
    '/usr/share/doc/gnomeola/THIRD_PARTY_NOTICES.md',
    resolve(here, '..', '..', '..', 'THIRD_PARTY_NOTICES.md'),
  ]) {
    if (existsSync(p)) return pathToFileURL(p).href
  }
  return null
}

export function AboutDialog({ onClosed }: { onClosed: () => void }) {
  const done = useRef(false)
  // Sections are added through methods, once, when the dialog instance first exists.
  const attach = useCallback((dialog: Adw.AboutDialog | null) => {
    if (!dialog || done.current) return
    done.current = true
    const uri = noticesUri()
    if (uri) dialog.addLink(_('Third-Party Notices'), uri)
    dialog.addAcknowledgementSection(_('Inspired by'), ['Granola https://www.granola.ai/'])
    dialog.addLegalSection(
      _('Third-Party Components'),
      null,
      Gtk.License.CUSTOM,
      `${_('gnomeola includes the following components under their own licences. The full list, with homepages, is in THIRD_PARTY_NOTICES.md.')}\n\n${noticesText(parseNotices(notices))}`,
    )
    // libadwaita's own row lists (Details; Credits, Legal, Acknowledgements; the links) are unnamed.
    // An AdwDialog's content is reparented into the window's sheet when presented, so walk from
    // getChild(), not from the dialog widget (which then has no children).
    nameInternalLists(dialog.getChild() ?? dialog)
  }, [])
  const translators = _('translator-credits')
  return (
    <AdwAboutDialog
      ref={attach}
      applicationName="gnomeola"
      applicationIcon="audio-input-microphone-symbolic"
      version={APP_VERSION}
      developerName={_('The gnomeola contributors')}
      developers={[_('The gnomeola contributors')]}
      licenseType={Gtk.License.GPL_3_0}
      comments={`${_('Record meetings, read live speaker-labelled transcripts, and ask questions about what was said.')}\n\n${granolaCredit()}`}
      // gettext convention: a catalog translates this msgid to its translators' names
      translatorCredits={translators === 'translator-credits' ? '' : translators}
      onClosed={onClosed}
    />
  )
}
