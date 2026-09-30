import type { MergeChoice, NoteTemplate, Session, TemplateSuggestion } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import {
  enhanceProblem,
  exportFileName,
  exportMarkdown,
  type NotesFeed,
  type NotesFeedState,
} from '@gnomeola/ui-core/notes'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Clock, Copy, FileDown, Info, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useServices } from '../../data/services.tsx'
import { ActionItems } from './action-items.tsx'
import { KBanner, KButton, KIconButton, KMenu, KMenuItem, KMenuSeparator, KSpinner, KToast } from './kit.tsx'
import { useNotesFeed } from './notes-data.ts'
import './notes.css'
import { NotesEditor } from './notes-editor.tsx'
import { NotesReview } from './notes-review.tsx'
import { TemplateEditor } from './template-editor.tsx'
import { VersionHistory } from './version-history.tsx'

// M7 in the Electron window — a session's Notes: the markdown editor (autosaved 800 ms after the last
// keystroke and on leaving, optimistic concurrency against the daemon's head), Enhance with a template
// (suggested from the calendar event / session title), the streaming progress, the block-by-block review
// (N-4), version history with restore, custom templates, copy as markdown, export to a file, and the
// live action items (N-5). See docs/notes.md for the version model this is all built on.

function saveStatus(s: NotesFeedState): string {
  if (s.status === 'loading') return _('Loading…')
  if (s.status === 'error') return fmt(_('Notes could not be loaded: {reason}'), { reason: s.error ?? '' })
  if (s.saveError) return fmt(_('Not saved: {reason}'), { reason: s.saveError })
  if (s.saving || s.draft !== s.note.markdown) return _('Saving…')
  if (s.note.version === 0) return _('Nothing written yet')
  return _('Saved')
}

function suggestionHint(s: TemplateSuggestion | undefined, name: string): string {
  if (s?.matched?.source === 'calendar')
    return fmt(_('{template} template, suggested by the calendar event ("{keyword}")'), {
      template: name,
      keyword: s.matched.keyword,
    })
  if (s?.matched)
    return fmt(_('{template} template, suggested by the meeting title ("{keyword}")'), {
      template: name,
      keyword: s.matched.keyword,
    })
  return fmt(_('{template} template'), { template: name })
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

function Enhancing({ text, templateName }: { text: string; templateName: string }) {
  const n = words(text)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-[720px] items-center gap-3 px-6 pt-5 pb-3">
        <KSpinner label={_('Enhancing')} />
        <div className="flex min-w-0 flex-col">
          <span className="text-body-strong">
            {fmt(_('Enhancing your notes with the {template} template…'), { template: templateName })}
          </span>
          <span className="text-caption text-text-secondary" aria-live="off">
            {n === 0 ? _('Reading the transcript…') : fmt(_('{count} words written so far'), { count: n })}
          </span>
        </div>
      </div>
      <div className="mx-6 h-0.5 overflow-hidden rounded-pill bg-border-subtle" aria-hidden="true">
        <div className="notes-progress h-full w-1/3 rounded-pill bg-accent-record" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section
          aria-label={_('Enhanced notes so far')}
          className="mx-auto max-w-[720px] whitespace-pre-wrap break-words px-6 pt-4 pb-10 text-body text-text-secondary"
        >
          {text}
        </section>
      </div>
    </div>
  )
}

function EnhanceProblemBanner({
  state,
  feed,
  onRetry,
  onOpenPreferences,
}: {
  state: NotesFeedState
  feed: NotesFeed
  onRetry: () => void
  onOpenPreferences?: () => void
}) {
  const err = state.enhanceError!
  const problem = enhanceProblem(err)
  const hint =
    problem === 'refused'
      ? _('Nothing was changed. You can try another template, or keep writing yourself.')
      : problem === 'quota'
        ? _('The language model provider is limiting requests right now. Try again in a minute.')
        : problem === 'unavailable'
          ? _('Enhancing needs a language model provider. Set one up in Preferences.')
          : null
  return (
    <div className="mx-auto w-full max-w-[720px] px-6 pb-3">
      <KBanner
        tone={
          problem === 'refused' || problem === 'quota'
            ? 'warning'
            : problem === 'unavailable'
              ? 'info'
              : 'danger'
        }
        icon={problem === 'unavailable' ? Info : TriangleAlert}
        actions={
          <>
            {problem === 'unavailable' && onOpenPreferences ? (
              <KButton size="sm" onPress={onOpenPreferences}>
                {_('Open Preferences')}
              </KButton>
            ) : null}
            {problem === 'quota' || problem === 'other' ? (
              <KButton size="sm" onPress={onRetry}>
                {_('Try Again')}
              </KButton>
            ) : null}
            <KIconButton icon={X} label={_('Dismiss')} onPress={() => feed.dismissEnhanceError()} />
          </>
        }
      >
        <p className="m-0">{fmt(_('Your notes were not enhanced: {reason}'), { reason: err.message })}</p>
        {hint ? <p className="m-0 mt-0.5 text-caption text-text-secondary">{hint}</p> : null}
      </KBanner>
    </div>
  )
}

/** The session frame's Notes tab (PaneProps: `{ session }`, phase 2A). */
export function NotesPane({
  session,
  onOpenPreferences,
}: {
  session: Session
  /** Offered when enhancing needs a provider set up (the shell's Preferences dialog). */
  onOpenPreferences?: () => void
}) {
  const sessionId = session.id
  const { queries, bridge } = useServices()
  const { data: tpl } = useQuery(queries.templates(sessionId))
  const { feed, state } = useNotesFeed(sessionId)
  const [merging, setMerging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTemplate = useRef<string | undefined>(undefined)

  const say = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  if (!feed || !state) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-window">
        <KSpinner label={_('Loading…')} size={24} />
      </div>
    )
  }

  const templates: NoteTemplate[] = tpl?.templates ?? state.templates
  const suggestedId = tpl?.suggested.templateId ?? state.suggested?.templateId ?? 'general'
  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? id
  const reviewing = state.enhanced !== null && !state.enhancing
  const canEnhance = !state.enhancing && !reviewing && state.status === 'ready'
  const hasText = state.draft.trim() !== ''

  const enhance = (templateId?: string) => {
    lastTemplate.current = templateId ?? suggestedId
    void feed.enhance(lastTemplate.current)
  }
  const apply = (choices: MergeChoice[]) => {
    setMerging(true)
    void feed.merge(choices).finally(() => setMerging(false))
  }
  const copy = async (text: string, done: string) => {
    try {
      await bridge.copyText(text)
      say(done)
    } catch (err) {
      say(fmt(_('Could not copy: {reason}'), { reason: (err as Error).message }))
    }
  }
  const exportFile = async () => {
    try {
      const r = await bridge.saveTextFile({
        title: _('Export Notes'),
        defaultName: exportFileName(session),
        text: exportMarkdown(session, state.draft),
      })
      if (r.saved) say(fmt(_('Notes exported to {path}'), { path: r.path }))
    } catch (err) {
      say(fmt(_('The notes could not be exported: {reason}'), { reason: (err as Error).message }))
    }
  }
  const restore = async (version: number) => {
    await feed.restore(version)
    say(fmt(_('Version {n} restored'), { n: version }))
  }

  return (
    <div
      data-notes-pane=""
      className="relative flex h-full min-h-0 flex-col bg-bg-window font-sans text-text-primary"
    >
      <div
        role="toolbar"
        aria-label={_('Notes')}
        className="mx-auto flex w-full max-w-[960px] items-center gap-2 px-6 py-3"
      >
        <div className="flex">
          <KButton
            variant="primary"
            icon={Sparkles}
            aria-label={_('Enhance Notes')}
            isDisabled={!canEnhance}
            className="rounded-r-none"
            onPress={() => enhance()}
          >
            {_('Enhance')}
          </KButton>
          <KMenu
            label={_('Templates')}
            onAction={(k) => (k === '__manage__' ? setTemplatesOpen(true) : enhance(k))}
            trigger={
              <AriaButton
                aria-label={_('Choose a Template')}
                isDisabled={!canEnhance}
                className="inline-flex h-9 w-8 cursor-default items-center justify-center rounded-r-md border-l border-[color-mix(in_srgb,var(--k-color-text-on-ink)_25%,transparent)] bg-ink-primary text-text-on-ink outline-none data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_86%,var(--k-color-bg-window))] data-[disabled]:opacity-45 data-[focus-visible]:outline-[3px] data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent-focus data-[focus-visible]:outline-offset-2"
              >
                <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
              </AriaButton>
            }
          >
            {templates.map((t) => (
              <KMenuItem key={t.id} id={t.id} textValue={t.name}>
                <span className="flex-1">
                  {t.id === suggestedId
                    ? fmt(_('Enhance as {template} (suggested)'), { template: t.name })
                    : fmt(_('Enhance as {template}'), { template: t.name })}
                </span>
                {t.builtIn ? null : <span className="text-caption text-text-secondary">{_('Custom')}</span>}
              </KMenuItem>
            ))}
            <KMenuSeparator />
            <KMenuItem id="__manage__" textValue={_('Manage Templates…')}>
              {_('Manage Templates…')}
            </KMenuItem>
          </KMenu>
        </div>
        <div className="ml-2 flex min-w-0 flex-1 flex-col">
          <span className="truncate text-caption text-text-secondary" role="status">
            {saveStatus(state)}
          </span>
          <span className="truncate text-caption text-text-secondary">
            {state.rebased
              ? _('Saved on top of a newer version from elsewhere; that one is in Version History.')
              : suggestionHint(tpl?.suggested, nameOf(suggestedId))}
          </span>
        </div>
        <KIconButton icon={Clock} label={_('Version History')} onPress={() => setHistoryOpen(true)} />
        <KIconButton
          icon={Copy}
          label={_('Copy Notes as Markdown')}
          isDisabled={!hasText}
          onPress={() => void copy(exportMarkdown(session, state.draft), _('Notes copied as Markdown'))}
        />
        <KIconButton
          icon={FileDown}
          label={_('Export Notes')}
          tooltip={_('Export Notes to a Markdown File')}
          isDisabled={!hasText}
          onPress={() => void exportFile()}
        />
      </div>
      {state.enhanceError ? (
        <EnhanceProblemBanner
          state={state}
          feed={feed}
          onRetry={() => enhance(lastTemplate.current)}
          onOpenPreferences={onOpenPreferences}
        />
      ) : null}
      <div className="min-h-0 flex-1 border-t border-border-subtle">
        {state.enhancing ? (
          <Enhancing text={state.enhancing.text} templateName={nameOf(state.enhancing.templateId)} />
        ) : reviewing ? (
          <NotesReview
            // a new enhanced version, or a new head, starts a new review
            key={`${state.enhanced!.version}:${state.note.version}`}
            head={state.note.markdown}
            enhanced={state.enhanced!.markdown}
            templateName={nameOf(state.enhanced!.enhancement?.templateId ?? '')}
            busy={merging}
            onApply={apply}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              {state.status === 'ready' ? (
                <NotesEditor
                  key={state.revision}
                  initial={state.draft}
                  label={_('Notes')}
                  placeholder={_(
                    'Write your notes here. Enhance turns them into structured notes using the transcript.',
                  )}
                  onChange={(md) => feed.edit(md)}
                />
              ) : state.status === 'error' ? (
                <p className="m-6 text-body text-status-danger">{saveStatus(state)}</p>
              ) : null}
            </div>
            <ActionItems markdown={state.draft} onCopy={(t) => void copy(t, _('Action items copied'))} />
          </div>
        )}
      </div>
      <KToast message={toast} />
      <VersionHistory
        sessionId={sessionId}
        isOpen={historyOpen}
        onOpenChange={setHistoryOpen}
        headVersion={state.note.version}
        templates={templates}
        onRestore={restore}
      />
      <TemplateEditor sessionId={sessionId} isOpen={templatesOpen} onOpenChange={setTemplatesOpen} />
    </div>
  )
}
