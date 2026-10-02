// The extension's view model: pure functions from the daemon's D-Bus properties (as plain JS values) to
// what the panel and the menu show. No `gi://` imports here, so the whole of the extension's decision
// logic is unit-tested under Node (packages/e2e/test/extension-model.test.ts); extension.js only renders
// the model and wires actions.
//
// Translation: every user-visible string goes through the `_` passed in, so the same code runs with the
// extension's gettext in the Shell and with the identity function in tests.

/** @typedef {(s: string) => string} Gettext */

const MINUTE = 60_000

/** Elapsed recording time in ms: the accumulated part, plus the running stretch while recording. */
export function elapsedMs(props, now) {
  const base = Number(props.ElapsedMs ?? 0)
  const since = Number(props.RunningSince ?? 0)
  if (props.State !== 'recording' || since <= 0) return Math.max(0, base)
  return Math.max(0, base + Math.max(0, now - since))
}

/** `m:ss` under an hour, `h:mm:ss` after. */
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Local wall-clock time of an epoch-ms instant, 24 h (`09:05`) or 12 h (`9:05 AM`). */
export function formatClock(ms, clock24 = true) {
  const d = new Date(ms)
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (clock24) return `${String(d.getHours()).padStart(2, '0')}:${mm}`
  const h = d.getHours() % 12 || 12
  return `${h}:${mm} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

const sameLocalDay = (a, b) => {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** `09:00–09:30`, prefixed with `Tomorrow` when the meeting starts on the next local day. */
export function formatRange(m, now, _ = (s) => s, clock24 = true) {
  const range = `${formatClock(m.start, clock24)}–${formatClock(m.end, clock24)}`
  if (sameLocalDay(m.start, now)) return range
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (sameLocalDay(m.start, tomorrow.getTime())) return `${_('Tomorrow')} ${range}`
  return range
}

const PROVIDERS = {
  meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  webex: 'Webex',
  jitsi: 'Jitsi Meet',
  whereby: 'Whereby',
}

/** Human name of a conferencing provider; '' for none, a generic word for unknown links. */
export function providerLabel(provider, _ = (s) => s) {
  if (!provider) return ''
  return PROVIDERS[provider] ?? _('Video call')
}

/** A meeting dict from D-Bus is "no meeting" when empty or missing its id. */
export const isMeeting = (m) => Boolean(m && typeof m === 'object' && typeof m.id === 'string' && m.id)

/** When a meeting starts relative to now: `now`, `in 5 min`, `in 1 h 20 min`. */
export function startsIn(m, now, _ = (s) => s) {
  const d = m.start - now
  if (d <= 0) return _('now')
  const mins = Math.ceil(d / MINUTE)
  if (mins < 60) return _('in {n} min').replace('{n}', String(mins))
  const h = Math.floor(mins / 60)
  const rest = mins % 60
  return rest
    ? _('in {h} h {m} min').replace('{h}', String(h)).replace('{m}', String(rest))
    : _('in {h} h').replace('{h}', String(h))
}

/**
 * The whole view.
 *
 * @param {object} props  D-Bus property values, recursively unpacked (see the interface XML).
 * @param {object} o
 * @param {boolean} o.daemon  whether org.gnome.Gnomeola has an owner
 * @param {number} o.now  epoch ms
 * @param {{showElapsed: boolean, showLastLine: boolean}} o.prefs
 * @param {boolean} [o.clock24]
 * @param {Gettext} [o._]
 */
export function buildView(props, o) {
  const _ = o._ ?? ((s) => s)
  const clock24 = o.clock24 ?? true
  const now = o.now

  if (!o.daemon) {
    return {
      panel: {
        icon: 'microphone-disabled-symbolic',
        styleClass: 'gnomeola-offline',
        label: '',
        accessibleName: _('kacola: not running'),
      },
      items: [
        { key: 'offline', kind: 'status', text: _('kacola is not running') },
        { key: 'separator-app', kind: 'separator' },
        { key: 'open', kind: 'action', text: _('Open kacola'), action: { type: 'open-window' } },
        { key: 'prefs', kind: 'action', text: _('Preferences'), action: { type: 'preferences' } },
      ],
    }
  }

  const state = props.State === 'recording' || props.State === 'paused' ? props.State : 'idle'
  const active = state !== 'idle'
  const elapsed = formatElapsed(elapsedMs(props, now))
  const title = props.SessionTitle || _('Untitled meeting')

  const panel = {
    icon:
      state === 'recording'
        ? 'media-record-symbolic'
        : state === 'paused'
          ? 'media-playback-pause-symbolic'
          : 'audio-input-microphone-symbolic',
    styleClass:
      state === 'recording' ? 'gnomeola-recording' : state === 'paused' ? 'gnomeola-paused' : 'gnomeola-idle',
    label: active && o.prefs.showElapsed ? elapsed : '',
    accessibleName:
      state === 'recording'
        ? _('kacola: recording {title}, {elapsed}').replace('{title}', title).replace('{elapsed}', elapsed)
        : state === 'paused'
          ? _('kacola: paused {title}, {elapsed}').replace('{title}', title).replace('{elapsed}', elapsed)
          : _('kacola: not recording'),
  }

  const items = []
  if (active) {
    items.push({
      key: 'session',
      kind: 'action',
      text: `${state === 'recording' ? _('Recording') : _('Paused')} · ${title} · ${elapsed}`,
      action: { type: 'open-window' },
    })
    if (o.prefs.showLastLine && props.LastLine) {
      const who = props.LastSpeaker ? `${props.LastSpeaker}: ` : ''
      items.push({ key: 'last-line', kind: 'status', text: `${who}${props.LastLine}` })
    }
    items.push(
      state === 'recording'
        ? { key: 'pause', kind: 'action', text: _('Pause'), action: { type: 'call', method: 'Pause' } }
        : { key: 'resume', kind: 'action', text: _('Resume'), action: { type: 'call', method: 'Resume' } },
    )
    items.push({
      key: 'stop',
      kind: 'action',
      text: _('Stop recording'),
      action: { type: 'call', method: 'Stop' },
    })
  } else {
    items.push({
      key: 'record',
      kind: 'action',
      text: _('Record now'),
      action: { type: 'call', method: 'Start' },
    })
  }

  items.push({ key: 'separator-meetings', kind: 'separator' })
  items.push({ key: 'meetings-header', kind: 'header', text: _('Meetings') })

  const cal = props.CalendarState || 'off'
  if (cal === 'off') {
    items.push({ key: 'calendar-state', kind: 'status', text: _('Calendar access is off') })
  } else if (cal === 'unavailable') {
    // the daemon's detail ("evolution-data-server is not running") is for logs, not this menu
    items.push({ key: 'calendar-state', kind: 'status', text: _('Can’t read your calendar right now') })
  } else if (cal === 'starting') {
    items.push({ key: 'calendar-state', kind: 'status', text: _('Reading calendars…') })
  }

  const upcoming = (Array.isArray(props.UpcomingMeetings) ? props.UpcomingMeetings : []).filter(isMeeting)
  // The current meeting leads even if the daemon's list is older than it.
  const current = isMeeting(props.CurrentMeeting) ? props.CurrentMeeting : null
  const list = current && !upcoming.some((m) => m.id === current.id) ? [current, ...upcoming] : upcoming
  for (const m of list) {
    const inProgress = m.start <= now && now < m.end
    const provider = providerLabel(m.provider, _)
    const when = inProgress ? _('Now') : formatRange(m, now, _, clock24)
    const verb = m.joinUrl ? _('Join') : _('Record')
    const recordingThis = active && Boolean(props.SessionMeetingId) && props.SessionMeetingId === m.id
    items.push({
      key: `meeting:${m.id}`,
      kind: 'meeting',
      // the title leads; when and where sit quietly underneath
      text: m.title || _('Untitled meeting'),
      detail: [when, provider].filter(Boolean).join(' · '),
      verb: recordingThis ? '' : verb,
      accessibleName: [m.title || _('Untitled meeting'), when, provider, recordingThis ? '' : verb].filter(Boolean).join(', '),
      // Joining a meeting while another session records would fail; the item stays usable to open the link.
      action: { type: 'join', meetingId: m.id, joinUrl: m.joinUrl || '' },
      inProgress,
    })
  }
  if (!list.length && cal === 'ok')
    items.push({ key: 'no-meetings', kind: 'status', text: _('No upcoming meetings') })

  items.push({ key: 'separator-app', kind: 'separator' })
  items.push({ key: 'open', kind: 'action', text: _('Open kacola'), action: { type: 'open-window' } })
  items.push({ key: 'prefs', kind: 'action', text: _('Preferences'), action: { type: 'preferences' } })
  return { panel, items }
}

/**
 * What decides whether the menu must be rebuilt rather than relabelled: everything except texts that
 * change every second (the elapsed time).
 */
export function structureKey(view) {
  return view.items.map((i) => `${i.kind}:${i.key}:${i.verb ?? ''}:${i.detail ?? ''}`).join('|')
}

/** The notification for a MeetingStarting signal, or null when the meeting dict is empty. */
export function meetingNotification(m, now, _ = (s) => s, clock24 = true) {
  if (!isMeeting(m)) return null
  const provider = providerLabel(m.provider, _)
  return {
    title: m.title || _('Untitled meeting'),
    body: [`${formatRange(m, now, _, clock24)} (${startsIn(m, now, _)})`, provider]
      .filter(Boolean)
      .join(' · '),
    actionLabel: m.joinUrl ? _('Join and record') : _('Record'),
    meetingId: m.id,
    joinUrl: m.joinUrl || '',
  }
}
