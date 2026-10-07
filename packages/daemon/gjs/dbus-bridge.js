// kacolad's D-Bus bridge (C-4). Run as `gjs -m dbus-bridge.js [path/to/com.kacperlubisz.Kacola.xml]` by the
// daemon, which supervises it. Owns `com.kacperlubisz.Kacola` on the session bus, exports the interface from
// the XML contract at /com/kacperlubisz/Kacola, and relays: property values and signals come in on stdin as
// JSON lines, method calls go out on stdout and wait for the daemon's reply. The line protocol is
// documented in packages/daemon/src/dbus/bridge-protocol.ts. Exits when stdin closes (the daemon died
// or is stopping).
import Gio from 'gi://Gio'
import GioUnix from 'gi://GioUnix'
import GLib from 'gi://GLib'
import System from 'system'

const BUS_NAME = 'com.kacperlubisz.Kacola'
const OBJECT_PATH = '/com/kacperlubisz/Kacola'
const INTERFACE = 'com.kacperlubisz.Kacola'

const here = GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0])
const xmlPath = ARGV[0] ?? GLib.build_filenamev([here, '..', 'dbus', 'com.kacperlubisz.Kacola.xml'])
const XML = new TextDecoder().decode(GLib.file_get_contents(xmlPath)[1])
const iface = Gio.DBusNodeInfo.new_for_xml(XML).lookup_interface(INTERFACE)

const stdout = new Gio.DataOutputStream({ base_stream: new GioUnix.OutputStream({ fd: 1, close_fd: false }) })
function send(msg) {
  stdout.put_string(`${JSON.stringify(msg)}\n`, null)
  stdout.flush(null)
}
const log = (level, message) => send({ type: 'log', level, message })

// ---------------------------------------------------------------------------- JSON → GVariant

function leaf(v) {
  if (typeof v === 'boolean') return new GLib.Variant('b', v)
  if (typeof v === 'number') return Number.isInteger(v) ? new GLib.Variant('x', v) : new GLib.Variant('d', v)
  return new GLib.Variant('s', v == null ? '' : String(v))
}
const dict = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, leaf(v)]))

function toVariant(sig, v) {
  switch (sig) {
    case 's':
      return new GLib.Variant('s', v == null ? '' : String(v))
    case 't':
      return new GLib.Variant('t', Math.max(0, Math.round(Number(v) || 0)))
    case 'x':
      return new GLib.Variant('x', Math.round(Number(v) || 0))
    case 'b':
      return new GLib.Variant('b', Boolean(v))
    case 'as':
      return new GLib.Variant('as', (v ?? []).map(String))
    case 'a{sv}':
      return new GLib.Variant('a{sv}', dict(v))
    case 'aa{sv}':
      return new GLib.Variant('aa{sv}', (v ?? []).map(dict))
    default:
      throw new Error(`unsupported signature ${sig}`)
  }
}

// ----------------------------------------------------------------------------- the object

const propSig = new Map(iface.properties.map((p) => [p.name, p.signature]))
const values = new Map([...propSig].map(([name, sig]) => [name, toVariant(sig, undefined)]))
const signalSig = new Map(iface.signals.map((s) => [s.name, s.args.map((a) => a.signature)]))
const methodOut = new Map(iface.methods.map((m) => [m.name, m.out_args.map((a) => a.signature)]))

let nextCall = 0
const pending = new Map()
const impl = {}
for (const name of propSig.keys())
  Object.defineProperty(impl, name, { get: () => values.get(name), enumerable: true })
for (const name of methodOut.keys()) {
  impl[`${name}Async`] = (params, invocation) => {
    const id = ++nextCall
    pending.set(id, { invocation, name })
    send({ type: 'call', id, method: name, args: params })
  }
}
const exported = Gio.DBusExportedObject.wrapJSObject(XML, impl)

function setProps(props) {
  for (const [name, value] of Object.entries(props ?? {})) {
    const sig = propSig.get(name)
    if (!sig) {
      log('warn', `unknown property ${name}`)
      continue
    }
    const v = toVariant(sig, value)
    if (values.get(name).equal(v)) continue
    values.set(name, v)
    exported.emit_property_changed(name, v)
  }
  exported.flush()
}

function emitSignal(name, args) {
  const sigs = signalSig.get(name)
  if (!sigs) return log('warn', `unknown signal ${name}`)
  exported.emit_signal(name, GLib.Variant.new_tuple(sigs.map((s, i) => toVariant(s, args?.[i]))))
}

function reply(msg) {
  const p = pending.get(msg.id)
  if (!p) return
  pending.delete(msg.id)
  if (msg.error) {
    p.invocation.return_dbus_error(msg.error.name, msg.error.message)
    return
  }
  const outs = methodOut.get(p.name)
  p.invocation.return_value(
    outs.length ? GLib.Variant.new_tuple(outs.map((s, i) => toVariant(s, msg.result?.[i]))) : null,
  )
}

// ----------------------------------------------------------------------------------- wiring

const loop = new GLib.MainLoop(null, false)
let exportedOn = null

const ownerId = Gio.bus_own_name(
  Gio.BusType.SESSION,
  BUS_NAME,
  Gio.BusNameOwnerFlags.NONE,
  (connection) => {
    exported.export(connection, OBJECT_PATH)
    exportedOn = connection
  },
  () => send({ type: 'acquired', name: BUS_NAME }),
  (connection) => {
    // connection === null: no session bus at all — nothing to do but tell the daemon and exit
    send({ type: 'lost', name: BUS_NAME })
    if (connection === null) {
      loop.quit()
      System.exit(3)
    }
  },
)

const stdin = new Gio.DataInputStream({ base_stream: new GioUnix.InputStream({ fd: 0, close_fd: false }) })
function readNext() {
  stdin.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, res) => {
    let line
    try {
      ;[line] = s.read_line_finish_utf8(res)
    } catch (e) {
      log('warn', `stdin: ${e.message}`)
      line = null
    }
    if (line === null) {
      loop.quit() // the daemon went away
      return
    }
    if (line.trim()) {
      try {
        const msg = JSON.parse(line)
        if (msg.type === 'props') setProps(msg.props)
        else if (msg.type === 'signal') emitSignal(msg.name, msg.args)
        else if (msg.type === 'reply') reply(msg)
        else log('warn', `unknown message type ${msg.type}`)
      } catch (e) {
        log('warn', `bad message: ${e.message}`)
      }
    }
    readNext()
  })
}
readNext()

loop.run()
for (const { invocation } of pending.values())
  invocation.return_dbus_error('com.kacperlubisz.Kacola.Error.Unavailable', 'the daemon is shutting down')
if (exportedOn) exported.unexport()
Gio.bus_unown_name(ownerId)
