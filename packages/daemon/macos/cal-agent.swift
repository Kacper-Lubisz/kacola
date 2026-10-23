// kacola-cal-agent for macOS: the calendar agent (src/calendar/agent-protocol.ts) over EventKit — every
// calendar in the Calendar app, so the accounts added in System Settings › Internet Accounts (Google,
// iCloud, Exchange) need no sign-in of kacola's own.
//
//   kacola-cal-agent             the line protocol on stdin/stdout, as the daemon runs it
//   kacola-cal-agent --status    prints granted | denied | restricted | not-determined | write-only
//   kacola-cal-agent --request   asks for full access (the system prompt), then prints the status
//
// macOS attributes the prompt and the grant to the app that started this helper (kacola.app, whose
// Info.plist carries the usage strings), so the window asks with --request and the daemon's agent, also a
// descendant of the app, sees the grant: it re-checks every few seconds while access is missing.
//
// Read-only: agendas cannot write the invitation block into these events yet (the daemon then hands the
// user the text to paste).

import EventKit
import Foundation

let PROTOCOL = 2
let ACCESS_POLL_S = 2.0
let SNAPSHOT_DEBOUNCE_S = 1.0

func accessStatus() -> String {
  switch EKEventStore.authorizationStatus(for: .event) {
  case .notDetermined: return "not-determined"
  case .restricted: return "restricted"
  case .denied: return "denied"
  case .authorized: return "granted"
  default:
    if #available(macOS 14.0, *) {
      switch EKEventStore.authorizationStatus(for: .event) {
      case .fullAccess: return "granted"
      case .writeOnly: return "write-only"
      default: break
      }
    }
    return "denied"
  }
}

func requestAccess() {
  let store = EKEventStore()
  let done = DispatchSemaphore(value: 0)
  if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { _, _ in done.signal() }
  } else {
    store.requestAccess(to: .event) { _, _ in done.signal() }
  }
  done.wait()
}

// ------------------------------------------------------------------------------------------ output

let stdoutLock = NSLock()

func send(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj, options: [.withoutEscapingSlashes])
  else { return }
  stdoutLock.lock()
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data([0x0A]))
  stdoutLock.unlock()
}

func log(_ level: String, _ message: String) {
  send(["type": "log", "level": level, "message": message])
}

let isoFormatter: ISO8601DateFormatter = {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  f.timeZone = TimeZone(identifier: "UTC")
  return f
}()

func iso(_ d: Date) -> String { isoFormatter.string(from: d) }

func localDate(_ d: Date) -> String {
  let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
  return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

func parseIso(_ s: String) -> Date? {
  if let d = isoFormatter.date(from: s) { return d }
  let plain = ISO8601DateFormatter()
  plain.formatOptions = [.withInternetDateTime]
  return plain.date(from: s)
}

// ------------------------------------------------------------------------------------------ mapping

func stripMailto(_ url: URL) -> String {
  let s = url.absoluteString
  return s.lowercased().hasPrefix("mailto:") ? String(s.dropFirst(7)) : s
}

func partstat(_ p: EKParticipantStatus) -> String? {
  switch p {
  case .accepted: return "ACCEPTED"
  case .declined: return "DECLINED"
  case .tentative: return "TENTATIVE"
  case .pending: return "NEEDS-ACTION"
  case .delegated: return "DELEGATED"
  default: return nil
  }
}

func status(_ s: EKEventStatus) -> String {
  switch s {
  case .confirmed: return "CONFIRMED"
  case .tentative: return "TENTATIVE"
  case .canceled: return "CANCELLED"
  default: return ""
  }
}

/** The iCalendar UID where the server has one (CalDAV, Exchange), else EventKit's own identifier. */
func uidOf(_ e: EKEvent) -> String {
  e.calendarItemExternalIdentifier ?? e.calendarItemIdentifier
}

func occurrence(_ e: EKEvent, calendarName: String) -> [String: Any] {
  let recurring = e.hasRecurrenceRules || e.isDetached
  let attendees = e.attendees ?? []
  let me = attendees.first(where: { $0.isCurrentUser })
  var o: [String: Any] = [
    "sourceUid": e.calendar.calendarIdentifier,
    "calendarName": calendarName,
    "uid": uidOf(e),
    "recurrenceId": recurring ? iso(e.occurrenceDate ?? e.startDate) : NSNull(),
    "summary": e.title ?? "",
    "description": e.notes ?? "",
    "location": e.location ?? "",
    "url": e.url?.absoluteString ?? "",
    "allDay": e.isAllDay,
    "timezone": e.isAllDay ? NSNull() : (e.timeZone?.identifier as Any? ?? NSNull()),
    "status": status(e.status),
    "myPartstat": me.flatMap { partstat($0.participantStatus) } as Any? ?? NSNull(),
    "organizer": e.organizer.map { stripMailto($0.url) } as Any? ?? NSNull(),
    "attendees": attendees.count,
    "recurring": recurring,
    "xprops": [String: String](),
  ]
  if e.isAllDay {
    // EventKit ends an all-day event at the last second of its last day: the protocol's end is exclusive
    let cal = Calendar.current
    let first = cal.startOfDay(for: e.startDate)
    let last = cal.startOfDay(for: max(e.endDate, e.startDate))
    let end = cal.date(byAdding: .day, value: 1, to: last) ?? last
    o["start"] = iso(first)
    o["end"] = iso(end)
    o["startDate"] = localDate(first)
    o["endDate"] = localDate(end)
  } else {
    o["start"] = iso(e.startDate)
    o["end"] = iso(max(e.endDate, e.startDate))
    o["startDate"] = NSNull()
    o["endDate"] = NSNull()
  }
  return o
}

// ------------------------------------------------------------------------------------------ agent

final class Agent {
  private var store: EKEventStore?
  private var window: (from: Date, to: Date)?
  private var granted = false
  private var lastDenial: String?
  private var debounce: DispatchWorkItem?

  func start() {
    send(["type": "hello", "protocol": PROTOCOL])
    checkAccess()
    Timer.scheduledTimer(withTimeInterval: ACCESS_POLL_S, repeats: true) { [weak self] _ in
      self?.checkAccess()
    }
  }

  private func checkAccess() {
    let s = accessStatus()
    if s == "granted" {
      if granted { return }
      granted = true
      lastDenial = nil
      // a store made before the grant keeps seeing nothing: start a fresh one
      let st = EKEventStore()
      store = st
      NotificationCenter.default.addObserver(
        forName: .EKEventStoreChanged, object: st, queue: .main
      ) { [weak self] _ in self?.scheduleSnapshot() }
      send(["type": "access", "granted": true, "detail": NSNull()])
      snapshot()
      return
    }
    if granted {
      granted = false
      store = nil
    }
    let detail =
      s == "not-determined"
      ? "kacola has not been allowed to read your calendars yet"
      : "calendar access is turned off for kacola in System Settings › Privacy & Security › Calendars"
    if detail != lastDenial {
      lastDenial = detail
      send(["type": "access", "granted": false, "detail": detail])
    }
  }

  private func scheduleSnapshot() {
    debounce?.cancel()
    let w = DispatchWorkItem { [weak self] in self?.snapshot() }
    debounce = w
    DispatchQueue.main.asyncAfter(deadline: .now() + SNAPSHOT_DEBOUNCE_S, execute: w)
  }

  private func calendarNames(_ calendars: [EKCalendar]) -> [String: String] {
    var count: [String: Int] = [:]
    for c in calendars { count[c.title, default: 0] += 1 }
    var out: [String: String] = [:]
    for c in calendars {
      let source = c.source?.title ?? ""
      out[c.calendarIdentifier] =
        (count[c.title] ?? 0) > 1 && !source.isEmpty && source != c.title
        ? "\(c.title) (\(source))" : c.title
    }
    return out
  }

  func snapshot() {
    guard let store, let window, granted else { return }
    let calendars = store.calendars(for: .event)
    let names = calendarNames(calendars)
    var occurrences: [[String: Any]] = []
    // EventKit answers at most four years per predicate: walk longer windows in steps
    var from = window.from
    var seen = Set<String>()
    while from < window.to {
      let to = min(window.to, Calendar.current.date(byAdding: .year, value: 3, to: from) ?? window.to)
      let events = store.events(matching: store.predicateForEvents(withStart: from, end: to, calendars: calendars))
      for e in events {
        let key = "\(e.calendarItemIdentifier)|\(e.startDate.timeIntervalSince1970)"
        if !seen.insert(key).inserted { continue }
        occurrences.append(occurrence(e, calendarName: names[e.calendar.calendarIdentifier] ?? e.calendar.title))
      }
      from = to
    }
    occurrences.sort {
      let a = $0["start"] as? String ?? "", b = $1["start"] as? String ?? ""
      return a != b ? a < b : ($0["uid"] as? String ?? "") < ($1["uid"] as? String ?? "")
    }
    send([
      "type": "snapshot",
      "from": iso(window.from),
      "to": iso(window.to),
      "calendars": calendars.map { ["id": $0.calendarIdentifier, "name": names[$0.calendarIdentifier] ?? $0.title] },
      "occurrences": occurrences,
      "offline": [[String: Any]](),
    ])
  }

  private func findEvent(_ m: [String: Any]) -> EKEvent? {
    guard let store, let uid = m["uid"] as? String else { return nil }
    let items = store.calendarItems(withExternalIdentifier: uid).compactMap { $0 as? EKEvent }
    if let source = m["sourceUid"] as? String, let hit = items.first(where: { $0.calendar.calendarIdentifier == source }) {
      return hit
    }
    return items.first ?? (store.calendarItem(withIdentifier: uid) as? EKEvent)
  }

  func handle(_ m: [String: Any]) {
    switch m["type"] as? String {
    case "window":
      guard let f = (m["from"] as? String).flatMap(parseIso), let t = (m["to"] as? String).flatMap(parseIso)
      else {
        send(["type": "error", "message": "window needs ISO from and to", "fatal": false])
        return
      }
      window = (f, t)
      snapshot()
    case "refresh":
      checkAccess()
      store?.refreshSourcesIfNecessary()
      snapshot()
    case "read-description":
      let requestId = m["requestId"] as? String ?? ""
      if let e = findEvent(m) {
        send([
          "type": "description", "requestId": requestId, "ok": true, "description": e.notes ?? "",
          "writable": false, "reason": "kacola cannot write to macOS Calendar events yet",
        ])
      } else {
        send([
          "type": "description", "requestId": requestId, "ok": false, "description": "",
          "writable": false, "reason": granted ? "the event was not found" : "calendar access is not granted",
        ])
      }
    case "write-description":
      send([
        "type": "description-written", "requestId": m["requestId"] as? String ?? "", "ok": false,
        "changed": false, "reason": "kacola cannot write to macOS Calendar events yet",
      ])
    default:
      log("warn", "unknown message \(m["type"] as? String ?? "?")")
    }
  }
}

func runAgent() -> Never {
  let agent = Agent()
  agent.start()
  Thread.detachNewThread {
    while let line = readLine(strippingNewline: true) {
      guard !line.isEmpty, let data = line.data(using: .utf8),
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      else {
        if !line.isEmpty {
          send(["type": "error", "message": "unreadable line from the daemon", "fatal": false])
        }
        continue
      }
      DispatchQueue.main.async { agent.handle(obj) }
    }
    // the daemon closed our stdin: it went away
    exit(0)
  }
  RunLoop.main.run()
  exit(0)
}

switch CommandLine.arguments.dropFirst().first {
case "--status":
  print(accessStatus())
case "--request":
  if accessStatus() == "not-determined" { requestAccess() }
  print(accessStatus())
case nil:
  runAgent()
case let other?:
  FileHandle.standardError.write("usage: kacola-cal-agent [--status | --request] (got \(other))\n".data(using: .utf8)!)
  exit(2)
}
