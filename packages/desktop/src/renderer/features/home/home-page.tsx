/// <reference types="vite/client" />

import wordmarkLight from '@brand/logo/wordmark.svg?url'
import wordmarkDark from '@brand/logo/wordmark-dark.svg?url'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, ngettext } from '@gnomeola/ui-core/i18n'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { Banner, Button, HeaderBar, Kbd, SearchField } from '../../design/primitives/index.ts'
import { useAsk } from '../ask/ask-answer.tsx'
import { useHomeQuery } from '../meeting/header.tsx'
import { useMissingModels } from '../onboarding/onboarding-state.ts'
import { ExtensionCard } from '../preferences/extension-setup.tsx'
import { useRecorder } from '../sessions/recorder.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import { PrimaryMenu } from '../shell/primary-menu.tsx'
import { longDate } from './day.ts'
import { DayView } from './day-view.tsx'
import { SearchResults } from './search-results.tsx'

// Home: the app opens on your day. One search-and-ask box at the top, over titles and transcripts —
// typing turns the day into results in place, Esc brings it back. Below it, today's meetings and
// recordings in time order with the next one expanded, then earlier days. No sidebar: every meeting page
// has Back to Today. The query lives in the URL (?q=), so Back from a result returns to the results.

export function HomePage() {
  const { store } = useServices()
  const connection = useStore(store, (s) => s.connection)
  const missing = useMissingModels()
  const dialogs = useDialogs()
  const recorder = useRecorder()
  const navigate = useNavigate()
  const { q = '' } = useSearch({ strict: false }) as { q?: string }
  const now = useNow(60_000)
  const ask = useAsk('home', null)
  // Back from a meeting returns to home as it was left (its query)
  useEffect(() => useHomeQuery.getState().set(q), [q])
  const setQuery = (v: string) => void navigate({ to: '/', search: v ? { q: v } : {}, replace: true })
  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderBar
        start={
          <>
            <img
              src={wordmarkLight}
              alt="kacola"
              height={20}
              className="ml-2 h-5 w-auto select-none [[data-theme=dark]_&]:hidden"
              draggable={false}
            />
            <img
              src={wordmarkDark}
              alt=""
              height={20}
              className="ml-2 hidden h-5 w-auto select-none [[data-theme=dark]_&]:block"
              draggable={false}
            />
          </>
        }
        end={
          <>
            <span className="mr-2 hidden type-callout text-text-secondary sm:inline">
              {longDate(now.getTime())}
            </span>
            {recorder.state === 'idle' || recorder.state === 'starting' ? (
              <Button
                size="sm"
                isDisabled={recorder.state === 'starting'}
                onPress={recorder.record}
                aria-description={_('Start recording a call that is not in your calendar')}
              >
                <span aria-hidden="true" className="size-2 rounded-full bg-accent-record" />
                {recorder.state === 'starting' ? _('Starting…') : _('Record now')}
              </Button>
            ) : null}
            <PrimaryMenu />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pt-4 pb-10 sm:px-8">
          {connection.kind === 'reconnecting' ? (
            <Banner
              tone="warning"
              title={_('Lost the connection to kacola’s background service. Reconnecting…')}
            />
          ) : missing > 0 ? (
            <Banner
              tone="warning"
              title={ngettext(
                'A speech model is not downloaded yet, so recording can’t transcribe',
                'Speech models are not downloaded yet, so recording can’t transcribe',
                missing,
              )}
              action={
                <Button size="sm" onPress={() => dialogs.open('onboarding')}>
                  {_('Set Up')}
                </Button>
              }
            />
          ) : null}
          {/* the page's title for assistive tech: the day's headings are its sections */}
          <h1 className="sr-only">{_('Your day')}</h1>
          <SearchField
            label={_('Search or ask')}
            placeholder={_('Search or ask: a name, a decision, anything someone said')}
            size="lg"
            value={q}
            onChange={setQuery}
            onSubmit={(v) => ask.ask(v)}
            end={<Kbd>Ctrl+K</Kbd>}
            data-shortcut="search"
          />
          {q.trim() ? <SearchResults query={q} ask={ask} /> : <DayView />}
          <ExtensionCard />
        </div>
      </div>
    </div>
  )
}
