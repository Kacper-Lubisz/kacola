import { _ } from '@gnomeola/ui-core/i18n'
import { useServices } from '../../data/services.tsx'
import type { IconName } from '../icon-paths.ts'
import { Button } from './button.tsx'

// Window buttons for the frameless window, placed per org.gnome.desktop.wm.preferences button-layout
// ("appmenu:minimize,maximize,close" → nothing on the left, three on the right). macOS draws native
// traffic lights instead, so this renders nothing there.

type WindowButton = 'minimize' | 'maximize' | 'close'
const KNOWN = new Set<WindowButton>(['minimize', 'maximize', 'close'])

export function parseButtonLayout(layout: string): { start: WindowButton[]; end: WindowButton[] } {
  const [left = '', right = ''] = layout.split(':')
  const pick = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter((x): x is WindowButton => KNOWN.has(x as WindowButton))
  return { start: pick(left), end: pick(right) }
}

const ICON: Record<WindowButton, IconName> = {
  minimize: 'windowMinimize',
  maximize: 'windowMaximize',
  close: 'windowClose',
}
const LABEL: Record<WindowButton, () => string> = {
  minimize: () => _('Minimize'),
  maximize: () => _('Maximize'),
  close: () => _('Close'),
}

export function WindowControls({ side }: { side: 'start' | 'end' }) {
  const { appInfo, bridge } = useServices()
  if (appInfo.platform === 'darwin') return null
  const buttons = parseButtonLayout(appInfo.buttonLayout)[side]
  if (!buttons.length) return null
  return (
    <div className="flex items-center gap-1.5">
      {buttons.map((b) => (
        <Button
          key={b}
          circular
          variant="flat"
          icon={ICON[b]}
          aria-label={LABEL[b]()}
          className="!size-6 bg-hover"
          onPress={() => bridge.windowControl(b)}
        />
      ))}
    </div>
  )
}
