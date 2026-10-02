/// <reference types="vite/client" />

import iconLight from '@brand/logo/icon.svg?url'
import iconDark from '@brand/logo/icon-dark.svg?url'
import { _ } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Button, Dialog, SegmentedControl, Spinner } from '../../design/primitives/index.ts'
import { noticeLine, parseNotices } from './notices.ts'

// About (S-4). The licence is GPL-3.0-or-later. The Granola credit is on the main page, not buried in
// a sub-page: gnomeola is a clean-room project and must say so plainly. "Legal" lists every
// third-party component this build ships, from the THIRD_PARTY_NOTICES.md main serves.

export const granolaCredit = (): string =>
  _(
    'kacola is an independent clean-room project inspired by Granola. It is not affiliated with or endorsed by Granola.',
  )

const GRANOLA = 'https://www.granola.ai/'
const GPL = 'https://www.gnu.org/licenses/gpl-3.0.html'

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { appInfo, bridge } = useServices()
  const [page, setPage] = useState<'about' | 'legal'>('about')
  const notices = useQuery({
    queryKey: ['notices'],
    queryFn: () => bridge.notices(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const translators = _('translator-credits')
  const dark = document.documentElement.dataset.theme === 'dark'
  return (
    <Dialog title={_('About kacola')} isOpen onOpenChange={(o) => !o && onClose()}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <img src={dark ? iconDark : iconLight} alt="" width={88} height={88} />
          <span className="type-title1">kacola</span>
          <span className="type-mono text-text-secondary">{appInfo.version}</span>
        </div>
        <SegmentedControl
          label={_('About pages')}
          className="self-center"
          value={page}
          onChange={setPage}
          segments={[
            { id: 'about', label: _('About') },
            { id: 'legal', label: _('Legal') },
          ]}
        />
        {page === 'about' ? (
          <div className="flex flex-col gap-3 type-body text-text-secondary select-text">
            <p className="m-0">
              {_(
                'Record meetings, read live speaker-labelled transcripts, and ask questions about what was said.',
              )}
            </p>
            <p className="m-0 text-text-primary">{granolaCredit()}</p>
            <p className="m-0">{_('The kacola contributors')}</p>
            {translators !== 'translator-credits' ? (
              <p className="m-0">
                {_('Translated by')} {translators}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" iconEnd="external" onPress={() => void bridge.openExternal(GRANOLA)}>
                {_('Inspired by Granola')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="m-0 type-body text-text-secondary select-text">
              {_('This program comes with absolutely no warranty. It is licensed under the')}{' '}
              <Button variant="link" onPress={() => void bridge.openExternal(GPL)}>
                {_('GNU General Public License, version 3 or later')}
              </Button>
              .
            </p>
            <h3 className="m-0 type-headline">{_('Third-Party Components')}</h3>
            <p className="m-0 type-callout text-text-secondary">
              {_(
                'kacola includes the following components under their own licences. The full list, with homepages, is in THIRD_PARTY_NOTICES.md.',
              )}
            </p>
            {notices.data === undefined ? (
              <Spinner label={_('Loading')} />
            ) : (
              <ul
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable from the keyboard (axe: scrollable-region-focusable)
                tabIndex={0}
                aria-label={_('Third-Party Notices')}
                className="m-0 list-none rounded-md border border-border-subtle bg-bg-surface p-3 font-mono text-[12px] leading-5 text-text-secondary select-text"
              >
                {parseNotices(notices.data).map((n) => (
                  <li key={`${n.name}@${n.version}`}>{noticeLine(n)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
