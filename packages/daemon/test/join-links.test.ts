import { describe, expect, it } from 'vitest'
import { classify, decodeEntities, extractJoinLink, findUrls, unwrap } from '../src/calendar/join-links.ts'

// C-1: join-link extraction over the shapes real invitations actually arrive in. Every fixture below is
// modelled on an invitation body as the sending service writes it (ids and passwords made up).

const TEAMS_URL =
  'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzY2ZjE0MjAtYjM0Ny00ZGQ5LWE0N2EtMGY5ZTFkNzM3ZmQ1%40thread.v2/0?context=%7b%22Tid%22%3a%2272f988bf-86f1-41af-91ab-2d7cd011db47%22%2c%22Oid%22%3a%22c1a5d5c2-6e0b-4ab5-9f0b-1f2e1b1a1c1d%22%7d'

const TEAMS_DESCRIPTION = `________________________________________________________________________________
Microsoft Teams meeting
Join on your computer, mobile app or room device
Click here to join the meeting<${TEAMS_URL}>
Meeting ID: 312 845 991 202
Passcode: 7hJx3b
Download Teams<https://www.microsoft.com/en-us/microsoft-teams/download-app> | Join on the web<https://www.microsoft.com/microsoft-teams/join-a-meeting>
Learn More<https://aka.ms/JoinTeamsMeeting> | Meeting options<https://teams.microsoft.com/meetingOptions/?organizerId=c1a5&tenantId=72f9&threadId=19_meeting_NzY2&messageId=0&language=en-US>
________________________________________________________________________________`

const GOOGLE_DESCRIPTION = `Weekly sync on the migration.

-::~:~::~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~::~:~::-
Join with Google Meet: https://meet.google.com/xqc-bnvd-kpt
Or dial: ‪(US) +1 347-305-2091‬ PIN: ‪917 552 883‬#
More phone numbers: https://tel.meet/xqc-bnvd-kpt?pin=4412874113519

Learn more about Meet at: https://support.google.com/a/users/answer/9282720

Please do not edit this section.
-::~:~::~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~::~:~::-`

const ZOOM_HTML = `<p>Hi there,</p><p>Kacper is inviting you to a scheduled Zoom meeting.</p>
<p>Join Zoom Meeting<br><a href="https://us02web.zoom.us/j/84518302211?pwd=aXk2dVZ1cDFrR0x3bnZ3Rk1hZz09&amp;from=addon">https://us02web.zoom.us/j/84518302211?pwd=aXk2dVZ1cDFrR0x3bnZ3Rk1hZz09&amp;from=addon</a></p>
<p>Meeting ID: 845 1830 2211<br>Passcode: 123456</p>`

describe('findUrls', () => {
  it('strips the punctuation and brackets that prose and markup put around links', () => {
    expect(
      findUrls('see (https://example.com/a), then <https://example.com/b>. And https://x.org/y?z=1!'),
    ).toEqual(['https://example.com/a', 'https://example.com/b', 'https://x.org/y?z=1'])
  })
  it('keeps balanced parentheses that belong to the URL', () => {
    expect(findUrls('https://en.wikipedia.org/wiki/Foo_(bar) done')).toEqual([
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    ])
  })
  it('decodes entities first, so query strings survive HTML bodies', () => {
    expect(findUrls('<a href="https://a.io/j?x=1&amp;y=2">')).toEqual(['https://a.io/j?x=1&y=2'])
    expect(decodeEntities('&lt;&#65;&#x42;&gt; &bogus;')).toBe('<AB> &bogus;')
  })
})

describe('unwrap', () => {
  it('unwraps Outlook SafeLinks and Google redirects, nested', () => {
    const safe = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent('https://us06web.zoom.us/j/81234567890?pwd=abc')}&data=05%7C01&sdata=x&reserved=0`
    expect(unwrap(safe)).toBe('https://us06web.zoom.us/j/81234567890?pwd=abc')
    const google = `https://www.google.com/url?q=${encodeURIComponent(safe)}&sa=D&source=calendar`
    expect(unwrap(google)).toBe('https://us06web.zoom.us/j/81234567890?pwd=abc')
    expect(unwrap('https://example.com/?url=https://evil.example')).toBe(
      'https://example.com/?url=https://evil.example',
    )
  })
})

describe('classify', () => {
  it.each([
    ['https://meet.google.com/abc-defg-hij', 'meet'],
    ['https://meet.google.com/abc-defg-hij?authuser=1&hs=179', 'meet'],
    ['https://meet.google.com/lookup/ahcdmlsk3r', 'meet'],
    ['https://zoom.us/j/1234567890', 'zoom'],
    ['https://us02web.zoom.us/j/84518302211?pwd=abc', 'zoom'],
    ['https://acme.zoom.us/my/kacper', 'zoom'],
    ['https://acme.zoom.us/w/99988877766?tk=abc', 'zoom'],
    ['https://zoom.us/wc/join/1234567890', 'zoom'],
    ['https://acme.zoomgov.com/j/1601234567', 'zoom'],
    [TEAMS_URL, 'teams'],
    ['https://teams.microsoft.com/meet/2548930211287?p=AbCdEfGh', 'teams'],
    ['https://teams.live.com/meet/9876543210123?p=xyz', 'teams'],
    ['https://acme.webex.com/acme/j.php?MTID=m1a2b3c4d5e6f', 'webex'],
    ['https://acme.webex.com/meet/kacper', 'webex'],
    ['https://acme.webex.com/wbxmjs/joinservice/sites/acme/meeting/download/abc', 'webex'],
    ['https://meet.jit.si/KacolaStandup', 'jitsi'],
    ['https://whereby.com/kacola', 'whereby'],
  ])('%s → %s', (url, provider) => {
    expect(classify(url)).toBe(provider)
  })
  it.each([
    'https://meet.google.com/',
    'https://support.google.com/a/users/answer/9282720',
    'https://zoom.us/',
    'https://zoom.us/pricing',
    'https://www.microsoft.com/microsoft-teams/join-a-meeting',
    'https://teams.microsoft.com/meetingOptions/?organizerId=1',
    'https://aka.ms/JoinTeamsMeeting',
    'https://www.webex.com/downloads.html',
    'https://notzoom.us.evil.example/j/1',
    'https://zoom.us.evil.example/j/1',
    'ftp://zoom.us/j/1',
    'not a url',
  ])('%s is not a meeting link', (url) => {
    expect(classify(url)).toBeNull()
  })
})

describe('extractJoinLink', () => {
  it('Google: prefers X-GOOGLE-CONFERENCE, and finds Meet in the generated description', () => {
    expect(
      extractJoinLink({
        xprops: { 'X-GOOGLE-CONFERENCE': 'https://meet.google.com/xqc-bnvd-kpt' },
        description: GOOGLE_DESCRIPTION,
      }),
    ).toEqual({ url: 'https://meet.google.com/xqc-bnvd-kpt', provider: 'meet' })
    expect(extractJoinLink({ description: GOOGLE_DESCRIPTION })).toEqual({
      url: 'https://meet.google.com/xqc-bnvd-kpt',
      provider: 'meet',
    })
  })

  it('Teams: the meetup-join link out of the angle-bracketed Outlook body, not the help links', () => {
    expect(extractJoinLink({ description: TEAMS_DESCRIPTION })).toEqual({
      url: TEAMS_URL,
      provider: 'teams',
    })
    expect(
      extractJoinLink({
        xprops: { 'X-MICROSOFT-SKYPETEAMSMEETINGURL': TEAMS_URL },
        location: 'Microsoft Teams Meeting',
      }),
    ).toEqual({ url: TEAMS_URL, provider: 'teams' })
  })

  it('Zoom: an HTML description with &amp; in the query string', () => {
    expect(extractJoinLink({ description: ZOOM_HTML })).toEqual({
      url: 'https://us02web.zoom.us/j/84518302211?pwd=aXk2dVZ1cDFrR0x3bnZ3Rk1hZz09&from=addon',
      provider: 'zoom',
    })
  })

  it('Zoom in the location, behind a SafeLink', () => {
    const inner = 'https://us06web.zoom.us/j/81234567890?pwd=Zm9v'
    expect(
      extractJoinLink({
        location: `https://nam12.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}&data=05`,
      }),
    ).toEqual({ url: inner, provider: 'zoom' })
  })

  it('Webex in the URL property', () => {
    expect(extractJoinLink({ url: 'https://acme.webex.com/acme/j.php?MTID=m0123456789abcdef' })).toEqual({
      url: 'https://acme.webex.com/acme/j.php?MTID=m0123456789abcdef',
      provider: 'webex',
    })
  })

  it('field order: a conferencing link in the location beats one in the description', () => {
    expect(
      extractJoinLink({
        location: 'https://meet.google.com/aaa-bbbb-ccc',
        description: 'old link: https://zoom.us/j/111',
      }),
    ).toEqual({ url: 'https://meet.google.com/aaa-bbbb-ccc', provider: 'meet' })
  })

  it('a recognised link anywhere beats an unrecognised one in the location', () => {
    expect(
      extractJoinLink({
        location: 'https://intranet.example/rooms/4b',
        description: 'Join: https://meet.google.com/aaa-bbbb-ccc',
      }),
    ).toEqual({ url: 'https://meet.google.com/aaa-bbbb-ccc', provider: 'meet' })
  })

  it('an unrecognised link counts only when it is the whole location or URL', () => {
    expect(extractJoinLink({ location: 'https://bbb.example.org/b/kac-x2f-9pq' })).toEqual({
      url: 'https://bbb.example.org/b/kac-x2f-9pq',
      provider: 'other',
    })
    expect(extractJoinLink({ location: 'Room 4B, see https://intranet.example/map' })).toBeNull()
    expect(extractJoinLink({ description: 'Agenda: https://docs.example/agenda' })).toBeNull()
  })

  it('normalises: https, no fragment, query kept', () => {
    expect(extractJoinLink({ location: 'http://zoom.us/j/123?pwd=x#success' })).toEqual({
      url: 'https://zoom.us/j/123?pwd=x',
      provider: 'zoom',
    })
  })

  it('no link at all', () => {
    expect(extractJoinLink({})).toBeNull()
    expect(extractJoinLink({ location: 'Room 4B', description: 'Bring snacks.' })).toBeNull()
  })
})
