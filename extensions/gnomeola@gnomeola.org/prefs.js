// gnomeola extension preferences: what the top-bar indicator shows. Recording rules (auto-record) live in
// the gnomeola app's own Preferences, because the daemon — not the Shell — applies them.

import Adw from 'gi://Adw'
import Gio from 'gi://Gio'

import {
  gettext as _,
  ExtensionPreferences,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'

export default class GnomeolaPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings()
    const page = new Adw.PreferencesPage({
      title: _('Top bar'),
      icon_name: 'audio-input-microphone-symbolic',
    })
    const row = (key, title, subtitle) => {
      const r = new Adw.SwitchRow({ title, subtitle })
      settings.bind(key, r, 'active', Gio.SettingsBindFlags.DEFAULT)
      return r
    }

    const recording = new Adw.PreferencesGroup({ title: _('While recording') })
    recording.add(row('show-elapsed', _('Elapsed time'), _('Show how long the meeting has been recorded')))
    recording.add(row('show-last-line', _('Live transcript line'), _('Show the newest line in the menu')))
    page.add(recording)

    const meetings = new Adw.PreferencesGroup({ title: _('Meetings') })
    meetings.add(
      row(
        'notify-meetings',
        _('Meeting reminders'),
        _('Notify shortly before a calendar meeting, with Join'),
      ),
    )
    page.add(meetings)

    window.add(page)
    // keep the settings object alive as long as the window
    window._gnomeolaSettings = settings
  }
}
