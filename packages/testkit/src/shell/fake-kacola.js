// A scriptable stand-in for kacolad's D-Bus bridge, for testing the Shell extension against every state
// it must render without a daemon behind it. Run: `gjs -m fake-kacola.js <interface.xml>`.
//
// It speaks the SAME line protocol as the real bridge (packages/daemon/src/dbus/bridge-protocol.ts), so
// the Node side (./fake-bus.ts) plays the daemon: it sets properties, emits signals, and answers the
// method calls this script forwards. Owns com.kacperlubisz.Kacola on whatever session bus
// DBUS_SESSION_BUS_ADDRESS names — the tests only ever point that at a throwaway bus.

import Gio from 'gi://Gio'
import GLib from 'gi://GLib'
import System from 'system'

const BUS_NAME = 'com.kacperlubisz.Kacola'
const OBJECT_PATH = '/com/kacperlubisz/Kacola'
const IFACE = 'com.kacperlubisz.Kacola'

const [xmlPath] = ARGV
const [, bytes] = GLib.file_get_contents(xmlPath)
const info = Gio.DBusNodeInfo.new_for_xml(new TextDecoder().decode(bytes)).lookup_interface(IFACE)

const stdout = new Gio.DataOutputStream({ base_stream: new Gio.UnixOutputStream({ fd: 1, close_fd: false }) })
const send = (msg) => stdout.put_string(`${JSON.stringify(msg)}\n`, null)

// ---- JSON → GVariant, driven by the signatures in the interface XML

function dictVariant(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (typeof v === 'string') out[k] = new GLib.Variant('s', v)
    else if (typeof v === 'boolean') out[k] = new GLib.Variant('b', v)
    else if (Number.isInteger(v)) out[k] = new GLib.Variant('x', v)
    else if (typeof v === 'number') out[k] = new GLib.Variant('d', v)
  }
  return out
}

function toVariant(sig, value) {
  switch (sig) {
    case 'a{sv}':
      return new GLib.Variant(sig, dictVariant(value))
    case 'aa{sv}':
      return new GLib.Variant(sig, (value ?? []).map(dictVariant))
    default:
      return new GLib.Variant(sig, value)
  }
}

const propSig = new Map(info.properties.map((p) => [p.name, p.signature]))
const DEFAULTS = {
  s: '',
  t: 0,
  x: 0,
  as: [],
  'a{sv}': {},
  'aa{sv}': [],
}
const values = new Map()
for (const [name, sig] of propSig) values.set(name, toVariant(sig, DEFAULTS[sig]))
values.set('State', new GLib.Variant('s', 'idle'))
values.set('CalendarState', new GLib.Variant('s', 'ok'))

let connection = null
let nextId = 1
const pending = new Map()

function emitChanged(changed) {
  if (!connection || !Object.keys(changed).length) return
  connection.emit_signal(
    null,
    OBJECT_PATH,
    'org.freedesktop.DBus.Properties',
    'PropertiesChanged',
    new GLib.Variant('(sa{sv}as)', [IFACE, changed, []]),
  )
}

function handle(msg) {
  switch (msg.type) {
    case 'props': {
      const changed = {}
      for (const [name, value] of Object.entries(msg.props)) {
        const sig = propSig.get(name)
        if (!sig) continue
        const v = toVariant(sig, value)
        if (values.get(name)?.equal(v)) continue
        values.set(name, v)
        changed[name] = v
      }
      emitChanged(changed)
      return
    }
    case 'signal': {
      const sinfo = info.signals.find((s) => s.name === msg.name)
      const args = sinfo.args.map((a, i) => toVariant(a.signature, msg.args[i]))
      const tuple = GLib.Variant.new_tuple(args)
      connection?.emit_signal(null, OBJECT_PATH, IFACE, msg.name, tuple)
      return
    }
    case 'reply': {
      const inv = pending.get(msg.id)
      if (!inv) return
      pending.delete(msg.id)
      if (msg.error) {
        inv.return_dbus_error(msg.error.name, msg.error.message)
        return
      }
      const minfo = info.methods.find((m) => m.name === inv.get_method_name())
      const outs = minfo.out_args.map((a, i) => toVariant(a.signature, msg.result[i]))
      inv.return_value(outs.length ? GLib.Variant.new_tuple(outs) : null)
    }
  }
}

Gio.bus_own_name(
  Gio.BusType.SESSION,
  BUS_NAME,
  Gio.BusNameOwnerFlags.NONE,
  (conn) => {
    connection = conn
    conn.register_object(
      OBJECT_PATH,
      info,
      (_c, _sender, _path, _iface, method, params, invocation) => {
        const id = nextId++
        pending.set(id, invocation)
        send({ type: 'call', id, method, args: params.recursiveUnpack() })
      },
      (_c, _sender, _path, _iface, name) => values.get(name) ?? null,
      null,
    )
  },
  () => send({ type: 'acquired', name: BUS_NAME }),
  () => {
    send({ type: 'lost', name: BUS_NAME })
    loop.quit()
  },
)

const stdin = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({ fd: 0, close_fd: false }) })
function readLine() {
  stdin.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, res) => {
    const [line] = s.read_line_finish_utf8(res)
    if (line === null) {
      loop.quit()
      return
    }
    try {
      if (line.trim()) handle(JSON.parse(line))
    } catch (e) {
      send({ type: 'log', level: 'warn', message: `bad line: ${e.message}` })
    }
    readLine()
  })
}
readLine()

const loop = new GLib.MainLoop(null, false)
loop.run()
System.exit(0)
