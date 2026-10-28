import type { CalendarStatus, Health } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { formatBytes } from '@kacola/ui-core/settings'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { PermissionKind, PermissionState, PermissionsState, SetupStep } from '../../../shared/bridge.ts'
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
import { downloadProgress, useModelDownloads } from './onboarding-state.ts'

// First run (S-1), as steps: Recording (microphone and system audio: the macOS prompts, or System
// Settings once one was refused; on Linux whether PipeWire capture works), Calendar (macOS Calendar
// through EventKit, which brings every account in Internet Accounts with it; on Linux whether Evolution
// Data Server answers), For agents (the command-line tool and Claude skill, on by default; on GNOME the
// top-bar extension). The speech models the configured pipeline needs start downloading as soon as setup
// opens, with no choice to make, and their progress stays at the top of every step.
// Skippable: Escape, the close button or Skip end it; what was not granted can be granted later.

type Step = SetupStep
const STEPS: Step[] = ['recording', 'calendar', 'agents']
const STEP_TITLES: Record<Step, () => string> = {
  recording: () => _('Recording'),
  calendar: () => _('Your meetings'),
  agents: () => _('For agents'),
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
    ? { subtitle: _('Working'), ok: true }
    : { subtitle: fmt(_('Not available: {detail}'), { detail: c.detail ?? c.backend }), ok: false }
}

// M4: whether meetings can be read from the user's calendars — GNOME's own (Evolution Data Server) or
// macOS Calendar — and which ones.
function calendarText(c: CalendarStatus | undefined, mac: boolean): { subtitle: string; ok: boolean | null } {
  if (!c) return { subtitle: _('Checking…'), ok: null }
  switch (c.state) {
    case 'ok':
      return c.calendars.length
        ? {
            subtitle: fmt(_('Reading {calendars}'), { calendars: c.calendars.map((x) => x.name).join(', ') }),
            ok: true,
          }
        : {
            subtitle: mac
              ? _('No calendars yet. Add an account in Internet Accounts.')
              : _('No calendars found. Add one in GNOME Calendar or Online Accounts.'),
            ok: false,
          }
    case 'starting':
      return { subtitle: _('Connecting to your calendars…'), ok: null }
    case 'off':
      return { subtitle: _('Calendar reading is turned off'), ok: false }
    case 'unavailable':
      return { subtitle: fmt(_('Not available: {detail}'), { detail: c.detail ?? c.provider }), ok: false }
  }
}

function ModelsCard() {
  const models = useModelDownloads()
  const { start } = models
  const p = downloadProgress(models.required)
  const missing = models.missing ?? []
  // no question to answer: what the pipeline needs downloads as soon as setup opens
  const startedOnce = useRef(false)
  useEffect(() => {
    if (startedOnce.current || models.missing === null) return
    startedOnce.current = true
    const want = models.missing.filter((m) => m.state !== 'downloading')
    if (want.length) start(want)
  }, [models.missing, start])
  const retry = missing.filter((m) => m.state === 'missing' || m.state === 'corrupt')

  const subtitle =
    models.list === null
      ? _('Checking…')
      : p.done
        ? fmt(_('Ready · {size}'), { size: formatBytes(p.totalBytes) })
        : fmt(_('Downloading {size} · {percent}'), {
            size: formatBytes(p.totalBytes),
            percent: `${Math.round(p.fraction * 100)}%`,
          })
  return (
    <Section title={_('Speech models')} label={_('Speech models')}>
      <Item name={_('Speech models')}>
        <Row title={_('Transcription and speakers, on this computer')} subtitle={subtitle}>
          {models.list === null ? (
            <Spinner label={_('Loading models')} size={20} />
          ) : p.done ? (
            <span className="text-status-success">
              <Icon name="success" label={_('Ready')} />
            </span>
          ) : models.error && retry.length ? (
            <Button size="sm" onPress={() => start(retry)}>
              {_('Try again')}
            </Button>
          ) : (
            <ProgressBar className="w-36" label={_('Speech models download progress')} value={p.fraction} />
          )}
        </Row>
      </Item>
      {models.error ? (
        <li role="alert" className="px-4 py-3 type-callout text-status-danger-text">
          {fmt(_('Something went wrong: {reason}'), { reason: models.error })}
        </li>
      ) : null}
    </Section>
  )
}

function usePermissions() {
  const { bridge } = useServices()
  const qc = useQueryClient()
  // polled while setup is open: the user may be answering in System Settings
  const q = useQuery({
    queryKey: ['permissions'],
    queryFn: () => bridge.permissions(),
    refetchInterval: 2000,
  })
  const [asking, setAsking] = useState<PermissionKind | null>(null)
  const [asked, setAsked] = useState<ReadonlySet<PermissionKind>>(new Set())
  const request = (kind: PermissionKind) => {
    setAsking(kind)
    void bridge
      .requestPermission(kind)
      .then((s) => qc.setQueryData<PermissionsState>(['permissions'], s))
      .finally(() => {
        setAsking(null)
        setAsked((cur) => new Set(cur).add(kind))
      })
  }
  return { state: q.data, request, asking, asked }
}

/** One macOS permission: granted, a button that shows the system prompt, or the way to System Settings. */
function PermissionRow({
  kind,
  title,
  purpose,
  perms,
  settingsHint,
  extra,
}: {
  kind: PermissionKind
  title: string
  purpose: string
  perms: ReturnType<typeof usePermissions>
  settingsHint: string
  extra?: ReactNode
}) {
  const { bridge } = useServices()
  const state: PermissionState | undefined = perms.state?.[kind]
  // macOS never shows a prompt twice: after the first answer only System Settings can change it
  const refused =
    state === 'denied' || state === 'restricted' || (perms.asked.has(kind) && state !== 'granted')
  const subtitle =
    state === undefined
      ? _('Checking…')
      : state === 'granted'
        ? fmt(_('Allowed · {purpose}'), { purpose })
        : state === 'unavailable'
          ? _('This build of kacola can’t ask for it')
          : refused
            ? settingsHint
            : purpose
  return (
    <Item name={title}>
      <Row title={title} subtitle={subtitle}>
        {state === undefined || perms.asking === kind ? (
          <Spinner label={fmt(_('Asking for {permission}'), { permission: title })} size={20} />
        ) : state === 'granted' ? (
          <span className="text-status-success">
            <Icon name="success" label={_('Allowed')} />
          </span>
        ) : state === 'unavailable' ? (
          <span className="text-status-warning">
            <Icon name="warning" label={_('Not available')} />
          </span>
        ) : refused ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onPress={() => void bridge.openSettingsPane(kind)}>
              {_('Open System Settings')}
            </Button>
            {extra}
          </div>
        ) : (
          <Button
            size="sm"
            variant="primary"
            aria-label={fmt(_('Allow {permission}'), { permission: title })}
            onPress={() => perms.request(kind)}
          >
            {_('Allow')}
          </Button>
        )}
      </Row>
    </Item>
  )
}

function RecordingStep({ mac }: { mac: boolean }) {
  const { bridge, queries } = useServices()
  const health = useQuery({ ...queries.health(), refetchOnMount: 'always' })
  const perms = usePermissions()
  if (!mac) {
    const capture = captureText(health.data)
    return (
      <Section title={_('Audio capture')} label={_('Audio capture')}>
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
    )
  }
  return (
    <Section title={_('Audio capture')} label={_('Audio capture')}>
      <PermissionRow
        kind="microphone"
        title={_('Microphone')}
        purpose={_('Your side of the meeting')}
        perms={perms}
        settingsHint={_('Turn kacola on under Privacy & Security › Microphone')}
      />
      <PermissionRow
        kind="system-audio"
        title={_('System audio')}
        purpose={_('What everyone else says, from your speakers. kacola never records the screen.')}
        perms={perms}
        settingsHint={_(
          'Turn kacola on under Privacy & Security › Screen & System Audio Recording, then restart kacola',
        )}
        extra={
          <Button size="sm" onPress={() => bridge.relaunch()}>
            {_('Restart kacola')}
          </Button>
        }
      />
    </Section>
  )
}

function CalendarStep({ mac }: { mac: boolean }) {
  const { bridge, queries } = useServices()
  // a daemon without the M4 routes (or a failing one) simply leaves the row saying so
  const calendar = useQuery({
    ...queries.calendar(),
    retry: false,
    refetchOnMount: 'always',
    refetchInterval: 3000,
  })
  const perms = usePermissions()
  const cal = calendar.isError
    ? calendarText(
        {
          state: 'unavailable',
          provider: 'daemon',
          detail: calendar.error instanceof Error ? calendar.error.message : String(calendar.error),
          calendars: [],
          updatedAt: null,
        },
        mac,
      )
    : calendarText(calendar.data, mac)
  const status = (
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
  )
  if (!mac)
    return (
      <Section title={_('Meetings')} label={_('Calendar access')}>
        {status}
      </Section>
    )
  return (
    <>
      <p className="m-0 type-body text-text-secondary">
        {_(
          'kacola reads the calendars in the Calendar app, so meetings get their titles and agendas. Your Google account works without a separate sign-in.',
        )}
      </p>
      <Section title={_('Meetings')} label={_('Calendar access')}>
        <PermissionRow
          kind="calendar"
          title={_('Calendars')}
          purpose={_('Every calendar in the Calendar app')}
          perms={perms}
          settingsHint={_('Turn kacola on under Privacy & Security › Calendars')}
        />
        {perms.state?.calendar === 'granted' ? status : null}
        <Item name={_('Google, iCloud or Exchange')}>
          <Row
            title={_('Google, iCloud or Exchange')}
            subtitle={_(
              'Add the account in Internet Accounts with Calendars switched on. kacola picks it up by itself.',
            )}
          >
            <Button size="sm" onPress={() => void bridge.openSettingsPane('internet-accounts')}>
              {_('Open Internet Accounts')}
            </Button>
          </Row>
        </Item>
      </Section>
    </>
  )
}

function AgentsStep({
  installCli,
  setInstallCli,
}: {
  installCli: boolean
  setInstallCli: (on: boolean) => void
}) {
  const cli = useCliInstall()
  const ext = useExtension()
  const showExtension =
    ext.status !== undefined && ext.status.state !== 'unsupported' && ext.status.state !== 'unavailable'
  return (
    <>
      <Section title={_('For agents')} label={_('Command-line tool')}>
        <Item name={_('Install command-line tool and Claude skill')}>
          <Row
            title={_('Install command-line tool and Claude skill')}
            subtitle={
              cli.status?.state === 'installed'
                ? cliSubtitle(cli.status)
                : _('Lets agents like Claude Code read your meetings through the kacola command')
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
        <Section title={_('Top bar')} label={_('Top-bar extension')}>
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
    </>
  )
}

export function OnboardingDialog({
  onFinished,
  initialStep = 'recording',
}: {
  onFinished: () => void
  initialStep?: Step
}) {
  const { appInfo } = useServices()
  const toast = useToast()
  const cli = useCliInstall()
  const mac = appInfo.platform === 'darwin'
  const [step, setStep] = useState<Step>(initialStep)
  const [installCli, setInstallCli] = useState(true)
  const finished = useRef(false)
  const index = STEPS.indexOf(step)
  const last = index === STEPS.length - 1
  const cliWanted = installCli && cli.status !== undefined && cli.status.state !== 'installed'

  const finish = () => {
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
    onFinished()
  }

  return (
    <Dialog
      title={_('Welcome to kacola')}
      isOpen
      isDismissable={false}
      onOpenChange={(o) => !o && finish()}
      footer={
        <>
          {index === 0 ? (
            <Button onPress={finish}>{_('Skip for now')}</Button>
          ) : (
            <Button onPress={() => setStep(STEPS[index - 1]!)}>{_('Back')}</Button>
          )}
          <Button variant="primary" onPress={() => (last ? finish() : setStep(STEPS[index + 1]!))}>
            {last ? _('Done') : _('Continue')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="m-0 type-body text-text-secondary">
          {_(
            'kacola records and transcribes your meetings on this computer. Nothing leaves it unless you set up sync.',
          )}
        </p>
        <ModelsCard />
        <div className="flex flex-col gap-3">
          <p className="m-0 px-1 type-callout text-text-tertiary">
            {fmt(_('Step {n} of {total} · {title}'), {
              n: index + 1,
              total: STEPS.length,
              title: STEP_TITLES[step](),
            })}
          </p>
          {step === 'recording' ? <RecordingStep mac={mac} /> : null}
          {step === 'calendar' ? <CalendarStep mac={mac} /> : null}
          {step === 'agents' ? <AgentsStep installCli={installCli} setInstallCli={setInstallCli} /> : null}
        </div>
      </div>
    </Dialog>
  )
}
