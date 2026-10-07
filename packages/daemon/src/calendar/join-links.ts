import type { JoinLink, MeetingProvider } from '@kacola/protocol'

// C-1: finding the "join" link of a meeting. Invitations put it in different places depending on who
// sent them — Google in an X-GOOGLE-CONFERENCE property and the description, Outlook/Teams in an HTML
// description behind `<https://…>` and sometimes a SafeLinks redirect, Zoom in the location, Webex in
// URL — so every field is searched, most authoritative first:
//
//   conference X- properties → URL property → LOCATION → DESCRIPTION
//
// Within that order a recognised conferencing link always beats an unrecognised one, and an
// unrecognised plain https link counts only when it is the *whole* URL property or location (a
// description is full of links to agendas and documents that are not the meeting).

type Pattern = { provider: Exclude<MeetingProvider, 'other'>; host: RegExp; path: RegExp }

// Hosts are matched on the parsed hostname; paths on the pathname. Paths are what separates a meeting
// from a homepage or a help article on the same host.
const PATTERNS: Pattern[] = [
  {
    provider: 'meet',
    host: /^meet\.google\.com$/,
    path: /^\/(?:[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}|lookup\/[\w-]+)\/?$/,
  },
  {
    provider: 'zoom',
    host: /^(?:[\w-]+\.)*zoom(?:gov)?\.(?:us|com)$/,
    path: /^\/(?:j|w|s|wc(?:\/join)?|my)\/[\w.-]+|^\/wc\/\d+\/join/,
  },
  {
    provider: 'teams',
    host: /^teams\.(?:microsoft|live)\.com$/,
    path: /^\/(?:l\/meetup-join\/|meet\/|dl\/launcher\/)/,
  },
  {
    provider: 'webex',
    host: /^(?:[\w-]+\.)*webex\.com$/,
    path: /(?:\/j\.php$|\/meet\/|\/joinservice\/|\/wbxmjs\/|^\/[\w.-]+\/j\.php)/,
  },
  { provider: 'jitsi', host: /^meet\.jit\.si$/, path: /^\/[^/]+/ },
  { provider: 'whereby', host: /^(?:[\w-]+\.)?whereby\.com$/, path: /^\/[^/]+/ },
]

/** The conference X- properties, most specific first. */
const CONFERENCE_XPROPS = [
  'X-GOOGLE-CONFERENCE',
  'X-MICROSOFT-SKYPETEAMSMEETINGURL',
  'X-MICROSOFT-ONLINEMEETINGCONFLINK',
  'X-MICROSOFT-ONLINEMEETINGEXTERNALLINK',
  'X-ZOOM-JOIN-URL',
]

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Decode the HTML entities invitation bodies use (`&amp;` above all, which breaks query strings). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Every http(s) URL in a text, in order, cleaned of the punctuation prose and markup wrap them in. */
export function findUrls(text: string): string[] {
  const out: string[] = []
  const decoded = decodeEntities(text)
  for (const m of decoded.matchAll(/https?:\/\/[^\s<>"'`{}|\\^]+/gi)) {
    let u = m[0]
    // trailing sentence punctuation / closing brackets that are not part of the URL
    for (;;) {
      const last = u.at(-1)
      if (last && '.,;:!?'.includes(last)) u = u.slice(0, -1)
      else if (last === ')' && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0))
        u = u.slice(0, -1)
      else if (last === ']' && !u.includes('[')) u = u.slice(0, -1)
      else break
    }
    out.push(u)
  }
  return out
}

/** Unwrap the redirectors mail and calendar clients put around links. */
export function unwrap(url: string): string {
  let u = url
  for (let i = 0; i < 3; i++) {
    let parsed: URL
    try {
      parsed = new URL(u)
    } catch {
      return u
    }
    const host = parsed.hostname.toLowerCase()
    const inner =
      host.endsWith('safelinks.protection.outlook.com') || host.endsWith('safelinks.protection.office365.us')
        ? parsed.searchParams.get('url')
        : (host === 'www.google.com' || host === 'google.com') && parsed.pathname === '/url'
          ? (parsed.searchParams.get('q') ?? parsed.searchParams.get('url'))
          : null
    if (!inner || !/^https?:\/\//i.test(inner)) return u
    u = inner
  }
  return u
}

/** The conferencing provider of a URL, or null if it is not a recognised meeting link. */
export function classify(url: string): Exclude<MeetingProvider, 'other'> | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const host = parsed.hostname.toLowerCase()
  for (const p of PATTERNS) if (p.host.test(host) && p.path.test(parsed.pathname)) return p.provider
  return null
}

/** Canonical form handed to the desktop: no fragment, and https for the services that all serve it.
 *  Query strings (Zoom's pwd=) are kept. */
function normalise(url: string, https = true): string {
  const u = new URL(url)
  if (https) u.protocol = 'https:'
  u.hash = ''
  return u.toString()
}

export type JoinSources = {
  xprops?: Record<string, string>
  url?: string
  location?: string
  description?: string
}

/** The meeting's join link, or null if it has none. */
export function extractJoinLink(src: JoinSources): JoinLink | null {
  const xprops = Object.entries(src.xprops ?? {})
  const upper = new Map(xprops.map(([k, v]) => [k.toUpperCase(), v]))
  const conference = [
    ...CONFERENCE_XPROPS.map((k) => upper.get(k)).filter((v): v is string => !!v),
    // any other X- property that carries a conferencing link
    ...xprops.filter(([k]) => !CONFERENCE_XPROPS.includes(k.toUpperCase())).map(([, v]) => v),
  ]
  const fields: { text: string; wholeFieldCounts: boolean }[] = [
    ...conference.map((text) => ({ text, wholeFieldCounts: false })),
    { text: src.url ?? '', wholeFieldCounts: true },
    { text: src.location ?? '', wholeFieldCounts: true },
    { text: src.description ?? '', wholeFieldCounts: false },
  ]
  // 1. a recognised conferencing link, anywhere, most authoritative field first
  for (const f of fields) {
    for (const raw of findUrls(f.text)) {
      const u = unwrap(raw)
      const provider = classify(u)
      if (provider) return { url: normalise(u), provider }
    }
  }
  // 2. an unrecognised link that IS the url / location field (e.g. a self-hosted BigBlueButton room)
  for (const f of fields) {
    if (!f.wholeFieldCounts) continue
    const t = decodeEntities(f.text).trim()
    const urls = findUrls(t)
    if (urls.length === 1 && t.startsWith(urls[0]!) && t.length - urls[0]!.length <= 1) {
      const u = unwrap(urls[0]!)
      try {
        return { url: normalise(u, false), provider: 'other' }
      } catch {
        return null
      }
    }
  }
  return null
}
