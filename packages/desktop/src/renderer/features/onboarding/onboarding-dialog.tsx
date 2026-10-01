import type { CalendarStatus, Health, ModelInfo, Settings } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { formatBytes, missingModels, requiredModels, roleLabel } from '@gnomeola/ui-core/settings'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useRef, useState } from 'react'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Card,
  Dialog,
  Icon,
  ProgressBar,
  Row,
  Spinner,
  Switch,
  useToast,
} from '../../design/primitives/index.ts'
import { ExtensionAction, ExtensionSubtitle, useExtension } from '../preferences/extension-setup.tsx'
import { cliSubtitle, useCliInstall } from '../preferences/integration-rows.tsx'

// First run (S-1): the models the configured pipeline needs, with sizes, downloaded through the daemon
// (POST /models/:id/download) with live progress from model.progress events (EventBridge → ['models']);
// whether audio capture works (health().capture); whether meetings can be read from the calendar; and
// — new in the desktop app — installing the command-line tool and Claude skill (on by default) and, on
// GNOME, the top-bar extension (its own button: it may need a new login, so never done on Done).
// Skippable: Escape or the close button counts as "skip for now"; the caller remembers the outcome.

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

function Section({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="m-0 px-1 type-overline text-text-secondary">{title}</h2>
      <Card>
        <ul aria-label={label} className="m-0 flex list-none flex-col divide-y divide-border-subtle p-0">
          {children}
        </ul>
      </Card>
    </section>
  )
}

function Item({ name, children }: { name: string; children: ReactNode }) {
  return <li aria-label={name}>{children}</li>
}

function StatusMark({
  ok,
  yes,
  no,
  checking,
}: {
  ok: boolean | null
  yes: string
  no: string
  checking: string
}) {
  if (ok === null) return <Spinner label={checking} size={20} />
  return (
    <span className={ok ? 'text-status-success' : 'text-status-warning'}>
      <Icon name={ok ? 'success' : 'warning'} label={ok ? yes : no} />
    </span>
  )
}

function captureText(h: Health | undefined): { subtitle: string; ok: boolean | null } {
  const c = h?.capture
  if (!c) return { subtitle: _('Checking…'), ok: null }
  return c.available
    ? { subtitle: fmt(_('Available ({backend})'), { backend: c.backend }), ok: true }
    : { subtitle: fmt(_('Not available: {detail}'), { detail: c.detail ?? c.backend }), ok: false }
}

// M4: whether meetings can be read from the user's calendars (GNOME's own, through Evolution Data
// Server) — nothing to grant, but the user should know whether it works and where calendars come from.
function calendarText(c: CalendarStatus | undefined): { subtitle: string; ok: boolean | null } {
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

export function OnboardingDialog({ onFinished }: { onFinished: (skippedMissing: string[] | null) => void }) {
  const { api, queries } = useServices()
  const qc = useQueryClient()
  const toast = useToast()
  const models = useQuery({ ...queries.models(), refetchOnMount: 'always' })
  const settings = useQuery(queries.settings())
  const health = useQuery({ ...queries.health(), refetchOnMount: 'always' })
  // a daemon without the M4 routes (or a failing one) simply leaves the row saying so
  const calendar = useQuery({ ...queries.calendar(), retry: false, refetchOnMount: 'always' })
  const cli = useCliInstall()
  const ext = useExtension()
  const showExtension =
    ext.status !== undefined && ext.status.state !== 'unsupported' && ext.status.state !== 'unavailable'
  const [installCli, setInstallCli] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const finished = useRef(false)

  const s = (settings.data as Settings | undefined) ?? null
  const list = models.data ?? null
  const required = list ? requiredModels(list, s) : []
  const missing = list ? missingModels(list, s) : []
  const toDownload = missing.filter((m) => m.state !== 'downloading')
  const allReady = list !== null && missing.length === 0
  const cliWanted = installCli && cli.status !== undefined && cli.status.state !== 'installed'

  const download = (m: ModelInfo) => {
    qc.setQueryData<ModelInfo[]>(keys.models(), (cur) =>
      cur?.map((x) => (x.id === m.id ? { ...x, state: 'downloading', progress: 0 } : x)),
    )
    api
      .call('downloadModel', { params: { id: m.id } })
      .then((next) =>
        qc.setQueryData<ModelInfo[]>(keys.models(), (cur) =>
          cur?.map((x) => (x.id === next.id && x.state !== 'ready' ? next : x)),
        ),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  const finish = (skipped: boolean) => {
    if (finished.current) return
    finished.current = true
    if (cliWanted)
      void cli.install().then((r) => {
        if (r.state === 'installed') toast(_('Command-line tool installed'))
        else if (r.state === 'error' || r.state === 'foreign')
          toast(fmt(_('Could not install the command-line tool: {reason}'), { reason: r.detail }), {
            tone: 'error',
          })
      })
    onFinished(skipped ? missing.map((m) => m.id) : null)
  }

  const capture = captureText(health.data)
  const cal = calendar.isError
    ? calendarText({
        state: 'unavailable',
        provider: 'daemon',
        detail: calendar.error instanceof Error ? calendar.error.message : String(calendar.error),
        calendars: [],
        updatedAt: null,
      })
    : calendarText(calendar.data)

  return (
    <Dialog
      title={_('Welcome to gnomeola')}
      isOpen
      isDismissable={false}
      onOpenChange={(o) => !o && finish(!allReady)}
      footer={
        allReady ? (
          <Button variant="primary" onPress={() => finish(false)}>
            {_('Done')}
          </Button>
        ) : (
          <>
            <Button onPress={() => finish(true)}>{_('Skip for Now')}</Button>
            <Button
              variant="primary"
              aria-label={_('Download all models')}
              isDisabled={toDownload.length === 0}
              onPress={() => {
                for (const m of toDownload) download(m)
              }}
            >
              {toDownload.length
                ? fmt(_('Download {size}'), {
                    size: formatBytes(toDownload.reduce((n, m) => n + m.sizeBytes, 0)),
                  })
                : _('Downloading…')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <p className="m-0 type-body text-text-secondary">
            {_(
              'gnomeola transcribes on this computer. It needs a few speech models first, and access to your microphone and system audio.',
            )}
          </p>
        </div>
        <Section title={_('Speech Models')} label={_('Speech models')}>
          {list === null && !error ? (
            <li className="flex justify-center py-4">
              <Spinner label={_('Loading models')} />
            </li>
          ) : (
            required.map((m) => (
              <Item key={m.id} name={m.title}>
                <Row
                  title={m.title}
                  subtitle={`${roleLabel(m.role)} · ${formatBytes(m.sizeBytes)} · ${stateText(m)}`}
                >
                  {m.state === 'ready' ? (
                    <span className="text-status-success">
                      <Icon name="success" label={_('Ready')} />
                    </span>
                  ) : m.state === 'downloading' ? (
                    <ProgressBar
                      className="w-36"
                      label={fmt(_('{model} download progress'), { model: m.title })}
                      value={m.progress ?? 0}
                    />
                  ) : (
                    <Button
                      size="sm"
                      aria-label={fmt(_('Download {model}'), { model: m.title })}
                      onPress={() => download(m)}
                    >
                      {_('Download')}
                    </Button>
                  )}
                </Row>
              </Item>
            ))
          )}
        </Section>
        {error ? (
          <p role="alert" className="m-0 type-callout text-status-danger-text">
            {fmt(_('Something went wrong: {reason}'), { reason: error })}
          </p>
        ) : null}
        <Section title={_('Audio Capture')} label={_('Audio capture')}>
          <Item name={_('Microphone and system audio')}>
            <Row title={_('Microphone and system audio')} subtitle={capture.subtitle}>
              <StatusMark
                ok={capture.ok}
                yes={_('Capture available')}
                no={_('Capture not available')}
                checking={_('Checking audio capture')}
              />
            </Row>
          </Item>
        </Section>
        <Section title={_('Meetings')} label={_('Calendar access')}>
          <Item name={_('Calendar')}>
            <Row title={_('Calendar')} subtitle={cal.subtitle}>
              <StatusMark
                ok={cal.ok}
                yes={_('Calendar available')}
                no={_('Calendar not available')}
                checking={_('Checking calendar access')}
              />
            </Row>
          </Item>
        </Section>
        <Section title={_('For Agents')} label={_('Command-line tool')}>
          <Item name={_('Install command-line tool and Claude skill')}>
            <Row
              title={_('Install command-line tool and Claude skill')}
              subtitle={
                cli.status?.state === 'installed'
                  ? cliSubtitle(cli.status)
                  : _('Lets agents like Claude Code read your meetings through the gnomeola command')
              }
            >
              {cli.status?.state === 'installed' ? (
                <span className="text-status-success">
                  <Icon name="success" label={_('Installed')} />
                </span>
              ) : (
                <Switch
                  aria-label={_('Install command-line tool and Claude skill')}
                  isSelected={installCli}
                  onChange={setInstallCli}
                />
              )}
            </Row>
          </Item>
        </Section>
        {showExtension ? (
          <Section title={_('Top Bar')} label={_('Top-bar extension')}>
            <Item name={_('Top-bar extension')}>
              <Row title={_('Top-bar extension')} subtitle={<ExtensionSubtitle view={ext.view} />}>
                {ext.view.on ? (
                  <span className="text-status-success">
                    <Icon name="success" label={_('On')} />
                  </span>
                ) : (
                  <ExtensionAction ext={ext} variant="secondary" />
                )}
              </Row>
            </Item>
          </Section>
        ) : null}
      </div>
    </Dialog>
  )
}
