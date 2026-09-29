import { writeFileSync } from 'node:fs'
import { extractActionItems, type Session } from '@gnomeola/protocol'
import * as Gio from '@gtkx/gi/gio'
import * as GLib from '@gtkx/gi/glib'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwActionRow, AdwClamp, AdwSpinner } from '@gtkx/jsx/adw'
import {
  GtkBox,
  GtkButton,
  GtkImage,
  GtkLabel,
  GtkListBox,
  GtkMenuButton,
  GtkPopover,
  GtkScrolledWindow,
  GtkSeparator,
} from '@gtkx/jsx/gtk'
import { useMemo, useRef, useState } from 'react'
import { exportFileName, exportMarkdown, type NotesFeed, type NotesFeedState } from '../data/notes.ts'
import { _, fmt } from '../i18n/index.ts'
import { NamedButton } from './named-button.tsx'
import { NotesEditor } from './notes-editor.tsx'
import { NotesReview } from './notes-review.tsx'
import { useToast } from './toasts.tsx'

// M7 — the Notes page of a session: your markdown notes (autosaved), Enhance (N-2) with a template
// (N-3; the daemon suggests one from the meeting's title), the block-by-block review of the result
// (N-4), and export: copy as Markdown, save to a file, action items (N-5).

function saveStatus(s: NotesFeedState, dirty: boolean): string {
  if (s.status === 'loading') return _('Loading…')
  if (s.status === 'error') return fmt(_('Notes could not be loaded: {reason}'), { reason: s.error ?? '' })
  if (s.saveError) return fmt(_('Not saved: {reason}'), { reason: s.saveError })
  if (s.saving || dirty) return _('Saving…')
  if (s.note.version === 0) return _('Nothing written yet')
  return _('Saved')
}

function ActionItems({ markdown, onCopy }: { markdown: string; onCopy: (text: string) => void }) {
  const items = useMemo(() => extractActionItems(markdown), [markdown])
  if (!items.length) return null
  const lines = items.map(
    (i) =>
      `- [${i.done ? 'x' : ' '}] ${i.text}${i.owner ? ` — ${fmt(_('owner: {owner}'), { owner: i.owner })}` : ''}${i.due ? ` — ${fmt(_('due: {due}'), { due: i.due })}` : ''}`,
  )
  return (
    <AdwClamp maximumSize={760} tighteningThreshold={560} marginStart={12} marginEnd={18} marginBottom={12}>
      <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <GtkBox spacing={6}>
          <GtkLabel
            label={_('Action Items')}
            cssClasses={['heading']}
            xalign={0}
            hexpand
            accessibleRole={Gtk.AccessibleRole.HEADING}
            accessibleLevel={2}
          />
          <GtkButton
            iconName="edit-copy-symbolic"
            cssClasses={['flat']}
            accessibleLabel={_('Copy Action Items')}
            tooltipText={_('Copy Action Items')}
            onClicked={() => onCopy(`${lines.join('\n')}\n`)}
          />
        </GtkBox>
        <GtkListBox
          cssClasses={['boxed-list']}
          selectionMode={Gtk.SelectionMode.NONE}
          accessibleLabel={_('Action items')}
        >
          {items.map((i, n) => (
            <AdwActionRow
              // biome-ignore lint/suspicious/noArrayIndexKey: items are derived positionally from the text
              key={n}
              useMarkup={false}
              title={i.text}
              subtitle={[
                i.owner ? fmt(_('Owner: {owner}'), { owner: i.owner }) : null,
                i.due ? fmt(_('Due: {due}'), { due: i.due }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              prefix={
                <GtkImage
                  iconName={i.done ? 'checkbox-checked-symbolic' : 'checkbox-symbolic'}
                  accessibleLabel={i.done ? _('Done') : _('Open')}
                />
              }
            />
          ))}
        </GtkListBox>
      </GtkBox>
    </AdwClamp>
  )
}

function Enhancing({ text, templateName }: { text: string; templateName: string }) {
  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
      <AdwClamp maximumSize={760} tighteningThreshold={560} marginTop={12} marginStart={12} marginEnd={18}>
        <GtkBox spacing={8}>
          <AdwSpinner accessibleLabel={_('Enhancing')} />
          <GtkLabel
            label={fmt(_('Enhancing your notes with the {template} template…'), { template: templateName })}
            xalign={0}
            wrap
          />
        </GtkBox>
      </AdwClamp>
      <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <AdwClamp
          maximumSize={760}
          tighteningThreshold={560}
          marginTop={12}
          marginBottom={24}
          marginStart={12}
          marginEnd={18}
        >
          <GtkLabel
            label={text}
            cssClasses={['dim-label']}
            wrap
            xalign={0}
            yalign={0}
            accessibleLabel={_('Enhanced notes so far')}
          />
        </AdwClamp>
      </GtkScrolledWindow>
    </GtkBox>
  )
}

export function NotesPane({
  session,
  state,
  feed,
  onOpenPreferences,
}: {
  session: Session
  state: NotesFeedState
  feed: NotesFeed
  onOpenPreferences: () => void
}) {
  const toast = useToast()
  const anchor = useRef<Gtk.Button | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const templates = state.templates
  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? id
  const suggested = state.suggested?.templateId ?? 'general'
  const reviewing = state.enhanced !== null && !state.enhancing
  const dirty = state.draft !== state.note.markdown

  const copy = (text: string, what: string) => {
    const clipboard = anchor.current?.getClipboard()
    if (!clipboard) return
    clipboard.set(text)
    toast(what)
  }
  const exportFile = async () => {
    const dialog = new Gtk.FileDialog()
    dialog.setTitle(_('Export Notes'))
    dialog.setInitialName(exportFileName(session))
    const folder = GLib.getUserSpecialDir(GLib.UserDirectory.DIRECTORY_DOCUMENTS) ?? GLib.getHomeDir()
    if (folder) dialog.setInitialFolder(Gio.File.newForPath(folder))
    try {
      const file = await dialog.save((anchor.current?.getRoot() as Gtk.Window | null) ?? null)
      const path = file.getPath()
      if (!path) throw new Error(_('that location is not a local file'))
      writeFileSync(path, exportMarkdown(session, state.draft))
      toast(fmt(_('Notes exported to {path}'), { path }))
    } catch (err) {
      const e = err as { message?: string; code?: number }
      // dismissing the dialog is not an error
      if (/dismiss|cancel/i.test(e.message ?? '')) return
      toast(fmt(_('The notes could not be exported: {reason}'), { reason: e.message ?? String(err) }))
    }
  }
  const enhance = (templateId?: string) => {
    setMenuOpen(false)
    void feed.enhance(templateId)
  }
  const apply = (choices: Parameters<NotesFeed['merge']>[0]) => {
    setMerging(true)
    void feed.merge(choices).finally(() => setMerging(false))
  }

  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
      <AdwClamp
        maximumSize={reviewing ? 960 : 760}
        tighteningThreshold={560}
        marginTop={6}
        marginBottom={6}
        marginStart={12}
        marginEnd={18}
      >
        <GtkBox spacing={6}>
          <GtkBox cssClasses={['linked']}>
            <NamedButton
              text={_('Enhance')}
              name={_('Enhance Notes')}
              cssClasses={['suggested-action']}
              sensitive={!state.enhancing && !reviewing && state.status === 'ready'}
              tooltipText={fmt(
                _('Rewrite your notes into structured notes using the transcript ({template} template)'),
                {
                  template: nameOf(suggested),
                },
              )}
              onClicked={() => enhance()}
            />
            <GtkMenuButton
              iconName="pan-down-symbolic"
              cssClasses={['suggested-action']}
              accessibleLabel={_('Choose a Template')}
              sensitive={!state.enhancing && !reviewing && state.status === 'ready'}
              active={menuOpen}
              onNotifyActive={(v) => setMenuOpen(Boolean(v))}
              popover={
                <GtkPopover cssClasses={['menu']}>
                  <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} marginTop={6} marginBottom={6}>
                    {templates.map((t) => (
                      <GtkButton
                        key={t.id}
                        label={
                          t.id === suggested
                            ? fmt(_('Enhance as {template} (suggested)'), { template: t.name })
                            : fmt(_('Enhance as {template}'), { template: t.name })
                        }
                        cssClasses={['flat', 'menu-entry']}
                        onClicked={() => enhance(t.id)}
                      />
                    ))}
                  </GtkBox>
                </GtkPopover>
              }
            />
          </GtkBox>
          <GtkLabel
            label={saveStatus(state, dirty)}
            cssClasses={['dim-label', 'caption']}
            hexpand
            xalign={0}
            marginStart={6}
          />
          <GtkButton
            ref={anchor}
            iconName="edit-copy-symbolic"
            cssClasses={['flat']}
            accessibleLabel={_('Copy Notes as Markdown')}
            tooltipText={_('Copy Notes as Markdown')}
            sensitive={state.draft.trim() !== ''}
            onClicked={() => copy(exportMarkdown(session, state.draft), _('Notes copied as Markdown'))}
          />
          <GtkButton
            iconName="document-save-as-symbolic"
            cssClasses={['flat']}
            accessibleLabel={_('Export Notes')}
            tooltipText={_('Export Notes to a Markdown File')}
            sensitive={state.draft.trim() !== ''}
            onClicked={() => void exportFile()}
          />
        </GtkBox>
      </AdwClamp>
      {state.enhanceError ? (
        <AdwClamp
          maximumSize={760}
          tighteningThreshold={560}
          marginStart={12}
          marginEnd={18}
          marginBottom={6}
        >
          <GtkBox
            spacing={8}
            cssClasses={['qa-notice', state.enhanceError.code === 'unavailable' ? 'qa-info' : 'qa-error']}
          >
            <GtkImage iconName="dialog-information-symbolic" valign={Gtk.Align.START} accessibleHidden />
            <GtkLabel
              label={fmt(_('Your notes were not enhanced: {reason}'), { reason: state.enhanceError.message })}
              wrap
              xalign={0}
              hexpand
            />
            {state.enhanceError.code === 'unavailable' ? (
              <GtkButton
                label={_('Open Preferences')}
                valign={Gtk.Align.CENTER}
                onClicked={onOpenPreferences}
              />
            ) : null}
            <GtkButton
              iconName="window-close-symbolic"
              cssClasses={['flat']}
              valign={Gtk.Align.CENTER}
              accessibleLabel={_('Dismiss')}
              onClicked={() => feed.dismissEnhanceError()}
            />
          </GtkBox>
        </AdwClamp>
      ) : null}
      <GtkSeparator />
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
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
          {state.status === 'ready' ? (
            <NotesEditor key={state.revision} initial={state.draft} onChange={(md) => feed.edit(md)} />
          ) : (
            <GtkBox vexpand />
          )}
          <ActionItems markdown={state.draft} onCopy={(t) => copy(t, _('Action items copied'))} />
        </GtkBox>
      )}
    </GtkBox>
  )
}
