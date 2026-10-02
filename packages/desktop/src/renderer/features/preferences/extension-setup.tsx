import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ExtensionState } from '../../../shared/bridge.ts'
import { useServices } from '../../data/services.tsx'
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Row,
  Spinner,
  useToast,
} from '../../design/primitives/index.ts'

// The top-bar extension, wherever the window offers it: Preferences › Integration (ExtensionRow), a
// dismissible card at the foot of the sidebar (ExtensionCard: GNOME only, while the extension is not
// on), and onboarding (ExtensionAction inside its own row). One button does the right thing for the
// state main reports (src/main/extension.ts): Install & Enable, Update, Enable, Try Again — and when
// GNOME has every user extension switched off it asks first, because switching them back on affects
// the user's other extensions too. Re-checked whenever the window regains focus (the user may have
// logged in again, or used GNOME Extensions meanwhile).

export const EXT_KEY = ['integration', 'extension'] as const
const UI_STATE_KEY = ['integration', 'ui-state'] as const

export type ExtensionAct = 'install' | 'update' | 'enable' | 'retry'

export type ExtensionView = {
  subtitle: string
  /** The one button, if there is something to do. */
  act: ExtensionAct | null
  label: string
  /** Pressing it also switches GNOME's user extensions back on (asked first). */
  asks: boolean
  /** A command the user runs themselves (Flatpak). */
  command: string | null
  on: boolean
  /** Installed by us (so Remove makes sense). */
  removable: boolean
  /** Worth the sidebar card. */
  card: boolean
}

const LABEL: Record<ExtensionAct, () => string> = {
  install: () => _('Install and turn on'),
  update: () => _('Update'),
  enable: () => _('Turn on'),
  retry: () => _('Try again'),
}

/** What the row / card / onboarding show for a state (undefined: still checking). */
export function extensionView(s: ExtensionState | undefined): ExtensionView {
  const v = (
    subtitle: string,
    act: ExtensionAct | null,
    o: Partial<Omit<ExtensionView, 'subtitle' | 'act' | 'label'>> = {},
  ): ExtensionView => ({
    subtitle,
    act,
    label: act ? LABEL[act]() : '',
    asks: false,
    command: null,
    on: false,
    removable: true,
    card: true,
    ...o,
  })
  if (!s) return v(_('Checking…'), null, { removable: false, card: false })
  const off = 'userExtensionsOff' in s && s.userExtensionsOff
  const offNote = (text: string) => (off ? `${text}. ${_('Extensions are turned off in GNOME')}` : text)
  switch (s.state) {
    case 'unsupported':
      return v('', null, { removable: false, card: false })
    case 'unavailable':
      return v(s.detail, null, { removable: false, card: false })
    case 'not-installed':
      return v(offNote(_('Shows the recording state and the next meeting in the GNOME top bar')), 'install', {
        asks: off,
        removable: false,
      })
    case 'outdated':
      return v(
        offNote(
          s.installed && s.installed !== s.bundled
            ? fmt(_('Version {installed} is installed; this app comes with {bundled}'), {
                installed: s.installed,
                bundled: s.bundled,
              })
            : _('An older copy is installed; this app comes with a newer one'),
        ),
        'update',
        { asks: off },
      )
    case 'needs-login': {
      if (s.reason === 'updated')
        return v(offNote(_('Updated — log out and back in to use the new version')), off ? 'enable' : null, {
          asks: off,
        })
      if (s.command)
        return v(_('Installed — log out and back in, then run this in a terminal to turn it on:'), null, {
          command: s.command,
        })
      if (!s.queued || off) return v(offNote(_('Installed, but not turned on')), 'enable', { asks: off })
      return v(
        s.session === 'x11'
          ? _('Installed — log out and back in (or restart GNOME Shell with Alt+F2, r) to turn it on')
          : _('Installed — log out and back in to turn it on'),
        null,
      )
    }
    case 'disabled':
      return v(
        off ? _('Installed, but extensions are turned off in GNOME') : _('Installed, but turned off'),
        'enable',
        {
          asks: off,
        },
      )
    case 'enabled':
      return v(_('On — showing in the GNOME top bar'), null, { on: true, card: false })
    case 'manual':
      return v(_('Installed. To turn it on, run this in a terminal:'), null, { command: s.command })
    case 'error':
      return v(
        s.reason === 'crashed'
          ? fmt(_('It stopped with an error: {reason}'), { reason: s.detail })
          : s.reason === 'shell-version'
            ? _('The installed copy does not support this version of GNOME Shell')
            : s.detail,
        'retry',
      )
  }
}

/** The toast after a press of the one button. */
function outcome(s: ExtensionState): { text: string; error?: boolean } | null {
  switch (s.state) {
    case 'enabled':
      return { text: _('The top-bar extension is on') }
    case 'manual':
      return { text: _('Installed. Run the command shown to turn it on.') }
    case 'needs-login':
      return {
        text: s.command ? _('Installed. Run the command shown to turn it on.') : extensionView(s).subtitle,
      }
    case 'error':
      return {
        text: fmt(_('Could not turn on the top-bar extension: {reason}'), { reason: s.detail }),
        error: true,
      }
    case 'unavailable':
      return { text: s.detail, error: true }
    default:
      return null
  }
}

export function useExtension() {
  const { bridge } = useServices()
  const qc = useQueryClient()
  const status = useQuery({
    queryKey: EXT_KEY,
    queryFn: () => bridge.extensionStatus(),
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const { refetch } = status
  // the window's own focus event (an Electron window keeps `visibilityState` when it loses focus, so
  // TanStack's refetch-on-focus never fires); every place showing it listens, one check serves them all
  useEffect(() => {
    const onFocus = () => void refetch({ cancelRefetch: false })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetch])
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<ExtensionState>): Promise<ExtensionState> => {
    setBusy(true)
    try {
      const next = await fn()
      qc.setQueryData(EXT_KEY, next)
      return next
    } finally {
      setBusy(false)
    }
  }
  return {
    status: status.data,
    view: extensionView(status.data),
    busy,
    turnOn: () => run(() => bridge.installExtension()),
    disable: () => run(() => bridge.disableExtension()),
    remove: () => run(() => bridge.removeExtension()),
  }
}

/** The command to run, with a Copy button (Flatpak: the sandbox cannot reach the Shell). */
function CommandLine({ command }: { command: string }) {
  const { bridge } = useServices()
  const toast = useToast()
  return (
    <span className="mt-1 flex items-center gap-2">
      <code className="min-w-0 flex-1 rounded-sm bg-bg-sidebar px-2 py-1 type-mono [overflow-wrap:anywhere] text-text-primary select-all">
        {command}
      </code>
      <IconButton
        icon="copy"
        size="sm"
        label={_('Copy command')}
        onPress={() => void bridge.copyText(command).then(() => toast(_('Copied the command')))}
      />
    </span>
  )
}

/** The one button (and the "turn GNOME extensions back on?" question it may ask first). */
export function ExtensionAction({
  ext,
  variant = 'primary',
}: {
  ext: ReturnType<typeof useExtension>
  variant?: 'primary' | 'secondary'
}) {
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const { view } = ext
  if (ext.busy) return <Spinner label={_('Working…')} size={20} />
  if (!view.act) return null
  const go = async () => {
    const o = outcome(await ext.turnOn())
    if (o) toast(o.text, o.error ? { tone: 'error' } : undefined)
  }
  return (
    <>
      <Button variant={variant} size="sm" onPress={() => (view.asks ? setAsking(true) : void go())}>
        {view.label}
      </Button>
      <AlertDialog
        title={_('Turn on GNOME extensions?')}
        isOpen={asking}
        onOpenChange={setAsking}
        confirmLabel={_('Turn on extensions')}
        onConfirm={() => void go()}
      >
        {_(
          'Extensions are turned off in GNOME. Turning on the top-bar extension turns extensions back on, including any others you have enabled.',
        )}
      </AlertDialog>
    </>
  )
}

export function ExtensionSubtitle({ view }: { view: ExtensionView }) {
  return (
    <>
      {view.subtitle}
      {view.command ? <CommandLine command={view.command} /> : null}
    </>
  )
}

/** Preferences › Integration. */
export function ExtensionRow() {
  const ext = useExtension()
  const toast = useToast()
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (ext.status?.state === 'unsupported') return null
  const { view } = ext
  return (
    <Row title={_('Top-bar extension')} subtitle={<ExtensionSubtitle view={view} />}>
      {!ext.status ? <Spinner label={_('Checking…')} size={20} /> : null}
      {view.on && !ext.busy ? (
        <Chip tone="success" icon="success">
          {_('On')}
        </Chip>
      ) : null}
      <ExtensionAction ext={ext} />
      {view.on && !ext.busy ? (
        <Button
          size="sm"
          onPress={async () => {
            const next = await ext.disable()
            if (next.state !== 'enabled') toast(_('The top-bar extension is off'))
          }}
        >
          {_('Turn off')}
        </Button>
      ) : null}
      {view.removable && !ext.busy ? (
        <Button variant="destructive" size="sm" onPress={() => setConfirmRemove(true)}>
          {_('Remove')}
        </Button>
      ) : null}
      <AlertDialog
        title={_('Remove the top-bar extension?')}
        isOpen={confirmRemove}
        onOpenChange={setConfirmRemove}
        confirmLabel={_('Remove')}
        destructive
        onConfirm={async () => {
          const next = await ext.remove()
          if (next.state === 'not-installed') toast(_('The top-bar extension was removed'))
          else if (next.state === 'error') toast(next.detail, { tone: 'error' })
        }}
      >
        {_('It disappears from the top bar and is deleted from your extensions folder.')}
      </AlertDialog>
    </Row>
  )
}

/** The sidebar card's dismissal, kept in ui-state.json (read fresh before writing: onboarding writes it too). */
function useCardDismissed() {
  const { bridge } = useServices()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: UI_STATE_KEY,
    queryFn: async () => (await bridge.getUiState()).extensionCardDismissed === true,
  })
  const dismiss = async () => {
    qc.setQueryData(UI_STATE_KEY, true)
    try {
      const cur = await bridge.getUiState()
      await bridge.setUiState({ ...cur, extensionCardDismissed: true })
    } catch {
      // not fatal: the card simply comes back next time
    }
  }
  // until it is known, treat it as dismissed: the card must not flash up and vanish
  return { dismissed: q.data ?? true, dismiss }
}

/** The sidebar card: GNOME only, while the extension is not on, until dismissed. */
export function ExtensionCard() {
  const ext = useExtension()
  const card = useCardDismissed()
  if (card.dismissed || !ext.view.card) return null
  return (
    <section aria-label={_('Top-bar extension')}>
      {/* one line: what it is, the one thing to do, dismiss; a narrow window wraps the button under */}
      <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Icon name="topBar" size={18} className="mt-0.5 shrink-0 self-start text-text-secondary" />
        <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
          <h2 className="m-0 type-body-strong text-text-primary">{_('Top-bar extension')}</h2>
          <p className="m-0 type-callout text-text-secondary">
            <ExtensionSubtitle view={ext.view} />
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {ext.view.act || ext.busy ? <ExtensionAction ext={ext} variant="secondary" /> : null}
          <IconButton icon="close" size="sm" label={_('Dismiss')} onPress={() => void card.dismiss()} />
        </div>
      </Card>
    </section>
  )
}
