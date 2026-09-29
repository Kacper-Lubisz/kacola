// C-4: the line protocol between gnomeolad and its D-Bus bridge (packages/daemon/gjs/dbus-bridge.js), a
// GJS helper that owns `org.gnome.Gnomeola` on the session bus and exports the interface in
// packages/daemon/dbus/org.gnome.Gnomeola.xml. One JSON object per line, both directions.
//
// Why a GJS helper rather than a Node D-Bus library: Gio's GDBus is the implementation GNOME Shell itself
// speaks, its bus-name ownership and PropertiesChanged semantics are exactly the reference ones, it needs
// no new npm dependency (the pure-JS Node libraries are unmaintained), and gjs is already required for
// cal-agent. The bridge is deliberately dumb: the daemon computes every property value (unit-tested
// TypeScript, ./view.ts); the bridge only converts JSON to GVariants and forwards method calls.
//
// daemon → bridge (stdin)
//   {"type":"props","props":{Name: value, …}}          set properties; the bridge emits PropertiesChanged
//                                                      for the ones whose value actually changed
//   {"type":"signal","name":"SessionStarted","args":[…]} emit a signal (args in XML order)
//   {"type":"reply","id":N,"result":[…]}                return values of call N (out args in XML order)
//   {"type":"reply","id":N,"error":{"name":…,"message":…}}  fail call N with a D-Bus error
//
// bridge → daemon (stdout)
//   {"type":"acquired","name":…}      the bus name is ours; the interface is exported
//   {"type":"lost","name":…}          could not own the name (another gnomeolad has it) or lost it
//   {"type":"call","id":N,"method":"Join","args":[…]}  a method call to answer with a reply
//   {"type":"log","level":…,"message":…}
//
// Value encoding: properties/args are JSON in the obvious shape for their signature — s → string,
// t/x → number, b → boolean, as → string[], a{sv} → an object whose values are strings, numbers
// (integers become int64 'x', others double 'd') or booleans; aa{sv} → an array of those objects.

export const BUS_NAME = 'org.gnome.Gnomeola'
export const OBJECT_PATH = '/org/gnome/Gnomeola'
export const INTERFACE = 'org.gnome.Gnomeola'

/** D-Bus error names the daemon replies with. */
export const DBUS_ERRORS = {
  not_found: 'org.gnome.Gnomeola.Error.NotFound',
  conflict: 'org.gnome.Gnomeola.Error.Conflict',
  bad_request: 'org.gnome.Gnomeola.Error.InvalidArgs',
  unavailable: 'org.gnome.Gnomeola.Error.Unavailable',
  internal: 'org.gnome.Gnomeola.Error.Failed',
  unauthorized: 'org.gnome.Gnomeola.Error.Failed',
} as const

export type DbusMeeting = {
  id: string
  title: string
  start: number
  end: number
  allDay: boolean
  joinUrl: string
  provider: string
  calendar: string
  location: string
  response: string
}

export type DbusProps = {
  State: 'idle' | 'recording' | 'paused'
  SessionId: string
  SessionTitle: string
  SessionMeetingId: string
  ElapsedMs: number
  RunningSince: number
  LastLine: string
  LastSpeaker: string
  /** An empty object means none. */
  CurrentMeeting: DbusMeeting | Record<string, never>
  NextMeeting: DbusMeeting | Record<string, never>
  UpcomingMeetings: DbusMeeting[]
  CalendarState: string
  CalendarDetail: string
  AutoRecord: string[]
  DaemonUrl: string
  Version: string
}

export type DbusSignal =
  | { name: 'SessionStarted'; args: [sessionId: string, title: string, reason: StartReason] }
  | { name: 'SessionStopped'; args: [sessionId: string, status: string] }
  | { name: 'MeetingStarting'; args: [meeting: DbusMeeting] }

export type StartReason = 'manual' | 'join' | 'calendar' | 'mic-activity'

export type DbusCall =
  | { method: 'Start'; args: [title: string] }
  | { method: 'Stop'; args: [] }
  | { method: 'Pause'; args: [] }
  | { method: 'Resume'; args: [] }
  | { method: 'Join'; args: [meetingId: string] }

export type BridgeToDaemon =
  | { type: 'acquired'; name: string }
  | { type: 'lost'; name: string }
  | ({ type: 'call'; id: number } & DbusCall)
  | { type: 'log'; level: 'debug' | 'info' | 'warn'; message: string }

export type DaemonToBridge =
  | { type: 'props'; props: Partial<DbusProps> }
  | ({ type: 'signal' } & DbusSignal)
  | { type: 'reply'; id: number; result: unknown[] }
  | { type: 'reply'; id: number; error: { name: string; message: string } }
