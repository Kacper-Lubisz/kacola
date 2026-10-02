import type { NoteTemplate, Session, TemplateSuggestion } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import {
  enhanceProblem,
  exportFileName,
  exportMarkdown,
  type NotesFeed,
  type NotesFeedState,
  startReview,
} from '@gnomeola/ui-core/notes'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Banner,
  Button,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Spinner,
  useToast,
} from '../../design/primitives/index.ts'
import { NotesEditor, type NotesEditorHandle } from '../notes/notes-editor.tsx'
import '../notes/notes.css'
import { TemplateEditor } from '../notes/template-editor.tsx'
import { VersionHistory } from '../notes/version-history.tsx'
import { useDialogs } from '../shell/dialogs.tsx'

// The notes of a meeting. Live: the notepad is the screen — large, calm, the cursor lives here; nothing
// to press. Outcome: the same notes under the outcome, with Enhance — which REPLACES the draft with the
// tidied version (sent with the transcript to the AI provider) and offers "Back to my draft", an undo
// through the version history (restoring adds a version; nothing is ever lost) — plus copy, export,
// the history itself and custom templates. No block-by-block review.

export function saveStatus(s: NotesFeedState): string {
  if (s.status === 'loading') return _('Loading…')
  if (s.status === 'error') return fmt(_('Notes could not be loaded: {reason}'), { reason: s.error ?? '' })
  if (s.saveError) return fmt(_('Not saved: {reason}'), { reason: s.saveError })
  if (s.saving || s.draft !== s.note.markdown) return _('Saving…')
  if (s.note.version === 0) return _('Nothing written yet')
  return _('Saved')
}

/** The live notepad: the editor, focused, and a quiet save state. */
export function LiveNotepad({
  state,
  feed,
  handle,
  bottomSpace,
}: {
  state: NotesFeedState | null
  feed: NotesFeed | null
  handle: { current: NotesEditorHandle | null }
  bottomSpace: number
}) {
  if (!feed || !state || state.status === 'loading')
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label={_('Loading…')} />
      </div>
    )
  if (state.status === 'error')
    return <p className="m-6 type-body text-status-danger-text">{saveStatus(state)}</p>
  return (
    <NotesEditor
      key={state.revision}
      initial={state.draft}
      label={_('Notes')}
      placeholder={_('Type your notes. They stay on this computer.')}
      onChange={(md) => feed.edit(md)}
      handle={handle}
      bottomSpace={bottomSpace}
      size="large"
      autoFocus
    />
  )
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

function Enhancing({ text, templateName }: { text: string; templateName: string }) {
  const n = words(text)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Spinner label={_('Enhancing')} size={20} />
        <div className="flex min-w-0 flex-col">
          <span className="type-body-strong">
            {fmt(_('Tidying your notes with the {template} template…'), { template: templateName })}
          </span>
          <span className="type-caption text-text-secondary" aria-live="off">
            {n === 0 ? _('Reading the transcript…') : fmt(_('{count} words written so far'), { count: n })}
          </span>
        </div>
      </div>
      <div className="h-0.5 overflow-hidden rounded-pill bg-border-subtle" aria-hidden="true">
        <div className="notes-progress h-full w-1/3 rounded-pill bg-record-fill" />
      </div>
      <section
        aria-label={_('Enhanced notes so far')}
        className="whitespace-pre-wrap break-words type-body text-text-secondary"
      >
        {text}
      </section>
    </div>
  )
}

function EnhanceProblem({
  state,
  feed,
  onRetry,
}: {
  state: NotesFeedState
  feed: NotesFeed
  onRetry: () => void
}) {
  const dialogs = useDialogs()
  const err = state.enhanceError!
  const problem = enhanceProblem(err)
  const hint =
    problem === 'refused'
      ? _('Nothing was changed. You can try another template, or keep writing yourself.')
      : problem === 'quota'
        ? _('The AI provider is limiting requests right now. Try again in a minute.')
        : problem === 'unavailable'
          ? _('Enhancing needs an AI provider. Set one up in Preferences.')
          : null
  const title = fmt(_('Your notes were not changed: {reason}'), { reason: err.message })
  return (
    <Banner
      tone={
        problem === 'refused' || problem === 'quota'
          ? 'warning'
          : problem === 'unavailable'
            ? 'info'
            : 'danger'
      }
      title={hint ? `${title} — ${hint}` : title}
      action={
        <div className="flex shrink-0 items-center gap-2">
          {problem === 'unavailable' ? (
            <Button size="sm" onPress={() => dialogs.open('preferences')}>
              {_('Open Preferences')}
            </Button>
          ) : null}
          {problem === 'quota' || problem === 'other' ? (
            <Button size="sm" onPress={onRetry}>
              {_('Try Again')}
            </Button>
          ) : null}
          <IconButton
            icon="close"
            label={_('Dismiss')}
            tooltip={null}
            onPress={() => feed.dismissEnhanceError()}
          />
        </div>
      }
    />
  )
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

/** The outcome's notes: Enhance (replaces, with Back to my draft), the editor, and the notes' menu. */
export function OutcomeNotes({
  session,
  feed,
  state,
  handle,
}: {
  session: Session
  feed: NotesFeed | null
  state: NotesFeedState | null
  handle: { current: NotesEditorHandle | null }
}) {
  const { queries, bridge } = useServices()
  const say = useToast()
  const { data: tpl } = useQuery(queries.templates(session.id))
  const versions = useQuery(queries.noteVersions(session.id)).data
  const [historyOpen, setHistoryOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const lastTemplate = useRef<string | undefined>(undefined)
  // an enhancement this window asked for is applied as soon as it arrives (it replaces the draft)
  const mine = useRef(false)

  const enhanced = state?.enhanced ?? null
  const enhancing = state?.enhancing ?? null
  useEffect(() => {
    if (!feed || !state || !enhanced || enhancing || applying || !mine.current) return
    mine.current = false
    setApplying(true)
    const all = startReview(state.note.markdown, enhanced.markdown).hunks.map(() => 'enhanced' as const)
    void feed.merge(all).finally(() => setApplying(false))
  }, [feed, state, enhanced, enhancing, applying])

  if (!feed || !state)
    return (
      <div className="flex justify-center p-6">
        <Spinner label={_('Loading…')} />
      </div>
    )

  const templates: NoteTemplate[] = tpl?.templates ?? state.templates
  const suggestedId = tpl?.suggested.templateId ?? state.suggested?.templateId ?? 'general'
  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? id
  const canEnhance = !enhancing && !enhanced && !applying && state.status === 'ready'
  const hasText = state.draft.trim() !== ''
  const head = versions?.find((v) => v.version === state.note.version)
  // the head is an applied enhancement: the draft it replaced can come back
  const tidied = head?.kind === 'merge' && head.baseVersion > 0 ? head.baseVersion : null

  const enhance = (templateId?: string) => {
    lastTemplate.current = templateId ?? suggestedId
    mine.current = true
    void feed.enhance(lastTemplate.current)
  }
  const copy = async (text: string, done: string) => {
    try {
      await bridge.copyText(text)
      say(done)
    } catch (err) {
      say(fmt(_('Could not copy: {reason}'), { reason: (err as Error).message }), { tone: 'error' })
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
      say(fmt(_('The notes could not be exported: {reason}'), { reason: (err as Error).message }), {
        tone: 'error',
      })
    }
  }
  const restore = async (version: number) => {
    await feed.restore(version)
    say(fmt(_('Version {n} restored'), { n: version }))
  }

  return (
    <section aria-labelledby="outcome-notes" className="flex flex-col gap-3" data-notes-pane="">
      <div role="toolbar" aria-label={_('Notes')} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="outcome-notes" className="m-0 type-headline text-text-primary">
          {_('Notes')}
        </h2>
        <span className="min-w-0 flex-1 truncate type-caption text-text-secondary" role="status">
          {tidied
            ? _('Tidied from your draft by your AI provider')
            : state.rebased
              ? _('Saved on top of a newer version from elsewhere; that one is in Version History.')
              : saveStatus(state)}
        </span>
        {tidied ? (
          <Button size="sm" variant="ghost" icon="undo" onPress={() => void restore(tidied)}>
            {_('Back to my draft')}
          </Button>
        ) : null}
        <div className="flex">
          <Button
            size="sm"
            icon="enhance"
            aria-label={_('Enhance Notes')}
            aria-description={_(
              'Replaces your notes with a tidied version written from them and the transcript, which are sent to your AI provider. Your draft stays in the history.',
            )}
            isDisabled={!canEnhance}
            className="rounded-r-none"
            onPress={() => enhance()}
          >
            {_('Enhance')}
          </Button>
          <Menu
            label={_('Templates')}
            placement="bottom end"
            trigger={
              <Button
                size="sm"
                icon="chevronDown"
                aria-label={_('Choose a Template')}
                isDisabled={!canEnhance}
                className="rounded-l-none border-l-0 !px-1.5"
              />
            }
          >
            {templates.map((t) => (
              <MenuItem key={t.id} textValue={t.name} onAction={() => enhance(t.id)}>
                <span className="flex items-center gap-2">
                  <span className="flex-1">
                    {t.id === suggestedId
                      ? fmt(_('Enhance as {template} (suggested)'), { template: t.name })
                      : fmt(_('Enhance as {template}'), { template: t.name })}
                  </span>
                  {t.builtIn ? null : <span className="type-caption text-text-secondary">{_('Custom')}</span>}
                </span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem icon="edit" onAction={() => setTemplatesOpen(true)}>
              {_('Manage Templates…')}
            </MenuItem>
          </Menu>
        </div>
        <Menu label={_('Notes actions')} trigger={<IconButton icon="more" label={_('Notes actions')} />}>
          <MenuItem icon="history" onAction={() => setHistoryOpen(true)}>
            {_('Version History…')}
          </MenuItem>
          <MenuItem
            icon="copy"
            isDisabled={!hasText}
            onAction={() => void copy(exportMarkdown(session, state.draft), _('Notes copied as Markdown'))}
          >
            {_('Copy Notes as Markdown')}
          </MenuItem>
          <MenuItem icon="exportFile" isDisabled={!hasText} onAction={() => void exportFile()}>
            {_('Export Notes…')}
          </MenuItem>
        </Menu>
      </div>
      {!enhancing && !enhanced ? (
        <p className="m-0 -mt-2 type-caption text-text-tertiary">
          {suggestionHint(tpl?.suggested, nameOf(suggestedId))}
        </p>
      ) : null}
      {state.enhanceError ? (
        <EnhanceProblem state={state} feed={feed} onRetry={() => enhance(lastTemplate.current)} />
      ) : null}
      {enhanced && !enhancing && !applying && !mine.current ? (
        <Banner
          tone="info"
          title={_('A tidied version of these notes is waiting (made elsewhere).')}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                onPress={() => {
                  const all = startReview(state.note.markdown, enhanced.markdown).hunks.map(
                    () => 'enhanced' as const,
                  )
                  setApplying(true)
                  void feed.merge(all).finally(() => setApplying(false))
                }}
              >
                {_('Use It')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() =>
                  void feed.merge(
                    startReview(state.note.markdown, enhanced.markdown).hunks.map(() => 'mine' as const),
                  )
                }
              >
                {_('Keep Mine')}
              </Button>
            </div>
          }
        />
      ) : null}
      <div className="min-h-[200px] rounded-lg">
        {enhancing ? (
          <Enhancing text={enhancing.text} templateName={nameOf(enhancing.templateId)} />
        ) : state.status === 'ready' ? (
          <NotesEditor
            key={state.revision}
            initial={state.draft}
            label={_('Notes')}
            placeholder={_('Nothing written. Enhance writes notes from the transcript.')}
            onChange={(md) => feed.edit(md)}
            handle={handle}
          />
        ) : state.status === 'error' ? (
          <p className="m-0 type-body text-status-danger-text">{saveStatus(state)}</p>
        ) : (
          <Spinner label={_('Loading…')} />
        )}
      </div>
      <VersionHistory
        sessionId={session.id}
        isOpen={historyOpen}
        onOpenChange={setHistoryOpen}
        headVersion={state.note.version}
        templates={templates}
        onRestore={restore}
      />
      <TemplateEditor sessionId={session.id} isOpen={templatesOpen} onOpenChange={setTemplatesOpen} />
    </section>
  )
}
