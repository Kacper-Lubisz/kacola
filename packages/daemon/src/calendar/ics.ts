import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ICAL from 'ical.js'
import type { Logger } from '../logger.ts'
import type { RawOccurrence } from './agent-protocol.ts'
import type { CalendarProvider, CalendarSnapshot, ProviderListener } from './providers.ts'

// C-1: an iCalendar (.ics) provider — a local file or a subscription URL (Google's "secret address in
// iCal format", Outlook's published calendar, any webcal:// feed). It is the calendar source where there
// is no Evolution Data Server (macOS), and a simpler one where there is.
//
// ical.js parses and walks RRULEs; everything that decides an absolute instant is done here, because
// ical.js treats a TZID it has no VTIMEZONE for as floating, and hand-written and exported files very
// often carry a bare IANA TZID (`DTSTART;TZID=Europe/Warsaw:…`) with no VTIMEZONE block. So each wall-clock
// time is resolved in this order: UTC → the file's own VTIMEZONE → the IANA zone via Intl (Windows zone
// names mapped first) → floating, which is the daemon process's local time (as the EDS agent does).
// EXDATEs, UNTIL and RECURRENCE-ID overrides are matched on those absolute instants too, so a UTC EXDATE
// against a Europe/Warsaw series still lands.

/** Occurrences one event may contribute to a snapshot. */
export const MAX_OCCURRENCES_PER_EVENT = 5000
/** RRULE steps walked per event (from DTSTART, not from the window) before giving up on it. */
export const MAX_ITERATIONS_PER_EVENT = 200_000
const DEFAULT_FILE_POLL_MS = 250
const DEFAULT_URL_POLL_MS = 5 * 60_000
const FETCH_TIMEOUT_MS = 30_000
const URL_RE = /https?:\/\//i

type Component = InstanceType<typeof ICAL.Component>
type Property = InstanceType<typeof ICAL.Property>
type Time = InstanceType<typeof ICAL.Time>
type Timezone = InstanceType<typeof ICAL.Timezone>

// ------------------------------------------------------------------------------------------ parse

export type ParsedIcs = {
  calendarName: string | null
  /** The file's VTIMEZONEs, by TZID. */
  zones: Map<string, Timezone>
  events: Component[]
  /** Parse problems that cost events (the rest of the file still counts). */
  warnings: string[]
}

/**
 * Parses an iCalendar text. A syntax error anywhere makes ical.js reject the whole text, so on failure
 * each VEVENT is parsed on its own (with the file's VTIMEZONEs) and the broken ones are dropped.
 * Throws only when the text is not an iCalendar at all.
 */
export function parseIcs(text: string): ParsedIcs {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('not an iCalendar file (no BEGIN:VCALENDAR)')
  const warnings: string[] = []
  let roots: Component[]
  try {
    roots = [new ICAL.Component(ICAL.parse(text))]
  } catch (err) {
    warnings.push(`the file has a syntax error (${errText(err)}); reading its events one by one`)
    roots = parseByBlocks(text, warnings)
  }
  const cal = roots.flatMap((r) => (r.name === 'vcalendar' ? [r] : r.getAllSubcomponents('vcalendar')))
  const zones = new Map<string, Timezone>()
  const events: Component[] = []
  let calendarName: string | null = null
  for (const c of cal) {
    calendarName ??= str(c.getFirstPropertyValue('x-wr-calname')).trim() || null
    for (const vtz of c.getAllSubcomponents('vtimezone')) {
      try {
        const tz = new ICAL.Timezone(vtz)
        if (!tz.tzid) continue
        zones.set(tz.tzid, tz)
        // Registered so ical.js itself resolves the zone wherever it looks one up (e.g. Time.convertToZone).
        if (!ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz)
      } catch (err) {
        warnings.push(`a VTIMEZONE could not be read: ${errText(err)}`)
      }
    }
    events.push(...c.getAllSubcomponents('vevent'))
  }
  return { calendarName, zones, events, warnings }
}

function parseByBlocks(text: string, warnings: string[]): Component[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const blocks = (kind: string) =>
    unfolded.match(new RegExp(`^BEGIN:${kind}\\s*$[\\s\\S]*?^END:${kind}\\s*$`, 'gim')) ?? []
  const head = unfolded.match(/^X-WR-CALNAME[;:].*$/im)?.[0] ?? ''
  const tzs = blocks('VTIMEZONE').filter((b) => tryParse(`BEGIN:VCALENDAR\n${b}\nEND:VCALENDAR`))
  const out: Component[] = []
  const wrap = (body: string) =>
    `BEGIN:VCALENDAR\n${head ? `${head}\n` : ''}${tzs.join('\n')}\n${body}\nEND:VCALENDAR`
  const shell = tryParse(wrap(''))
  if (shell) out.push(shell)
  for (const b of blocks('VEVENT')) {
    const c = tryParse(`BEGIN:VCALENDAR\n${b}\nEND:VCALENDAR`)
    if (c) out.push(c)
    else
      warnings.push(`skipped an unparseable event: ${b.match(/^UID:(.*)$/im)?.[1]?.trim() ?? b.slice(0, 60)}`)
  }
  return out
}

function tryParse(text: string): Component | null {
  try {
    return new ICAL.Component(ICAL.parse(text))
  } catch {
    return null
  }
}

// ------------------------------------------------------------------------------------------ time

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number }

/** How a wall-clock time becomes an instant. */
type Zone =
  | { kind: 'utc' }
  | { kind: 'vtimezone'; tz: Timezone; name: string }
  | { kind: 'iana'; name: string }
  | { kind: 'floating'; name: string | null }

const WINDOWS_ZONES: Record<string, string> = {
  'Pacific Standard Time': 'America/Los_Angeles',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Central Standard Time': 'America/Chicago',
  'Eastern Standard Time': 'America/New_York',
  'Atlantic Standard Time': 'America/Halifax',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central European Standard Time': 'Europe/Warsaw',
  'Central Europe Standard Time': 'Europe/Budapest',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Russian Standard Time': 'Europe/Moscow',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Singapore Standard Time': 'Asia/Singapore',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'E. South America Standard Time': 'America/Sao_Paulo',
  UTC: 'UTC',
}

const formatters = new Map<string, Intl.DateTimeFormat | null>()
function formatter(zone: string): Intl.DateTimeFormat | null {
  let f = formatters.get(zone)
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      })
    } catch {
      f = null
    }
    formatters.set(zone, f)
  }
  return f
}

/** An IANA zone name for a TZID, or null: `Europe/Warsaw`, `/mozilla.org/20050126_1/Europe/Warsaw`,
 *  `Eastern Standard Time`. */
export function ianaZone(tzid: string): string | null {
  const t = tzid.trim().replace(/^"|"$/g, '')
  const segs = t.split('/').filter(Boolean)
  // a vendor prefix before the zone name: the last two or three segments
  const candidates = [WINDOWS_ZONES[t], t, segs.slice(-2).join('/'), segs.slice(-3).join('/')]
  for (const c of candidates) if (c && formatter(c)) return formatter(c)?.resolvedOptions().timeZone ?? c
  return null
}

/** The zone's UTC offset (ms) at an instant. */
function offsetAt(zone: string, ms: number): number {
  const parts = formatter(zone)?.formatToParts(new Date(ms)) ?? []
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return (
    Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) -
    Math.floor(ms / 1000) * 1000
  )
}

/** The instant a wall-clock time in an IANA zone names. In a spring-forward gap the pre-gap offset
 *  wins (02:30 on a spring-forward night reads as 03:30 summer time), and an ambiguous time is
 *  its first occurrence, as RFC 5545 asks. */
function ianaToUtc(w: Wall, zone: string): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  const o1 = offsetAt(zone, guess - offsetAt(zone, guess))
  const t = guess - o1
  const o2 = offsetAt(zone, t)
  if (o2 === o1) return t
  // ambiguous or nonexistent: pick the reading that round-trips, else the earlier offset
  const t2 = guess - o2
  return offsetAt(zone, t2) === o2 ? Math.min(t, t2) : guess - Math.min(o1, o2)
}

function wallOf(t: Time): Wall {
  const w = { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second }
  const ok =
    Number.isInteger(w.year) &&
    w.month >= 1 &&
    w.month <= 12 &&
    w.day >= 1 &&
    w.day <= 31 &&
    w.hour >= 0 &&
    w.hour <= 23 &&
    w.minute >= 0 &&
    w.minute <= 59 &&
    w.second >= 0 &&
    w.second <= 60
  if (!ok) throw new Error(`invalid date-time ${t.toString()}`)
  return w
}

function zoneOf(prop: Property | null, t: Time, zones: Map<string, Timezone>): Zone {
  if (t.zone === ICAL.Timezone.utcTimezone || t.zone?.tzid === 'UTC') return { kind: 'utc' }
  const tzid = str(prop?.getParameter('tzid')).trim()
  if (!tzid) return { kind: 'floating', name: null }
  const own = zones.get(tzid)
  const iana = ianaZone(tzid)
  if (own) return { kind: 'vtimezone', tz: own, name: iana ?? tzid }
  if (iana === 'UTC' || iana === 'Etc/UTC') return { kind: 'utc' }
  if (iana) return { kind: 'iana', name: iana }
  return { kind: 'floating', name: tzid }
}

/** Absolute ms of a DATE-TIME's wall clock in a zone. */
function instant(t: Time, z: Zone): number {
  const w = wallOf(t)
  switch (z.kind) {
    case 'utc':
      return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
    case 'vtimezone': {
      const probe = t.clone()
      probe.isDate = false
      return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - z.tz.utcOffset(probe) * 1000
    }
    case 'iana':
      return ianaToUtc(w, z.name)
    case 'floating':
      return new Date(w.year, w.month - 1, w.day, w.hour, w.minute, w.second).getTime()
  }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const dateStr = (t: Time) => {
  const w = wallOf(t)
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`
}
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + n))
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00Z`) - Date.parse(`${a}T00:00Z`)) / 86_400_000)
/** Local midnight of a `YYYY-MM-DD` (how all-day events are placed, as meetings.ts does). */
function localMidnightMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime()
}

// ------------------------------------------------------------------------------------------ expand

export type ExpandOptions = {
  /** Default `ics`. */
  sourceUid?: string
  /** Used when the file has no X-WR-CALNAME. Default `Calendar`. */
  calendarName?: string
  /** The user's email addresses, for myPartstat. */
  me?: string[]
  logger?: Logger
  maxPerEvent?: number
  maxIterations?: number
}

/** Every occurrence of an iCalendar text overlapping [from, to). Pure (no I/O). */
export function expandIcs(text: string, from: Date, to: Date, opts: ExpandOptions = {}): CalendarSnapshot {
  const parsed = parseIcs(text)
  for (const w of parsed.warnings) opts.logger?.warn('ics: parse problem', { detail: w })
  return expandParsed(parsed, from, to, opts)
}

type Ctx = {
  sourceUid: string
  calendarName: string
  me: Set<string>
  zones: Map<string, Timezone>
  fromMs: number
  toMs: number
  maxPerEvent: number
  maxIterations: number
}

/** One start of a series, before the event's fields are attached. */
type Slot = {
  allDay: boolean
  startMs: number
  endMs: number
  startDate: string | null
  endDate: string | null
  timezone: string | null
}

export function expandParsed(p: ParsedIcs, from: Date, to: Date, opts: ExpandOptions = {}): CalendarSnapshot {
  const sourceUid = opts.sourceUid ?? 'ics'
  const ctx: Ctx = {
    sourceUid,
    calendarName: p.calendarName ?? opts.calendarName ?? 'Calendar',
    me: new Set((opts.me ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean)),
    zones: p.zones,
    fromMs: from.getTime(),
    toMs: to.getTime(),
    maxPerEvent: opts.maxPerEvent ?? MAX_OCCURRENCES_PER_EVENT,
    maxIterations: opts.maxIterations ?? MAX_ITERATIONS_PER_EVENT,
  }
  const masters = new Map<string, Component>()
  const overrides = new Map<string, Component[]>()
  const loose: Component[] = []
  for (const e of p.events) {
    const uid = str(e.getFirstPropertyValue('uid')).trim()
    if (!uid) {
      loose.push(e)
      continue
    }
    if (e.hasProperty('recurrence-id')) overrides.set(uid, [...(overrides.get(uid) ?? []), e])
    else if (!masters.has(uid)) masters.set(uid, e)
  }
  const occurrences: RawOccurrence[] = []
  const guarded = (uid: string, fn: () => RawOccurrence[]) => {
    try {
      occurrences.push(...fn())
    } catch (err) {
      opts.logger?.warn('ics: event skipped', { uid, error: errText(err) })
    }
  }
  for (const [uid, m] of masters) guarded(uid, () => expandSeries(ctx, m, overrides.get(uid) ?? []))
  for (const [uid, list] of overrides) {
    if (masters.has(uid)) continue
    for (const o of list) guarded(uid, () => overrideOccurrences(ctx, o, true))
  }
  for (const e of loose) guarded('', () => expandSeries(ctx, e, []))
  occurrences.sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid))
  return { calendars: [{ id: sourceUid, name: ctx.calendarName }], occurrences }
}

const overlaps = (ctx: Ctx, s: Slot) => Math.max(s.endMs, s.startMs + 1) > ctx.fromMs && s.startMs < ctx.toMs

/** The instance key RECURRENCE-ID and EXDATE are matched on. */
const slotKey = (s: Slot) => (s.allDay ? `d:${s.startDate}` : `t:${s.startMs}`)

function keyOf(ctx: Ctx, prop: Property, t: Time): string {
  return t.isDate ? `d:${dateStr(t)}` : `t:${instant(t, zoneOf(prop, t, ctx.zones))}`
}

/** DTSTART/DTEND/DURATION → the event's own slot, and the length every instance gets. */
function baseSlot(ctx: Ctx, e: Component) {
  const sp = e.getFirstProperty('dtstart')
  const start = sp?.getFirstValue() as Time | null
  if (!sp || !start) throw new Error('no DTSTART')
  const zone = zoneOf(sp, start, ctx.zones)
  const ep = e.getFirstProperty('dtend') ?? e.getFirstProperty('due')
  const end = ep?.getFirstValue() as Time | null
  const dur = e.getFirstPropertyValue('duration') as InstanceType<typeof ICAL.Duration> | null
  const timezone = start.isDate || zone.kind === 'utc' ? null : zone.name
  if (start.isDate) {
    const sd = dateStr(start)
    let days = 1
    if (end?.isDate) days = daysBetween(sd, dateStr(end))
    else if (dur) days = Math.ceil(dur.toSeconds() / 86_400)
    return { start, zone, timezone, allDay: true, days: Math.max(1, days), lengthMs: 0 }
  }
  const s = instant(start, zone)
  let lengthMs = 0
  if (end && ep)
    lengthMs = (end.isDate ? localMidnightMs(dateStr(end)) : instant(end, zoneOf(ep, end, ctx.zones))) - s
  else if (dur) lengthMs = dur.toSeconds() * 1000
  return { start, zone, timezone, allDay: false, days: 0, lengthMs: Math.max(0, lengthMs) }
}

function slotAt(base: ReturnType<typeof baseSlot>, t: Time, prop: Property | null, ctx: Ctx): Slot {
  if (base.allDay || t.isDate) {
    const startDate = dateStr(t)
    const endDate = addDays(startDate, base.allDay ? base.days : 1)
    return {
      allDay: true,
      startMs: localMidnightMs(startDate),
      endMs: localMidnightMs(endDate),
      startDate,
      endDate,
      timezone: null,
    }
  }
  const zone = prop ? zoneOf(prop, t, ctx.zones) : base.zone
  const startMs = instant(t, zone)
  return {
    allDay: false,
    startMs,
    endMs: startMs + base.lengthMs,
    startDate: null,
    endDate: null,
    timezone: base.timezone,
  }
}

function expandSeries(ctx: Ctx, master: Component, overrides: Component[]): RawOccurrence[] {
  const base = baseSlot(ctx, master)
  const rrules = master.getAllProperties('rrule')
  const rdates = master.getAllProperties('rdate')
  const recurring = rrules.length > 0 || rdates.length > 0
  const dtstartProp = master.getFirstProperty('dtstart')
  const first = slotAt(base, base.start, dtstartProp, ctx)
  if (!recurring) {
    const out = overlaps(ctx, first) ? [occurrence(ctx, master, first, null, false)] : []
    // an override of a non-recurring event (seen in the wild) replaces it
    if (overrides.length) return overrides.flatMap((o) => overrideOccurrences(ctx, o, true))
    return out
  }

  const excluded = new Set<string>()
  let dayExclusions = false
  for (const p of master.getAllProperties('exdate'))
    for (const v of p.getValues() as Time[]) {
      excluded.add(keyOf(ctx, p, v))
      // a DATE EXDATE on a timed series removes that day's instance
      if (v.isDate) {
        excluded.add(`day:${dateStr(v)}`)
        dayExclusions = true
      }
    }
  const replaced = new Set<string>()
  for (const o of overrides) {
    const rp = o.getFirstProperty('recurrence-id')
    const rv = rp?.getFirstValue() as Time | null
    if (rp && rv) replaced.add(keyOf(ctx, rp, rv))
  }

  const slots = new Map<string, Slot>()
  let emitted = 0
  const consider = (s: Slot) => {
    const key = slotKey(s)
    if (slots.has(key) || excluded.has(key) || replaced.has(key)) return
    if (dayExclusions && !s.allDay && excluded.has(`day:${wallDate(s.startMs, base)}`)) return
    if (!overlaps(ctx, s)) return
    if (++emitted > ctx.maxPerEvent) throw new Error(`more than ${ctx.maxPerEvent} occurrences in the window`)
    slots.set(key, s)
  }

  consider(first) // DTSTART is always an instance (RFC 5545), even when the rule does not match it
  for (const rp of rrules) {
    const rule = (rp.getFirstValue() as InstanceType<typeof ICAL.Recur>).clone()
    // UNTIL is compared on absolute instants here: ical.js compares it against the (possibly floating)
    // wall clock, which is off by the zone's offset for a bare TZID.
    let untilMs = Number.POSITIVE_INFINITY
    if (rule.until) {
      const u = rule.until
      untilMs = u.isDate
        ? base.allDay
          ? localMidnightMs(dateStr(u))
          : ianaOrLocalEndOfDay(u, base)
        : instant(u, u.zone === ICAL.Timezone.utcTimezone ? { kind: 'utc' } : base.zone)
      rule.until = null
    }
    const it = rule.iterator(base.start)
    for (let i = 0; ; i++) {
      if (i >= ctx.maxIterations) throw new Error(`RRULE ran past ${ctx.maxIterations} steps`)
      const t = it.next()
      if (!t) break
      const s = slotAt(base, t, null, ctx)
      if (s.startMs > untilMs) break
      if (s.startMs >= ctx.toMs) break
      consider(s)
    }
  }
  for (const p of rdates)
    for (const v of p.getValues() as (Time | InstanceType<typeof ICAL.Period>)[]) {
      if (v instanceof ICAL.Period) {
        const s = slotAt(base, v.start, p, ctx)
        const end = v.getEnd()
        consider({ ...s, endMs: end ? instant(end, zoneOf(p, end, ctx.zones)) : s.endMs })
      } else consider(slotAt(base, v, p, ctx))
    }

  const out = [...slots.values()].map((s) =>
    occurrence(ctx, master, s, new Date(s.startMs).toISOString(), true),
  )
  for (const o of overrides) out.push(...overrideOccurrences(ctx, o, true))
  return out
}

/** For a DATE UNTIL on a timed series: the end of that day in the series' zone. */
function ianaOrLocalEndOfDay(u: Time, base: ReturnType<typeof baseSlot>): number {
  const next = addDays(dateStr(u), 1)
  const [y, m, d] = next.split('-').map(Number)
  const t = ICAL.Time.fromData({ year: y, month: m, day: d, hour: 0, minute: 0, second: 0, isDate: false })
  return instant(t, base.zone) - 1
}

/** The wall-clock date of an instant in the series' zone (for DATE EXDATEs on timed series). */
function wallDate(ms: number, base: ReturnType<typeof baseSlot>): string {
  const z = base.zone
  const name =
    z.kind === 'iana' || z.kind === 'vtimezone' ? ianaZone(z.name) : z.kind === 'utc' ? 'UTC' : null
  const f = name ? formatter(name) : null
  if (!f) {
    const d = new Date(ms)
    return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const parts = f.formatToParts(new Date(ms))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return `${pad(n('year'), 4)}-${pad(n('month'))}-${pad(n('day'))}`
}

function overrideOccurrences(ctx: Ctx, o: Component, recurring: boolean): RawOccurrence[] {
  const base = baseSlot(ctx, o)
  const s = slotAt(base, base.start, o.getFirstProperty('dtstart'), ctx)
  if (!overlaps(ctx, s)) return []
  const rp = o.getFirstProperty('recurrence-id')
  const rv = rp?.getFirstValue() as Time | null
  let rid: string | null = null
  if (rp && rv)
    rid = new Date(
      rv.isDate ? localMidnightMs(dateStr(rv)) : instant(rv, zoneOf(rp, rv, ctx.zones)),
    ).toISOString()
  return [occurrence(ctx, o, s, rid, recurring)]
}

function occurrence(
  ctx: Ctx,
  e: Component,
  s: Slot,
  recurrenceId: string | null,
  recurring: boolean,
): RawOccurrence {
  let attendees = 0
  let myPartstat: string | null = null
  for (const a of e.getAllProperties('attendee')) {
    attendees++
    const addr = stripMailto(str(a.getFirstValue())).toLowerCase()
    if (myPartstat === null && ctx.me.has(addr))
      myPartstat = str(a.getParameter('partstat')).toUpperCase() || 'NEEDS-ACTION'
  }
  const organizer = stripMailto(str(e.getFirstPropertyValue('organizer'))) || null
  return {
    sourceUid: ctx.sourceUid,
    calendarName: ctx.calendarName,
    uid: str(e.getFirstPropertyValue('uid')),
    recurrenceId,
    summary: str(e.getFirstPropertyValue('summary')),
    description: str(e.getFirstPropertyValue('description')),
    location: str(e.getFirstPropertyValue('location')),
    url: str(e.getFirstPropertyValue('url')).trim(),
    start: new Date(s.startMs).toISOString(),
    end: new Date(Math.max(s.startMs, s.endMs)).toISOString(),
    allDay: s.allDay,
    startDate: s.startDate,
    endDate: s.endDate,
    timezone: s.timezone,
    status: str(e.getFirstPropertyValue('status')).trim().toUpperCase(),
    myPartstat,
    organizer,
    attendees,
    recurring,
    xprops: xprops(e),
  }
}

/** X- properties carrying a link, as the EDS agent collects them (first value per name). */
function xprops(e: Component): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of e.getAllProperties()) {
    const name = p.name.toUpperCase()
    if (!name.startsWith('X-')) continue
    const value = str(p.getFirstValue())
    if (URL_RE.test(value) && !(name in out)) out[name] = value.trim()
  }
  return out
}

const stripMailto = (v: string) => v.replace(/^mailto:/i, '').trim()
function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return typeof v === 'string' ? v : String(v)
}
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

// ------------------------------------------------------------------------------------------ provider

export type IcsProviderOptions = {
  /** A file path, a `file://` URL, or an `http(s)://` / `webcal://` URL. */
  source: string
  /** Calendar name when the file has no X-WR-CALNAME. Default: the file's basename, or the URL's host. */
  name?: string
  /** The user's email addresses, to find their PARTSTAT among the attendees. */
  me?: string[]
  /** File: stat poll interval (default 250 ms). URL: refetch interval (default 5 min). */
  pollMs?: number
  fetch?: typeof fetch
  /** Per-request timeout for URL sources. Default 30 s. */
  timeoutMs?: number
  logger?: Logger
  now?: () => Date
}

/** A stable id for a source string. */
export function icsSourceUid(source: string): string {
  return `ics:${createHash('sha256').update(source.trim()).digest('hex').slice(0, 12)}`
}

export class IcsCalendarProvider implements CalendarProvider {
  readonly name = 'ics'
  readonly expands = true
  private readonly o: IcsProviderOptions
  private readonly url: string | null
  private readonly path: string | null
  /** What status details say about the source: the path, or only the URL's host (the path of a
   *  subscription URL is usually its secret). */
  private readonly label: string
  private readonly sourceUid: string
  private readonly fallbackName: string
  private readonly now: () => Date
  private l: ProviderListener | null = null
  private window: { from: Date; to: Date } | null = null
  private parsed: ParsedIcs | null = null
  private parsedAt: Date | null = null
  private error: string | null = null
  private lastMtime = -1
  private timer: NodeJS.Timeout | null = null
  private inflight: AbortController | null = null

  constructor(o: IcsProviderOptions) {
    this.o = o
    this.now = o.now ?? (() => new Date())
    const src = o.source.trim()
    this.sourceUid = icsSourceUid(src)
    if (/^(https?|webcal):\/\//i.test(src)) {
      this.url = src.replace(/^webcal:/i, 'https:')
      this.path = null
      const u = new URL(this.url)
      this.label = u.host
      this.fallbackName = o.name ?? u.host
    } else {
      this.url = null
      this.path = /^file:\/\//i.test(src) ? fileURLToPath(src) : resolve(src)
      this.label = this.path
      this.fallbackName = o.name ?? basename(this.path).replace(/\.ics$/i, '')
    }
  }

  /** The URL actually fetched (webcal:// mapped to https://), or null for a file. */
  get fetchUrl(): string | null {
    return this.url
  }

  start(l: ProviderListener): void {
    this.l = l
    l.status('starting', null)
    if (this.path) {
      this.readFile()
      // Our own stat polling against what we last READ (see FileCalendarProvider for why not
      // fs.watchFile: its baseline stat races a file created right after start()).
      this.timer = setInterval(() => this.readFile(), this.o.pollMs ?? DEFAULT_FILE_POLL_MS)
      this.timer.unref()
    } else {
      void this.fetchNow()
      this.timer = setInterval(() => void this.fetchNow(), this.o.pollMs ?? DEFAULT_URL_POLL_MS)
      this.timer.unref()
    }
  }

  setWindow(from: Date, to: Date): void {
    this.window = { from, to }
    this.emit()
  }

  refresh(): void {
    if (this.path) {
      this.lastMtime = -1
      this.readFile()
    } else void this.fetchNow()
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.inflight?.abort()
    this.inflight = null
    this.l = null
  }

  private readFile(): void {
    const path = this.path
    if (!this.l || !path) return
    if (!existsSync(path)) {
      // report a missing file once, not on every poll
      if (this.lastMtime !== -2) this.fail(`calendar file ${path} does not exist`)
      this.lastMtime = -2
      return
    }
    let text: string
    try {
      const mtime = statSync(path).mtimeMs
      if (mtime === this.lastMtime) return
      this.lastMtime = mtime
      text = readFileSync(path, 'utf8')
    } catch (err) {
      this.fail(`calendar file ${path}: ${errText(err)}`)
      return
    }
    this.accept(text)
  }

  private async fetchNow(): Promise<void> {
    const url = this.url
    if (!url || !this.l || this.inflight) return
    const ac = new AbortController()
    this.inflight = ac
    const timeout = setTimeout(() => ac.abort(new Error('timed out')), this.o.timeoutMs ?? FETCH_TIMEOUT_MS)
    timeout.unref()
    try {
      const res = await (this.o.fetch ?? fetch)(url, {
        signal: ac.signal,
        headers: { accept: 'text/calendar, */*;q=0.5' },
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      if (this.inflight !== ac) return // stopped meanwhile
      this.accept(text)
    } catch (err) {
      if (this.inflight !== ac) return
      const why = ac.signal.aborted ? 'timed out' : errText(err)
      this.fail(`calendar ${this.label}: ${why}`)
    } finally {
      clearTimeout(timeout)
      if (this.inflight === ac) this.inflight = null
    }
  }

  private accept(text: string): void {
    let parsed: ParsedIcs
    try {
      parsed = parseIcs(text)
    } catch (err) {
      this.fail(`calendar ${this.label}: ${errText(err)}`)
      return
    }
    for (const w of parsed.warnings)
      this.o.logger?.warn('ics: parse problem', { source: this.label, detail: w })
    this.parsed = parsed
    this.parsedAt = this.now()
    this.error = null
    if (this.window) this.emit()
  }

  private fail(detail: string): void {
    const kept = this.parsedAt ? ` (showing the copy read at ${this.parsedAt.toISOString()})` : ''
    this.error = `${detail}${kept}`
    this.l?.status('unavailable', this.error)
  }

  private emit(): void {
    const l = this.l
    const w = this.window
    if (!l || !w || !this.parsed) return
    try {
      l.snapshot(
        expandParsed(this.parsed, w.from, w.to, {
          sourceUid: this.sourceUid,
          calendarName: this.fallbackName,
          me: this.o.me,
          logger: this.o.logger,
        }),
      )
    } catch (err) {
      this.l?.status('unavailable', `calendar ${this.label}: ${errText(err)}`)
      return
    }
    l.status(this.error ? 'unavailable' : 'ok', this.error)
  }
}
