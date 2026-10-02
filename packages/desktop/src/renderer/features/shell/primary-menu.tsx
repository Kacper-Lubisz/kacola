import { _ } from '@gnomeola/ui-core/i18n'
import { IconButton, Menu, MenuItem, MenuSeparator } from '../../design/primitives/index.ts'
import { useFollow } from '../agendas/follow.tsx'
import { useDialogs } from './dialogs.tsx'

// The main menu (F10), in home's header bar: Preferences, following a shared agenda, the speech models,
// the shortcuts, About.

export function PrimaryMenu() {
  const dialogs = useDialogs()
  return (
    <Menu
      label={_('Main menu')}
      trigger={<IconButton icon="menu" label={_('Main menu')} data-shortcut="menu" />}
    >
      <MenuItem icon="settings" shortcut="Ctrl+," onAction={() => dialogs.open('preferences')}>
        {_('Preferences')}
      </MenuItem>
      <MenuItem icon="speakers" onAction={() => useFollow.getState().show()}>
        {_('Follow a shared agenda…')}
      </MenuItem>
      <MenuItem icon="download" onAction={() => dialogs.open('onboarding')}>
        {_('Set up speech models…')}
      </MenuItem>
      <MenuItem icon="keyboard" shortcut="Ctrl+?" onAction={() => dialogs.open('shortcuts')}>
        {_('Keyboard shortcuts')}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon="info" onAction={() => dialogs.open('about')}>
        {_('About kacola')}
      </MenuItem>
    </Menu>
  )
}
