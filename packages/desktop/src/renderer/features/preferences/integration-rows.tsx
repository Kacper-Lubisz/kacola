import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CliInstallState } from '../../../shared/bridge.ts'
import { useServices } from '../../data/services.tsx'
import { AlertDialog, Button, Row, Spinner, Switch, useToast } from '../../design/primitives/index.ts'

// "Install command-line tool and Claude skill", the top-bar extension and "Start in the background at
// login" (Preferences → Integration). All run in main: the CLI through the bundled
// `gnomeola install-cli --json` (src/main/integration.ts), the extension through the Shell's D-Bus API
// (src/main/extension.ts; its row is in ./extension-setup.tsx), autostart through the Background portal /
// an autostart entry
// / a macOS login item (src/main/autostart.ts). Their state is a query keyed ['integration', …] — it
// lives in main, not the daemon, so the EventBridge never touches it.

const CLI_KEY = ['integration', 'cli'] as const
const AUTOSTART_KEY = ['integration', 'autostart'] as const

export function cliSubtitle(s: CliInstallState | undefined): string {
  if (!s) return _('Checking…')
  switch (s.state) {
    case 'installed': {
      const where = fmt(_('Installed at {path}'), { path: s.path })
      if (s.shadowedBy)
        return `${where}. ${fmt(_('Another gnomeola command at {path} comes first on your PATH.'), { path: s.shadowedBy })}`
      if (s.needsAdmin)
        return `${where}. ${fmt(_('{dir} needed administrator rights.'), { dir: s.needsAdmin })}`
      if (!s.onPath) return `${where}. ${_('That folder is not on your PATH yet.')}`
      return where
    }
    case 'outdated':
      return fmt(_('An older version is installed at {path}'), { path: s.path })
    case 'not-installed':
      return _('Lets agents like Claude Code read your meetings through the gnomeola command')
    case 'foreign':
      return s.path
        ? fmt(_('A different gnomeola command is already installed at {path}'), { path: s.path })
        : s.detail
    case 'error':
    case 'unavailable':
      return s.detail
  }
}

export function useCliInstall() {
  const { bridge } = useServices()
  const qc = useQueryClient()
  // always re-checked when shown: another install (or the user) may have changed PATH since
  const status = useQuery({ queryKey: CLI_KEY, queryFn: () => bridge.cliStatus(), refetchOnMount: 'always' })
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<CliInstallState>): Promise<CliInstallState> => {
    setBusy(true)
    try {
      const next = await fn()
      qc.setQueryData(CLI_KEY, next)
      return next
    } finally {
      setBusy(false)
    }
  }
  return {
    status: status.data,
    busy,
    install: (force = false) => run(() => bridge.installCli(force)),
    uninstall: () => run(() => bridge.uninstallCli()),
  }
}

export function CliInstallRow() {
  const cli = useCliInstall()
  const toast = useToast()
  const [confirmReplace, setConfirmReplace] = useState(false)
  const s = cli.status
  const report = (next: CliInstallState, ok: string) => {
    if (next.state === 'installed' || next.state === 'not-installed') toast(ok)
    else if (next.state === 'error')
      toast(fmt(_('Could not install the command-line tool: {reason}'), { reason: next.detail }), {
        tone: 'error',
      })
  }
  return (
    <Row title={_('Command-line tool and Claude skill')} subtitle={cliSubtitle(s)}>
      {!s || cli.busy ? <Spinner label={_('Working…')} size={20} /> : null}
      {s && !cli.busy && (s.state === 'not-installed' || s.state === 'outdated' || s.state === 'error') ? (
        <Button
          variant="primary"
          size="sm"
          onPress={async () => report(await cli.install(), _('Command-line tool installed'))}
        >
          {s.state === 'outdated' ? _('Update') : _('Install')}
        </Button>
      ) : null}
      {s && !cli.busy && s.state === 'installed' ? (
        <>
          <Button
            size="sm"
            onPress={async () => report(await cli.install(), _('Command-line tool reinstalled'))}
          >
            {_('Reinstall')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onPress={async () => report(await cli.uninstall(), _('Command-line tool removed'))}
          >
            {_('Remove')}
          </Button>
        </>
      ) : null}
      {s && !cli.busy && s.state === 'foreign' ? (
        <Button variant="destructive" size="sm" onPress={() => setConfirmReplace(true)}>
          {_('Replace…')}
        </Button>
      ) : null}
      <AlertDialog
        title={_('Replace the other gnomeola command?')}
        isOpen={confirmReplace}
        onOpenChange={setConfirmReplace}
        confirmLabel={_('Replace')}
        destructive
        onConfirm={async () => report(await cli.install(true), _('Command-line tool installed'))}
      >
        {s?.state === 'foreign' && s.path
          ? fmt(
              _(
                '{path} was not installed by this app. Replacing it points the gnomeola command at this app instead.',
              ),
              {
                path: s.path,
              },
            )
          : null}
      </AlertDialog>
    </Row>
  )
}

// The top-bar extension row lives with the sidebar card and onboarding's copy of it.
export { ExtensionRow } from './extension-setup.tsx'

export function BackgroundRow() {
  const { bridge } = useServices()
  const qc = useQueryClient()
  const toast = useToast()
  const status = useQuery({ queryKey: AUTOSTART_KEY, queryFn: () => bridge.getAutostart() })
  const title = _('Start in the background at login')
  return (
    <Row
      title={title}
      subtitle={_('Record from the top bar and the command line without opening this window')}
    >
      <Switch
        aria-label={title}
        isSelected={status.data?.enabled ?? false}
        isDisabled={!status.data}
        onChange={async (enabled) => {
          const next = await bridge.setAutostart(enabled)
          qc.setQueryData(AUTOSTART_KEY, next)
          if (next.detail) toast(next.detail, { tone: 'error' })
        }}
      />
    </Row>
  )
}
