import type { CalendarStatus, Health, ModelInfo } from '@gnomeola/protocol'
import { useEvents, useSettings, useStore } from '@gnomeola/ui-core/hooks'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { formatBytes, missingModels, requiredModels, roleLabel } from '@gnomeola/ui-core/settings'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwActionRow, AdwClamp, AdwDialog, AdwHeaderBar, AdwSpinner, AdwToolbarView } from '@gtkx/jsx/adw'
import {
  GtkBox,
  GtkButton,
  GtkImage,
  GtkLabel,
  GtkListBox,
  GtkProgressBar,
  GtkScrolledWindow,
} from '@gtkx/jsx/gtk'
import { useEffect, useRef, useState } from 'react'
import { NamedButton } from './named-button.tsx'

// S-1 (UI side): first run. Lists the models the configured pipeline needs, with sizes, downloads
// them through the daemon (POST /models/:id/download) with live progress from model.progress
// events, and reports whether audio capture works (health().capture). Skippable; the outcome is
// remembered by the caller in the UI state file (see data/ui-state.ts).

const percent = (p: number | null) => `${Math.round((p ?? 0) * 100)}%`

function stateText(m: ModelInfo): string {
  switch (m.state) {
    case 'ready':
      return _('Ready')
    case 'downloading':
      return fmt(_('Downloading… {percent}'), { percent: percent(m.progress) })
    case 'corrupt':
      return _('Damaged: download again')
    case 'missing':
      return _('Not downloaded')
  }
}

function ModelRow({ model, onDownload }: { model: ModelInfo; onDownload: () => void }) {
  return (
    <AdwActionRow
      title={model.title}
      subtitle={`${roleLabel(model.role)} · ${formatBytes(model.sizeBytes)} · ${stateText(model)}`}
      useMarkup={false}
      suffix={
        model.state === 'ready' ? (
          <GtkImage iconName="object-select-symbolic" cssClasses={['success']} accessibleLabel={_('Ready')} />
        ) : model.state === 'downloading' ? (
          <GtkProgressBar
            valign={Gtk.Align.CENTER}
            widthRequest={140}
            fraction={model.progress ?? 0}
            accessibleLabel={fmt(_('{model} download progress'), { model: model.title })}
          />
        ) : (
          <NamedButton
            text={_('Download')}
            name={fmt(_('Download {model}'), { model: model.title })}
            valign={Gtk.Align.CENTER}
            onClicked={onDownload}
          />
        )
      }
    />
  )
}

function CaptureRow({ health }: { health: Health | null }) {
  const c = health?.capture
  const subtitle = !c
    ? _('Checking…')
    : c.available
      ? fmt(_('Available ({backend})'), { backend: c.backend })
      : fmt(_('Not available: {detail}'), { detail: c.detail ?? c.backend })
  return (
    <AdwActionRow
      title={_('Microphone and system audio')}
      subtitle={subtitle}
      useMarkup={false}
      suffix={
        !c ? (
          <AdwSpinner accessibleLabel={_('Checking audio capture')} />
        ) : (
          <GtkImage
            iconName={c.available ? 'object-select-symbolic' : 'dialog-warning-symbolic'}
            cssClasses={[c.available ? 'success' : 'warning']}
            accessibleLabel={c.available ? _('Capture available') : _('Capture not available')}
          />
        )
      }
    />
  )
}

// S-1 follow-up (M4): whether meetings can be read from the user's calendars. Nothing to grant here —
// the daemon reads GNOME's own calendars (Evolution Data Server) — but the user should know whether it
// works, and where the calendars come from.
function calendarText(c: CalendarStatus | null): { subtitle: string; ok: boolean | null } {
  if (!c) return { subtitle: _('Checking…'), ok: null }
  switch (c.state) {
    case 'ok':
      return c.calendars.length
        ? {
            subtitle: fmt(_('Reading {calendars}'), { calendars: c.calendars.map((x) => x.name).join(', ') }),
            ok: true,
          }
        : { subtitle: _('No calendars found. Add one in GNOME Calendar or Online Accounts.'), ok: false }
    case 'starting':
      return { subtitle: _('Connecting to your calendars…'), ok: null }
    case 'off':
      return { subtitle: _('Calendar reading is turned off'), ok: false }
    case 'unavailable':
      return { subtitle: fmt(_('Not available: {detail}'), { detail: c.detail ?? c.provider }), ok: false }
  }
}

function CalendarRow({ calendar }: { calendar: CalendarStatus | null }) {
  const { subtitle, ok } = calendarText(calendar)
  return (
    <AdwActionRow
      title={_('Calendar')}
      subtitle={subtitle}
      useMarkup={false}
      suffix={
        ok === null ? (
          <AdwSpinner accessibleLabel={_('Checking calendar access')} />
        ) : (
          <GtkImage
            iconName={ok ? 'object-select-symbolic' : 'dialog-warning-symbolic'}
            cssClasses={[ok ? 'success' : 'warning']}
            accessibleLabel={ok ? _('Calendar available') : _('Calendar not available')}
          />
        )
      }
    />
  )
}

export function OnboardingDialog({ onFinished }: { onFinished: (skippedMissing: string[] | null) => void }) {
  const store = useStore()
  const settings = useSettings()
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [health, setHealth] = useState<Health | null>(store.getSnapshot().health)
  const [error, setError] = useState<string | null>(null)
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const finished = useRef(false)

  useEffect(() => {
    const ac = new AbortController()
    store.api
      .listModels(ac.signal)
      .then((m) => {
        if (!ac.signal.aborted) setModels(m)
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e))
      })
    store.refreshHealth().then((h) => {
      if (h && !ac.signal.aborted) setHealth(h)
    })
    // a daemon without the M4 routes (or a failing one) simply leaves the row saying so
    store.api
      .calendarStatus(ac.signal)
      .then((c) => {
        if (!ac.signal.aborted) setCalendar(c)
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted)
          setCalendar({
            state: 'unavailable',
            provider: 'daemon',
            detail: e instanceof Error ? e.message : String(e),
            calendars: [],
            updatedAt: null,
          })
      })
    return () => ac.abort()
  }, [store])

  // live progress for every model, from whichever client started the download
  useEvents((e) => {
    if (e.data.type === 'calendar.updated') setCalendar(e.data.calendar)
    if (e.data.type !== 'model.progress') return
    const m = e.data.model
    setModels((cur) => (cur ? cur.map((x) => (x.id === m.id ? m : x)) : cur))
  })

  const required = models ? requiredModels(models, settings) : []
  const missing = models ? missingModels(models, settings) : []
  const toDownload = missing.filter((m) => m.state !== 'downloading')
  const allReady = models !== null && missing.length === 0

  const download = (m: ModelInfo) => {
    setModels(
      (cur) => cur?.map((x) => (x.id === m.id ? { ...x, state: 'downloading', progress: 0 } : x)) ?? cur,
    )
    store.api
      .downloadModel(m.id)
      .then((next) =>
        setModels((cur) => cur?.map((x) => (x.id === next.id && x.state !== 'ready' ? next : x)) ?? cur),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  const finish = (skipped: boolean) => {
    if (finished.current) return
    finished.current = true
    onFinished(skipped ? missing.map((m) => m.id) : null)
  }

  return (
    <AdwDialog
      title={_('Welcome to gnomeola')}
      contentWidth={560}
      contentHeight={560}
      // Escape or the close button counts as "skip for now"
      onClosed={() => finish(!allReady)}
    >
      <AdwToolbarView topBar={<AdwHeaderBar />}>
        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
          <AdwClamp maximumSize={520} marginTop={6} marginBottom={24} marginStart={18} marginEnd={18}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
              <GtkLabel
                label={_(
                  'gnomeola transcribes on this computer. It needs a few speech models first, and access to your microphone and system audio.',
                )}
                wrap
                xalign={0}
              />
              <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel
                  label={_('Speech Models')}
                  cssClasses={['heading']}
                  xalign={0}
                  accessibleRole={Gtk.AccessibleRole.HEADING}
                  accessibleLevel={2}
                />
                {models === null && !error ? (
                  <AdwSpinner widthRequest={24} heightRequest={24} halign={Gtk.Align.CENTER} />
                ) : (
                  <GtkListBox
                    cssClasses={['boxed-list']}
                    selectionMode={Gtk.SelectionMode.NONE}
                    accessibleLabel={_('Speech models')}
                  >
                    {required.map((m) => (
                      <ModelRow key={m.id} model={m} onDownload={() => download(m)} />
                    ))}
                  </GtkListBox>
                )}
                {error ? (
                  <GtkLabel
                    label={fmt(_('Something went wrong: {reason}'), { reason: error })}
                    cssClasses={['error']}
                    wrap
                    xalign={0}
                  />
                ) : null}
              </GtkBox>
              <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel
                  label={_('Audio Capture')}
                  cssClasses={['heading']}
                  xalign={0}
                  accessibleRole={Gtk.AccessibleRole.HEADING}
                  accessibleLevel={2}
                />
                <GtkListBox
                  cssClasses={['boxed-list']}
                  selectionMode={Gtk.SelectionMode.NONE}
                  accessibleLabel={_('Audio capture')}
                >
                  <CaptureRow health={health} />
                </GtkListBox>
              </GtkBox>
              <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel
                  label={_('Meetings')}
                  cssClasses={['heading']}
                  xalign={0}
                  accessibleRole={Gtk.AccessibleRole.HEADING}
                  accessibleLevel={2}
                />
                <GtkListBox
                  cssClasses={['boxed-list']}
                  selectionMode={Gtk.SelectionMode.NONE}
                  accessibleLabel={_('Calendar access')}
                >
                  <CalendarRow calendar={calendar} />
                </GtkListBox>
              </GtkBox>
              <GtkBox spacing={12} halign={Gtk.Align.END}>
                {allReady ? (
                  <GtkButton
                    label={_('Done')}
                    cssClasses={['suggested-action', 'pill']}
                    onClicked={() => finish(false)}
                  />
                ) : (
                  <>
                    <GtkButton
                      label={_('Skip for Now')}
                      cssClasses={['pill']}
                      onClicked={() => finish(true)}
                    />
                    <NamedButton
                      text={
                        toDownload.length
                          ? fmt(_('Download {size}'), {
                              size: formatBytes(toDownload.reduce((n, m) => n + m.sizeBytes, 0)),
                            })
                          : _('Downloading…')
                      }
                      name={_('Download all models')}
                      cssClasses={['suggested-action', 'pill']}
                      sensitive={toDownload.length > 0}
                      onClicked={() => {
                        for (const m of toDownload) download(m)
                      }}
                    />
                  </>
                )}
              </GtkBox>
            </GtkBox>
          </AdwClamp>
        </GtkScrolledWindow>
      </AdwToolbarView>
    </AdwDialog>
  )
}
