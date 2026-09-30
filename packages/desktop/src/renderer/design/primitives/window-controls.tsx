import { _ } from '@gnomeola/ui-core/i18n'
import { Button as AriaButton } from 'react-aria-components'
import { useServices } from '../../data/services.tsx'
import { Icon, type IconName } from '../icon.tsx'

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
    <div className="flex items-center gap-2 px-1">
      {buttons.map((b) => (
        <AriaButton
          key={b}
          aria-label={LABEL[b]()}
          onPress={() => bridge.windowControl(b)}
          className="app-no-drag flex size-6 cursor-default items-center justify-center rounded-full bg-bg-hover text-text-primary focus-ring data-[hovered]:bg-bg-selected data-[pressed]:bg-border-default"
        >
          <Icon name={ICON[b]} size={b === 'maximize' ? 12 : 14} />
        </AriaButton>
      ))}
    </div>
  )
}
