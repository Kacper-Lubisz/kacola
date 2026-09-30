// Test helper: change a calendar in the ISOLATED EDS the harness started, through ECal like a real client
// (GNOME Calendar, Evolution, a sync backend) would — so the change reaches cal-agent the way real ones do.
//
//   gjs -m eds-ctl.js create <sourceUid>   (iCalendar VEVENT on stdin)
//   gjs -m eds-ctl.js modify <sourceUid>   (iCalendar VEVENT on stdin; matched by UID)
//   gjs -m eds-ctl.js remove <sourceUid> <uid>
//   gjs -m eds-ctl.js enable <sourceUid> true|false
//   gjs -m eds-ctl.js get <sourceUid> <uid>   (prints JSON: every VEVENT of the UID with its properties)
//
// Only ever run with the harness's environment (its private session bus); the harness enforces that.

import ECal from 'gi://ECal?version=2.0'
import EDataServer from 'gi://EDataServer?version=1.2'
import Gio from 'gi://Gio'
import GioUnix from 'gi://GioUnix'
import GLib from 'gi://GLib'
import ICalGLib from 'gi://ICalGLib?version=3.0'
import System from 'system'

const [op, sourceUid, arg] = ARGV
const registry = EDataServer.SourceRegistry.new_sync(null)
let client = null
let code = 0

function readStdin() {
  const s = new Gio.DataInputStream({ base_stream: new GioUnix.InputStream({ fd: 0, close_fd: false }) })
  const chunks = []
  for (let b = s.read_bytes(65536, null); b.get_size() > 0; b = s.read_bytes(65536, null))
    chunks.push(...b.toArray())
  return new TextDecoder().decode(new Uint8Array(chunks))
}

let output = null

function describe(comp) {
  const rid = comp.get_first_property(ICalGLib.PropertyKind.RECURRENCEID_PROPERTY)
  const org = comp.get_first_property(ICalGLib.PropertyKind.ORGANIZER_PROPERTY)
  let descriptions = 0
  for (
    let p = comp.get_first_property(ICalGLib.PropertyKind.DESCRIPTION_PROPERTY);
    p;
    p = comp.get_next_property(ICalGLib.PropertyKind.DESCRIPTION_PROPERTY)
  )
    descriptions++
  return {
    recurrenceId: rid ? rid.get_value_as_string() : null,
    summary: comp.get_summary() ?? '',
    description: comp.get_description() ?? '',
    descriptions,
    location: comp.get_location() ?? '',
    organizer: org ? org.get_organizer() : null,
    ical: comp.as_ical_string(),
  }
}

function apply(client) {
  if (op === 'get') {
    // every component of the UID: a series' master AND its detached instances
    const [, list] = client.get_objects_for_uid_sync(arg, null)
    const comps = (list ?? []).map((c) => describe(c.get_icalcomponent()))
    output = JSON.stringify(comps)
    return
  }
  if (op === 'remove') {
    client.remove_object_sync(arg, null, ECal.ObjModType.ALL, ECal.OperationFlags.NONE, null)
    return
  }
  const comp = ICalGLib.Component.new_from_string(readStdin())
  if (!comp) throw new Error('stdin is not an iCalendar component')
  if (op === 'create') client.create_object_sync(comp, ECal.OperationFlags.NONE, null)
  else if (op === 'modify')
    client.modify_object_sync(comp, ECal.ObjModType.ALL, ECal.OperationFlags.NONE, null)
  else throw new Error(`unknown op ${op}`)
}

const loop = new GLib.MainLoop(null, false)
const fail = (e) => {
  printerr(`eds-ctl ${op}: ${e.message}`)
  code = 1
  loop.quit()
}
try {
  const source = registry.ref_source(sourceUid)
  if (!source) throw new Error(`no source ${sourceUid}`)
  if (op === 'enable') {
    source.set_enabled(arg === 'true')
    source.write_sync(null)
    loop.quit()
  } else {
    // asynchronous with the loop running: connect_sync outside a running loop can deadlock (see cal-agent)
    ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 0, null, (_o, res) => {
      try {
        client = ECal.Client.connect_finish(res)
        apply(client)
        loop.quit()
      } catch (e) {
        fail(e)
      }
    })
  }
} catch (e) {
  fail(e)
}
if (code === 0 && op !== 'enable') loop.run()
if (code === 0) print(output ?? 'ok')
// dispose the registry by hand: GJS finalising an ESourceRegistry during teardown crashes
registry.run_dispose()
System.exit(code)
