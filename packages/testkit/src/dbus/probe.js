// A D-Bus test client (V-4a), run by probe.ts as `gjs -m probe.js NAME PATH INTERFACE` with
// DBUS_SESSION_BUS_ADDRESS pointing at a private bus. It watches the service through a Gio.DBusProxy —
// the same machinery (and the same property cache semantics) the Shell extension uses — and speaks
// JSON lines:
//
//   out  {"type":"owner","owner":":1.4"|null}                 name owner (dis)appeared
//        {"type":"props","props":{…}}                          the proxy's full property cache
//        {"type":"changed","changed":{…},"invalidated":[…]}    PropertiesChanged, as the proxy saw it
//        {"type":"signal","name":…,"args":[…]}                 an interface signal
//        {"type":"reply","id":N,"result":[…]} | {"type":"reply","id":N,"error":{"name","message"}}
//        {"type":"xml","id":N,"xml":…}
//   in   {"type":"call","id":N,"method":…,"signature":"(s)","args":[…]}
//        {"type":"introspect","id":N}
//        {"type":"props"}                                      dump the cache now
import Gio from 'gi://Gio'
import GioUnix from 'gi://GioUnix'
import GLib from 'gi://GLib'

const [name, path, iface] = ARGV
const out = new Gio.DataOutputStream({ base_stream: new GioUnix.OutputStream({ fd: 1, close_fd: false }) })
const send = (m) => {
  out.put_string(`${JSON.stringify(m)}\n`, null)
  out.flush(null)
}
const unpack = (v) => (v === null ? null : v.recursiveUnpack())
const bigsafe = (x) => JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)))

const proxy = Gio.DBusProxy.new_for_bus_sync(
  Gio.BusType.SESSION,
  Gio.DBusProxyFlags.NONE,
  null,
  name,
  path,
  iface,
  null,
)
const cache = () =>
  Object.fromEntries(
    (proxy.get_cached_property_names() ?? []).map((n) => [n, unpack(proxy.get_cached_property(n))]),
  )

proxy.connect('notify::g-name-owner', () => {
  send({ type: 'owner', owner: proxy.g_name_owner })
  send({ type: 'props', props: bigsafe(cache()) })
})
proxy.connect('g-properties-changed', (_p, changed, invalidated) => {
  send({ type: 'changed', changed: bigsafe(unpack(changed)), invalidated })
})
proxy.connect('g-signal', (_p, _sender, signal, params) => {
  send({ type: 'signal', name: signal, args: bigsafe(unpack(params)) })
})

send({ type: 'owner', owner: proxy.g_name_owner })
send({ type: 'props', props: bigsafe(cache()) })

const stdin = new Gio.DataInputStream({ base_stream: new GioUnix.InputStream({ fd: 0, close_fd: false }) })
const loop = new GLib.MainLoop(null, false)
function readNext() {
  stdin.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, res) => {
    const [line] = s.read_line_finish_utf8(res)
    if (line === null) return loop.quit()
    const m = JSON.parse(line)
    if (m.type === 'props') send({ type: 'props', props: bigsafe(cache()) })
    else if (m.type === 'call') {
      const params = m.signature ? new GLib.Variant(m.signature, m.args) : null
      proxy.call(m.method, params, Gio.DBusCallFlags.NONE, 10_000, null, (p, r) => {
        try {
          send({ type: 'reply', id: m.id, result: bigsafe(unpack(p.call_finish(r))) })
        } catch (e) {
          const remote = Gio.DBusError.get_remote_error(e) ?? 'unknown'
          Gio.DBusError.strip_remote_error(e)
          send({ type: 'reply', id: m.id, error: { name: remote, message: e.message } })
        }
      })
    } else if (m.type === 'introspect') {
      proxy
        .get_connection()
        .call(
          name,
          path,
          'org.freedesktop.DBus.Introspectable',
          'Introspect',
          null,
          null,
          0,
          5000,
          null,
          (c, r) => {
            send({ type: 'xml', id: m.id, xml: c.call_finish(r).deepUnpack()[0] })
          },
        )
    }
    readNext()
  })
}
readNext()
loop.run()
