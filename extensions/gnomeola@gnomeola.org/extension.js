// gnomeola top-bar indicator (C-5 … C-7): recording state, elapsed time and the newest transcript line in
// the panel; upcoming meetings with one-click Join (start recording, then open the call) in the menu.
//
// It talks to the daemon only through org.gnome.Gnomeola on the session bus (./dbus.js). The proxy is
// created without auto-start and follows the name's owner, so the indicator shows "not running" while
// gnomeolad is down and recovers by itself when it comes back — the Shell never waits on the daemon.
//
// Everything the menu shows is decided in ./model.js (pure, unit-tested); this file renders it.

import Clutter from 'gi://Clutter'
import Gio from 'gi://Gio'
import GLib from 'gi://GLib'
import GObject from 'gi://GObject'
import Shell from 'gi://Shell'
import St from 'gi://St'

import { gettext as _, Extension } from 'resource:///org/gnome/shell/extensions/extension.js'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js'
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'

import { BUS_NAME, INTERFACE_NAME, INTERFACE_XML, OBJECT_PATH } from './dbus.js'
import { buildView, meetingNotification, structureKey } from './model.js'

const APP_ID = 'org.gnome.Gnomeola.desktop'
const PROPS = [
  'State',
  'SessionId',
  'SessionTitle',
  'SessionMeetingId',
  'ElapsedMs',
  'RunningSince',
  'LastLine',
  'LastSpeaker',
  'CurrentMeeting',
  'NextMeeting',
  'UpcomingMeetings',
  'CalendarState',
  'CalendarDetail',
  'AutoRecord',
  'DaemonUrl',
  'Version',
]

const Indicator = GObject.registerClass(
  class GnomeolaIndicator extends PanelMenu.Button {
    _init(ext) {
      super._init(0.0, 'kacola', false)
      this._ext = ext
      this._settings = ext.getSettings()
      this._interface = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' })
      this._proxy = null
      this._cancellable = new Gio.Cancellable()
      this._tickId = 0
      this._structure = null
      this._rows = new Map()
      this._source = null
      this._view = null

      const box = new St.BoxLayout({ style_class: 'panel-status-menu-box gnomeola-panel' })
      this._icon = new St.Icon({
        icon_name: 'audio-input-microphone-symbolic',
        style_class: 'system-status-icon',
      })
      this._label = new St.Label({ text: '', y_align: Clutter.ActorAlign.CENTER, visible: false })
      this._label.add_style_class_name('gnomeola-elapsed')
      box.add_child(this._icon)
      box.add_child(this._label)
      this.add_child(box)

      this._settingsIds = ['show-elapsed', 'show-last-line'].map((k) =>
        this._settings.connect(`changed::${k}`, () => this._refresh()),
      )
      this._clockId = this._interface.connect('changed::clock-format', () => this._refresh(true))
      this._menuOpenId = this.menu.connect('open-state-changed', () => this._refresh())

      this._connect()
      this._refresh(true)
    }

    // ------------------------------------------------------------------ D-Bus

    _connect() {
      const info = Gio.DBusNodeInfo.new_for_xml(INTERFACE_XML).lookup_interface(INTERFACE_NAME)
      Gio.DBusProxy.new(
        Gio.DBus.session,
        Gio.DBusProxyFlags.DO_NOT_AUTO_START,
        info,
        BUS_NAME,
        OBJECT_PATH,
        INTERFACE_NAME,
        this._cancellable,
        (_o, res) => {
          let proxy
          try {
            proxy = Gio.DBusProxy.new_finish(res)
          } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
              console.warn(`gnomeola: proxy failed: ${e.message}`)
            return
          }
          this._proxy = proxy
          this._proxyIds = [
            proxy.connect('g-properties-changed', () => this._refresh()),
            proxy.connect('notify::g-name-owner', () => this._refresh(true)),
            proxy.connect('g-signal', (_p, _sender, name, params) => this._onSignal(name, params)),
          ]
          this._refresh(true)
        },
      )
    }

    _props() {
      const out = {}
      if (!this._proxy) return out
      for (const name of PROPS) {
        const v = this._proxy.get_cached_property(name)
        if (v) out[name] = v.recursiveUnpack()
      }
      return out
    }

    _daemonPresent() {
      return Boolean(this._proxy?.g_name_owner)
    }

    _call(method, args = null) {
      return new Promise((resolve, reject) => {
        if (!this._proxy) {
          reject(new Error(_('kacola is not running')))
          return
        }
        this._proxy.call(method, args, Gio.DBusCallFlags.NONE, 15_000, this._cancellable, (p, res) => {
          try {
            resolve(p.call_finish(res).recursiveUnpack())
          } catch (e) {
            reject(e)
          }
        })
      })
    }

    _onSignal(name, params) {
      if (name !== 'MeetingStarting' || !this._settings.get_boolean('notify-meetings')) return
      const [meeting] = params.recursiveUnpack()
      const n = meetingNotification(meeting, Date.now(), _, this._clock24())
      if (!n) return
      if (!this._source) {
        this._source = new MessageTray.Source({
          title: 'kacola',
          iconName: 'audio-input-microphone-symbolic',
        })
        this._source.connect('destroy', () => {
          this._source = null
        })
        Main.messageTray.add(this._source)
      }
      const notification = new MessageTray.Notification({
        source: this._source,
        title: n.title,
        body: n.body,
      })
      notification.addAction(n.actionLabel, () => this._join(n.meetingId, n.joinUrl))
      this._source.addNotification(notification)
    }

    // ---------------------------------------------------------------- actions

    async _join(meetingId, joinUrl) {
      let url = joinUrl
      try {
        const [, returned] = await this._call('Join', new GLib.Variant('(s)', [meetingId]))
        url = returned || joinUrl
      } catch (e) {
        // Recording could not start (e.g. another session is recording). The call still happens: open it.
        Main.notify(_('kacola could not start recording'), errorText(e))
      }
      if (url) this._openUri(url)
    }

    _openUri(url) {
      try {
        Gio.AppInfo.launch_default_for_uri(url, global.create_app_launch_context(0, -1))
      } catch (e) {
        Main.notify(_('Could not open the meeting link'), e.message)
      }
    }

    _openWindow() {
      const app = Shell.AppSystem.get_default().lookup_app(APP_ID)
      if (app) {
        app.activate()
        return
      }
      const info = Gio.DesktopAppInfo.new(APP_ID)
      if (info) info.launch([], global.create_app_launch_context(0, -1))
      else Main.notify(_('kacola is not installed'), _('The kacola application could not be found.'))
    }

    _run(action) {
      switch (action.type) {
        case 'open-window':
          this._openWindow()
          return
        case 'preferences':
          this._ext.openPreferences()
          return
        case 'join':
          this._join(action.meetingId, action.joinUrl)
          return
        case 'call': {
          const args = action.method === 'Start' ? new GLib.Variant('(s)', ['']) : null
          this._call(action.method, args).catch((e) => Main.notify(_('kacola'), errorText(e)))
          return
        }
      }
    }

    // ------------------------------------------------------------------ view

    _clock24() {
      return this._interface.get_string('clock-format') !== '12h'
    }

    _refresh(force = false) {
      const view = buildView(this._props(), {
        daemon: this._daemonPresent(),
        now: Date.now(),
        prefs: {
          showElapsed: this._settings.get_boolean('show-elapsed'),
          showLastLine: this._settings.get_boolean('show-last-line'),
        },
        clock24: this._clock24(),
        _,
      })
      this._view = view
      this._renderPanel(view.panel)
      const key = structureKey(view)
      if (force || key !== this._structure) this._rebuildMenu(view.items)
      else this._relabel(view.items)
      this._structure = key
      this._syncTicker()
    }

    _renderPanel(panel) {
      this._icon.icon_name = panel.icon
      for (const c of ['gnomeola-offline', 'gnomeola-recording', 'gnomeola-paused', 'gnomeola-idle'])
        this.remove_style_class_name(c)
      this.add_style_class_name(panel.styleClass)
      this._label.text = panel.label
      this._label.visible = panel.label !== ''
      this.accessible_name = panel.accessibleName
    }

    _rebuildMenu(items) {
      this.menu.removeAll()
      this._rows.clear()
      for (const item of items) {
        let row
        switch (item.kind) {
          case 'separator':
            row = new PopupMenu.PopupSeparatorMenuItem()
            break
          case 'header':
            row = new PopupMenu.PopupMenuItem(item.text, { reactive: false, can_focus: false })
            row.add_style_class_name('gnomeola-header')
            break
          case 'status':
            row = new PopupMenu.PopupMenuItem(item.text, { reactive: false, can_focus: false })
            row.label.clutter_text.line_wrap = true
            row.add_style_class_name('gnomeola-status')
            break
          case 'meeting':
            row = this._meetingRow(item)
            break
          default:
            row = new PopupMenu.PopupMenuItem(item.text)
        }
        if (item.action) row.connect('activate', () => this._run(item.action))
        row.accessible_name = item.accessibleName ?? item.text ?? ''
        row._gnomeolaKey = item.key
        this.menu.addMenuItem(row)
        this._rows.set(item.key, row)
      }
    }

    _meetingRow(item) {
      const row = new PopupMenu.PopupBaseMenuItem({ style_class: 'gnomeola-meeting' })
      const text = new St.BoxLayout({ vertical: true, x_expand: true })
      row._title = new St.Label({ text: item.text, style_class: 'gnomeola-meeting-title' })
      text.add_child(row._title)
      if (item.detail)
        text.add_child(new St.Label({ text: item.detail, style_class: 'gnomeola-meeting-detail' }))
      row.add_child(text)
      if (item.verb) {
        const verb = new St.Label({
          text: item.verb,
          style_class: 'gnomeola-meeting-verb',
          y_align: Clutter.ActorAlign.CENTER,
        })
        row.add_child(verb)
      }
      if (item.inProgress) row.add_style_class_name('gnomeola-meeting-now')
      row.label_actor = row._title
      return row
    }

    _relabel(items) {
      for (const item of items) {
        const row = this._rows.get(item.key)
        if (!row || item.text === undefined) continue
        if (row.label) row.label.text = item.text
        else if (row._title) row._title.text = item.text
        row.accessible_name = item.accessibleName ?? item.text
      }
    }

    /** The elapsed time ticks once a second, and only while something is recording. */
    _syncTicker() {
      const recording = this._daemonPresent() && this._props().State === 'recording'
      if (recording && !this._tickId) {
        this._tickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
          this._refresh()
          return GLib.SOURCE_CONTINUE
        })
      } else if (!recording && this._tickId) {
        GLib.source_remove(this._tickId)
        this._tickId = 0
      }
    }

    /** For tests and debugging: the view currently rendered. */
    get view() {
      return this._view
    }

    destroy() {
      if (this._tickId) GLib.source_remove(this._tickId)
      this._tickId = 0
      this._cancellable.cancel()
      if (this._proxy) for (const id of this._proxyIds) this._proxy.disconnect(id)
      this._proxy = null
      for (const id of this._settingsIds) this._settings.disconnect(id)
      this._interface.disconnect(this._clockId)
      this.menu.disconnect(this._menuOpenId)
      this._source?.destroy()
      this._source = null
      this._rows.clear()
      this._settings = null
      this._interface = null
      super.destroy()
    }
  },
)

function errorText(e) {
  if (e instanceof GLib.Error) {
    Gio.DBusError.strip_remote_error(e)
    return e.message
  }
  return e?.message ?? String(e)
}

export default class GnomeolaExtension extends Extension {
  enable() {
    this._indicator = new Indicator(this)
    Main.panel.addToStatusArea(this.uuid, this._indicator)
  }

  disable() {
    this._indicator?.destroy()
    this._indicator = null
  }
}
