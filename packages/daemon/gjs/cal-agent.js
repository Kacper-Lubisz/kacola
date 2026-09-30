// cal-agent — C-2. Reads the user's calendars from Evolution Data Server and reports every occurrence in
// a time window to gnomeolad as JSON lines. Run as `gjs -m cal-agent.js`; the protocol (both directions)
// is specified, with its zod schema, in packages/daemon/src/calendar/agent-protocol.ts.
//
// What only EDS can do happens here: listing the enabled calendars (whatever GNOME Online Accounts and
// GNOME Calendar show), expanding recurrences with detached exceptions and EXDATEs in each event's own
// time zone, and deciding which attendee is the user. Everything else — join links, filtering, "next
// meeting" — is the daemon's job, in unit-tested TypeScript.
//
// Robustness rules: a calendar that fails to open or read is logged and skipped (never fatal); losing the
// source registry is fatal (error + exit 1, the daemon restarts us); stdin EOF means the daemon is gone,
// so we exit 0. Before exiting we dispose the registry and clients by hand: letting GJS finalise an
// ESourceRegistry during context teardown crashes (it iterates the main context from inside the GC).

import ECal from 'gi://ECal?version=2.0'
import EDataServer from 'gi://EDataServer?version=1.2'
import Gio from 'gi://Gio'
import GioUnix from 'gi://GioUnix'
import GLib from 'gi://GLib'
import ICalGLib from 'gi://ICalGLib?version=3.0'
import System from 'system'

const PROTOCOL = 1
const DEBOUNCE_MS = 300
// 0 = do not wait for a remote backend to come online: its offline cache is what we want.
/** How long EDS may wait for a backend to come online before handing back the client with its offline
 *  cache. NOT 0: seen on a real machine (2026-09-30), 0 made Google calendars (GNOME Online Accounts) wait
 *  for a connection that never came, so every one of them hit the timeout and vanished; with a few
 *  seconds they arrive with their cached events and update when the backend connects. */
const CONNECT_WAIT_S = 5
/** Online calendars (Google, Microsoft, CalDAV via GNOME Online Accounts) can take well over 10 s to
 *  connect after login or a restart; give up on one attempt only after this long… */
const CONNECT_TIMEOUT_S = 90
/** …but never hold a snapshot back for a slow calendar longer than this: the others are shown and the
 *  slow one joins a later snapshot when it connects. */
const SNAPSHOT_WAIT_S = 10
/** A calendar that failed to connect is retried after 30 s, doubling to at most 10 minutes. */
const RETRY_BASE_S = 30
const RETRY_MAX_S = 600
const URL_RE = /https?:\/\//i

// ------------------------------------------------------------------------------------------ output

const stdout = new GioUnix.OutputStream({ fd: 1, close_fd: false })
const encoder = new TextEncoder()
function send(msg) {
  try {
    stdout.write_all(encoder.encode(`${JSON.stringify(msg)}\n`), null)
    stdout.flush(null)
  } catch (_e) {
    // the daemon closed our stdout: it is gone, and stdin EOF will end us
  }
}
const log = (level, message) => send({ type: 'log', level, message })
const errText = (e) => (e instanceof Error ? e.message : String(e))

// ------------------------------------------------------------------------------------------ state

const loop = new GLib.MainLoop(null, false)
let registry = null
/** source uid → { source, client, view, name } */
const clients = new Map()
let window = null
let debounceId = 0
let exiting = false

function shutdown(code) {
  if (exiting) return
  exiting = true
  if (debounceId) GLib.source_remove(debounceId)
  for (const c of clients.values()) closeClient(c)
  clients.clear()
  if (registry) {
    registry.run_dispose()
    registry = null
  }
  loop.quit()
  if (code !== 0) System.exit(code)
}

function fatal(message) {
  send({ type: 'error', message, fatal: true })
  shutdown(1)
}

// ------------------------------------------------------------------------------------------ time

const utc = ICalGLib.Timezone.get_utc_timezone()
/**
 * The zone floating times and DATE values are read in: the process's local zone. GLib honours TZ (and
 * falls back to /etc/localtime); ECal's own util_get_system_timezone reads only /etc/localtime.
 */
const localZone = (() => {
  const id = GLib.TimeZone.new_local().get_identifier()
  const named = id && id !== 'UTC' ? ICalGLib.Timezone.get_builtin_timezone(id.replace(/^:/, '')) : null
  if (named) return named
  if (id === 'UTC') return utc
  try {
    return ECal.util_get_system_timezone() ?? utc
  } catch (_e) {
    return utc
  }
})()

const pad = (n, w = 2) => String(n).padStart(w, '0')
const dateOf = (t) => `${pad(t.get_year(), 4)}-${pad(t.get_month())}-${pad(t.get_day())}`
const isoOf = (unix) => new Date(unix * 1000).toISOString()

/** Absolute unix seconds of an ICalTime, in its own zone (floating → local). */
function unixOf(t) {
  const zone = t.is_utc() ? utc : (t.get_timezone() ?? localZone)
  return t.as_timet_with_zone(zone)
}

/** `Europe/Warsaw` from libical's builtin `/freeassociation.sourceforge.net/Europe/Warsaw`. */
function tzName(t) {
  if (t.is_date() || t.is_utc()) return null
  const z = t.get_timezone()
  if (!z) return null
  const id = z.get_location() || z.get_tzid() || ''
  if (!id || id === 'UTC') return null
  return id.replace(/^\/freeassociation\.sourceforge\.net\/(?:Tzfile\/)?/, '')
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

// ------------------------------------------------------------------------------------------ "me"

function myAddresses(client) {
  const out = new Set()
  if (registry) {
    for (const s of registry.list_sources(EDataServer.SOURCE_EXTENSION_MAIL_IDENTITY)) {
      const a = s.get_extension(EDataServer.SOURCE_EXTENSION_MAIL_IDENTITY).get_address()
      if (a) out.add(a.trim().toLowerCase())
    }
  }
  try {
    const [ok, v] = client.get_backend_property_sync(
      ECal.BACKEND_PROPERTY_CAL_EMAIL_ADDRESS ?? 'cal-email-address',
      null,
    )
    if (ok && v) for (const a of v.split(',')) if (a.trim()) out.add(a.trim().toLowerCase())
  } catch (_e) {
    // not every backend has one
  }
  return out
}

const stripMailto = (v) => (v ?? '').replace(/^mailto:/i, '').trim()

// ------------------------------------------------------------------------------------------ components

function* props(comp, kind) {
  for (let p = comp.get_first_property(kind); p; p = comp.get_next_property(kind)) yield p
}

function propValue(comp, kind) {
  const p = comp.get_first_property(kind)
  return p ? (p.get_value_as_string() ?? '') : ''
}

function paramValue(prop, kind) {
  const p = prop.get_first_parameter(kind)
  if (!p) return null
  const s = p.as_ical_string() ?? ''
  const i = s.indexOf('=')
  return i === -1
    ? null
    : s
        .slice(i + 1)
        .replace(/^"|"$/g, '')
        .toUpperCase()
}

function attendeeInfo(comp, mine) {
  let count = 0
  let myPartstat = null
  for (const p of props(comp, ICalGLib.PropertyKind.ATTENDEE_PROPERTY)) {
    count++
    const addr = stripMailto(p.get_attendee()).toLowerCase()
    if (myPartstat === null && mine.has(addr))
      myPartstat = paramValue(p, ICalGLib.ParameterKind.PARTSTAT_PARAMETER) ?? 'NEEDS-ACTION'
  }
  return { count, myPartstat }
}

function xprops(comp) {
  const out = {}
  for (const p of props(comp, ICalGLib.PropertyKind.X_PROPERTY)) {
    const name = (p.get_x_name() ?? '').toUpperCase()
    const value = p.get_value_as_string() ?? ''
    if (name && URL_RE.test(value) && !(name in out)) out[name] = value.trim()
  }
  return out
}

function isRecurring(comp) {
  return (
    Boolean(comp.get_first_property(ICalGLib.PropertyKind.RRULE_PROPERTY)) ||
    Boolean(comp.get_first_property(ICalGLib.PropertyKind.RDATE_PROPERTY))
  )
}

function recurrenceIdOf(comp) {
  const p = comp.get_first_property(ICalGLib.PropertyKind.RECURRENCEID_PROPERTY)
  if (!p) return null
  const t = p.get_recurrenceid()
  if (!t || t.is_null_time()) return null
  // a RECURRENCE-ID carries the TZID of the series' DTSTART as a parameter
  const tzid = p.get_first_parameter(ICalGLib.ParameterKind.TZID_PARAMETER)?.get_tzid()
  if (tzid && !t.get_timezone()) {
    const z =
      ICalGLib.Timezone.get_builtin_timezone(tzid) ?? ICalGLib.Timezone.get_builtin_timezone_from_tzid(tzid)
    if (z) t.set_timezone(z)
  }
  return isoOf(t.is_date() ? t.as_timet_with_zone(localZone) : unixOf(t))
}

/** One occurrence (comp is the instance: EDS has already applied the detached override, if any). */
function occurrence(c, comp, st, en, mine, seriesRecurring) {
  const allDay = st.is_date()
  let startDate = null
  let endDate = null
  let start
  let end
  if (allDay) {
    startDate = dateOf(st)
    endDate = en && !en.is_null_time() && en.is_date() ? dateOf(en) : addDays(startDate, 1)
    if (endDate <= startDate) endDate = addDays(startDate, 1)
    start = isoOf(st.as_timet_with_zone(localZone))
    end = isoOf(ICalGLib.Time.new_from_string(endDate.replaceAll('-', '')).as_timet_with_zone(localZone))
  } else {
    const s = unixOf(st)
    const e = en && !en.is_null_time() ? unixOf(en) : s
    start = isoOf(s)
    end = isoOf(Math.max(s, e))
  }
  const { count, myPartstat } = attendeeInfo(comp, mine)
  const ownRid = recurrenceIdOf(comp)
  const recurring = seriesRecurring || ownRid !== null
  const organizerProp = comp.get_first_property(ICalGLib.PropertyKind.ORGANIZER_PROPERTY)
  return {
    sourceUid: c.source.get_uid(),
    calendarName: c.name,
    uid: comp.get_uid() ?? '',
    recurrenceId: recurring ? (ownRid ?? start) : null,
    summary: comp.get_summary() ?? '',
    description: comp.get_description() ?? '',
    location: comp.get_location() ?? '',
    url: propValue(comp, ICalGLib.PropertyKind.URL_PROPERTY),
    start,
    end,
    allDay,
    startDate,
    endDate,
    timezone: tzName(st),
    status: propValue(comp, ICalGLib.PropertyKind.STATUS_PROPERTY).toUpperCase(),
    myPartstat,
    organizer: organizerProp ? stripMailto(organizerProp.get_organizer()) || null : null,
    attendees: count,
    recurring,
    xprops: xprops(comp),
  }
}

function occurrencesOf(c, fromS, toS) {
  const out = []
  const mine = myAddresses(c.client)
  const [, objects] = c.client.get_object_list_sync('#t', null)
  // One expansion per series: the master (or a lone detached instance whose master we do not have).
  // generate_instances_for_object_sync applies the series' detached instances and EXDATEs itself.
  const masters = new Map()
  const detached = new Map()
  for (const o of objects ?? []) {
    const uid = o.get_uid()
    if (!uid) continue
    if (recurrenceIdOf(o) === null) masters.set(uid, o)
    else detached.set(uid, [...(detached.get(uid) ?? []), o])
  }
  const roots = [...masters.values()]
  for (const [uid, list] of detached) if (!masters.has(uid)) roots.push(...list)
  for (const comp of roots) {
    const seriesRecurring = isRecurring(comp)
    try {
      c.client.generate_instances_for_object_sync(comp, fromS, toS, null, (inst, st, en) => {
        out.push(occurrence(c, inst, st, en, mine, seriesRecurring))
        return true
      })
    } catch (e) {
      log('warn', `${c.name}: could not expand ${comp.get_uid()}: ${errText(e)}`)
    }
  }
  return out
}

// ------------------------------------------------------------------------------------------ snapshot

function snapshot() {
  debounceId = 0
  if (!window || exiting) return GLib.SOURCE_REMOVE
  // Calendars still connecting would be missing from the snapshot, making their meetings flicker out and
  // back; their connect callback schedules another snapshot (and gives up after CONNECT_TIMEOUT_S).
  const now = GLib.get_monotonic_time()
  for (const c of connecting.values())
    if (now - c.since < SNAPSHOT_WAIT_S * 1_000_000) return GLib.SOURCE_REMOVE
  const fromS = Math.floor(Date.parse(window.from) / 1000)
  const toS = Math.ceil(Date.parse(window.to) / 1000)
  const occurrences = []
  const calendars = []
  for (const c of clients.values()) {
    try {
      const list = occurrencesOf(c, fromS, toS)
      calendars.push({ id: c.source.get_uid(), name: c.name })
      // keep only what overlaps the window (expansion may hand back edges)
      for (const o of list) {
        const s = Date.parse(o.start)
        const e = Math.max(Date.parse(o.end), s + 1)
        if (e > fromS * 1000 && s < toS * 1000) occurrences.push(o)
      }
    } catch (e) {
      log('warn', `${c.name}: read failed, skipped: ${errText(e)}`)
    }
  }
  occurrences.sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid))
  send({ type: 'snapshot', from: window.from, to: window.to, calendars, occurrences })
  return GLib.SOURCE_REMOVE
}

function schedule() {
  if (exiting || !window) return
  if (debounceId) GLib.source_remove(debounceId)
  debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, snapshot)
}

// ------------------------------------------------------------------------------------------ sources

const wanted = (s) => s.has_extension(EDataServer.SOURCE_EXTENSION_CALENDAR) && registry.check_enabled(s)

function closeClient(c) {
  try {
    c.view?.stop()
  } catch (_e) {}
}

/** Sources being connected: uid → { cancellable, since (monotonic µs) }. A snapshot waits for them, but
 *  only up to SNAPSHOT_WAIT_S (see snapshot()). */
const connecting = new Map()
/** Consecutive failed connects per source, for the retry backoff. */
const failures = new Map()

function retryLater(uid, name) {
  const n = (failures.get(uid) ?? 0) + 1
  failures.set(uid, n)
  const delay = Math.min(RETRY_BASE_S * 2 ** (n - 1), RETRY_MAX_S)
  log('warn', `calendar "${name}" (${uid}): retrying in ${delay} s (attempt ${n + 1})`)
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delay, () => {
    if (!exiting && !clients.has(uid) && !connecting.has(uid)) reconcile()
    return GLib.SOURCE_REMOVE
  })
}

function openClient(source) {
  const uid = source.get_uid()
  const name = source.get_display_name() || uid
  const cancellable = new Gio.Cancellable()
  const entry = { cancellable, since: GLib.get_monotonic_time() }
  connecting.set(uid, entry)
  // re-run a held-back snapshot once this calendar has had its SNAPSHOT_WAIT_S
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, SNAPSHOT_WAIT_S, () => {
    if (connecting.get(uid) === entry) schedule()
    return GLib.SOURCE_REMOVE
  })
  // A backend that never answers must not hold every other calendar hostage.
  const timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, CONNECT_TIMEOUT_S, () => {
    cancellable.cancel()
    return GLib.SOURCE_REMOVE
  })
  // Asynchronous, with the main loop running: connect_sync from the top level was seen to deadlock.
  ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, CONNECT_WAIT_S, cancellable, (_o, res) => {
    GLib.source_remove(timeoutId)
    if (connecting.get(uid) === entry) connecting.delete(uid)
    let client
    try {
      client = ECal.Client.connect_finish(res)
    } catch (e) {
      if (!exiting) {
        log('warn', `calendar "${name}" (${uid}) could not be opened: ${errText(e)}`)
        retryLater(uid, name)
      }
      schedule()
      return
    }
    if (exiting || cancellable.is_cancelled()) return
    failures.delete(uid)
    client.set_default_timezone(localZone)
    const c = { source, client, view: null, name }
    clients.set(uid, c)
    client.get_view('#t', null, (_c, vres) => {
      try {
        const [, view] = client.get_view_finish(vres)
        if (exiting || clients.get(uid) !== c) return
        for (const sig of ['objects-added', 'objects-modified', 'objects-removed'])
          view.connect(sig, () => schedule())
        view.start()
        c.view = view
      } catch (e) {
        log('warn', `calendar "${name}": cannot watch for changes: ${errText(e)}`)
      }
    })
    schedule()
  })
}

function reconcile() {
  if (exiting) return
  const current = new Map()
  for (const s of registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR))
    if (wanted(s)) current.set(s.get_uid(), s)
  for (const [uid, c] of clients) {
    if (!current.has(uid)) {
      closeClient(c)
      clients.delete(uid)
    } else c.name = current.get(uid).get_display_name() || uid
  }
  for (const [uid, c] of connecting) {
    if (!current.has(uid)) {
      c.cancellable.cancel()
      connecting.delete(uid)
    }
  }
  for (const [uid, s] of current) if (!clients.has(uid) && !connecting.has(uid)) openClient(s)
  schedule()
}

// ------------------------------------------------------------------------------------------ stdin

function handle(line) {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch (_e) {
    log('warn', `ignored a line that is not JSON: ${line.slice(0, 80)}`)
    return
  }
  if (msg.type === 'window') {
    if (Number.isNaN(Date.parse(msg.from)) || Number.isNaN(Date.parse(msg.to))) {
      send({ type: 'error', message: `bad window ${line}`, fatal: false })
      return
    }
    window = { from: msg.from, to: msg.to }
    if (debounceId) GLib.source_remove(debounceId)
    debounceId = 0
    snapshot()
  } else if (msg.type === 'refresh') {
    reconcile()
  } else log('warn', `unknown message type ${msg.type}`)
}

const stdin = new Gio.DataInputStream({ base_stream: new GioUnix.InputStream({ fd: 0, close_fd: false }) })
function readNext() {
  stdin.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, res) => {
    let line
    try {
      ;[line] = s.read_line_finish_utf8(res)
    } catch (e) {
      log('warn', `stdin: ${errText(e)}`)
      line = null
    }
    if (line === null) {
      shutdown(0)
      return
    }
    handle(line)
    if (!exiting) readNext()
  })
}

// ------------------------------------------------------------------------------------------ main

send({ type: 'hello', protocol: PROTOCOL, gjs: String(System.version) })
try {
  registry = EDataServer.SourceRegistry.new_sync(null)
} catch (e) {
  fatal(`cannot reach the Evolution source registry: ${errText(e)}`)
}
if (registry) {
  for (const sig of ['source-added', 'source-removed', 'source-enabled', 'source-disabled', 'source-changed'])
    registry.connect(sig, () => {
      if (exiting) return
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        reconcile()
        return GLib.SOURCE_REMOVE
      })
    })
  reconcile()
  readNext()
  loop.run()
}
