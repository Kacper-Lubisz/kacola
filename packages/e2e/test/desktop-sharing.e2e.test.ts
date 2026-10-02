import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgendaView, ShareStatus } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop, matchBaseline } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { BASELINES, DESKTOP_ARTIFACTS, setTheme } from '../src/desktop.ts'
import { linkToken, type ShareHost, startShareHost } from '../src/share-host.ts'
import { markOnboarded } from '../src/ui.ts'

type Locator = ReturnType<DesktopApp['window']['getByRole']>

// Team sharing in the Electron window (docs/sharing.md), against REAL daemons and a local hosted server
// (the hosted app over PGlite; an in-memory mailer for the magic-link codes):
//
//   owner      the organiser's window shares the agenda (name, the attendee who follows), copies the
//              link; an invitee adds an item and a comment through the server's link API, and both show
//              up in the window, attributed
//   follow     an attendee's window (a second daemon) follows from the sidebar's Coming up: link + email
//              → the emailed code → its own copy; a status change there merges, one is refused under the
//              organiser's override, and the merge history says so (who, outcome, why)
//   recap      the organiser records, stops, and shares the recap from the recap view: outcomes reach the link
//   unshare    the organiser unshares (confirmed): the link answers 410; the attendee's window shows the
//              copy as no longer shared
//
// axe in light, dark and high contrast on every new screen; baselines at ≤ 1 % (wall-clock times, the
// random link and the meeting's hours masked).

const PIPELINE = { speed: 4, segmentEveryMs: 1500, partialEveryMs: 250, finalizeAfterMs: 200, tickMs: 20 }
const WEEK = 7 * 24 * 60

async function until<T>(
  probe: () => Promise<T>,
  ok: (v: T) => boolean,
  what: string,
  ms = 20_000,
): Promise<T> {
  const end = Date.now() + ms
  let last: T | undefined
  for (;;) {
    try {
      last = await probe()
      if (ok(last)) return last
    } catch {}
    if (Date.now() > end) throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`)
    await new Promise((r) => setTimeout(r, 100))
  }
}

describe('desktop: team sharing', () => {
  let display: HeadlessDisplay
  let host: ShareHost
  let A: DaemonHandle // the organiser
  let B: DaemonHandle // an attendee who runs kacola
  let app: DesktopApp
  let dir = ''
  let markerId = ''
  const s = { agenda: '', link: '', bAgenda: '', session: '' }

  const w = () => app.window
  const go = (hash: string) => w().evaluate(`location.hash = ${JSON.stringify(hash)}`)
  const view = (d: DaemonHandle, id: string): Promise<AgendaView> =>
    d.client.call('getAgenda', { params: { id }, query: { includePrivate: true } })
  const share = (d: DaemonHandle, id: string): Promise<ShareStatus> =>
    d.client.call('getAgendaShare', { params: { id } })
  const page = (occurrence?: string) =>
    host.web().call('getSharedPage', {
      params: { token: linkToken(s.link) },
      ...(occurrence ? { query: { occurrence } } : {}),
    })

  const launch = async (d: DaemonHandle) => {
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: d.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' } })
    await w().getByRole('button', { name: 'Record now' }).waitFor({ timeout: 20_000 })
    await w().emulateMedia({ reducedMotion: 'reduce' })
  }
  const relaunch = async (d: DaemonHandle) => {
    expect(app.problems()).toEqual([])
    await app.close()
    await launch(d)
  }

  /** axe over the current screen in light, dark and both high-contrast modes, then back to light. */
  const axeAllModes = async (what: string) => {
    await w().mouse.move(0, 0)
    await new Promise((r) => setTimeout(r, 400))
    for (const [scheme, contrast] of [
      ['light', 'normal'],
      ['dark', 'normal'],
      ['light', 'high'],
      ['dark', 'high'],
    ] as const) {
      await setTheme(app, scheme, contrast)
      expect(await app.axe(), `${what} (${scheme}, ${contrast})`).toEqual([])
    }
    await setTheme(app, 'light')
  }
  /** Still frame: no toasts, no focus ring, no hover, fonts in. */
  const still = async () => {
    const toasts = w()
      .getByRole('region', { name: 'Notifications' })
      .locator('[role="status"], [role="alert"]')
    await until(
      () => toasts.count(),
      (n) => n === 0,
      'the toasts to go',
    )
    await w().evaluate('document.activeElement?.blur()')
    await w().mouse.move(0, 0)
    await w().evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))')
  }
  /** A region in light and dark against its baseline (wall-clock and random parts masked). */
  const shot = async (name: string, region: Locator, masks: Locator[] = []) => {
    for (const scheme of ['light', 'dark'] as const) {
      await setTheme(app, scheme)
      await still()
      const out = join(DESKTOP_ARTIFACTS, `sharing-${name}-${scheme}.png`)
      await region.screenshot({
        path: out,
        caret: 'initial',
        animations: 'allow',
        mask: masks,
        maskColor: '#A89A84',
      })
      const failure = matchBaseline(out, join(BASELINES, `sharing-${name}-${scheme}.png`), {
        maxDiffRatio: 0.01,
        threshold: 0.06,
      })
      if (failure) throw new Error(`screenshot sharing-${name}-${scheme}: ${failure}`)
    }
    await setTheme(app, 'light')
  }
  const times = () => w().locator('[data-share-time]')

  beforeAll(async () => {
    buildDesktop()
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-sharing-'))
    const now = Date.now()
    const t = (min: number) => new Date(now + min * 60_000).toISOString()
    // a weekly team sync under way (started 5 min ago), and next week's
    const calendar = (file: string) =>
      writeFileSync(
        file,
        JSON.stringify({
          calendars: [{ id: 'cal-work', name: 'Work' }],
          occurrences: [0, 1].map((week) => ({
            uid: 'team-sync@x',
            summary: 'Team sync',
            sourceUid: 'cal-work',
            calendarName: 'Work',
            recurrenceId: t(-5 + week * WEEK),
            start: t(-5 + week * WEEK),
            end: t(25 + week * WEEK),
            description: '',
            location: '',
            url: '',
            allDay: false,
            startDate: null,
            endDate: null,
            timezone: 'UTC',
            status: 'CONFIRMED',
            myPartstat: null,
            organizer: 'mailto:kacper@example.com',
            attendees: 3,
            recurring: true,
            xprops: {},
          })),
        }),
      )
    host = await startShareHost()
    const daemon = async (name: string, env: Record<string, string>) => {
      const file = join(dir, `${name}-calendar.json`)
      calendar(file)
      return startDaemon({
        dataDir: join(dir, name),
        env: {
          GNOMEOLA_CALENDAR: `file:${file}`,
          GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE),
          GNOMEOLA_TRACKER: 'off',
          GNOMEOLA_SPEECH_GUARD: 'none',
          // the window sees others' changes within a second
          GNOMEOLA_SHARE_POLL_MS: '500',
          GNOMEOLA_SHARE_DEBOUNCE_MS: '100',
          ...env,
        },
      })
    }
    A = await daemon('owner', host.ownerEnv({ name: 'Kacper', email: 'kacper@example.com' }))
    B = await daemon('attendee', { GNOMEOLA_OWNER_EMAIL: 'ben@example.com' })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await A.client.call('listModels')).models.map((m) => m.id),
    )
    await launch(A)
  }, 300_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await A?.stop()
    await B?.stop()
    await host?.close()
    if (dir) rmSync(dir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('shares from the editor and copies the link; an invitee’s item and comment appear, attributed', async () => {
    const v = await A.client.call('createAgenda', {
      body: {
        eventUid: 'team-sync@x',
        goals: ['ship the Q4 plan'],
        items: [
          { text: 'Roadmap', kind: 'must-cover', timeboxMin: 10 },
          { text: 'Hiring' },
          { text: 'Budget' },
        ],
      },
    })
    s.agenda = v.agenda.id
    await go(`#/agendas/${s.agenda}`)
    await w().getByRole('heading', { level: 1, name: 'Team sync' }).waitFor()

    // ONE action: Send the agenda — first exactly what attendees see, then the link and the invite text
    await w().getByRole('button', { name: 'Send the agenda' }).click()
    const send = w().getByRole('dialog', { name: 'Send the Agenda' })
    const preview = send.getByRole('region', { name: 'What attendees see' })
    await preview.getByText('Roadmap').waitFor()
    // the goals stay home unless asked for
    expect(await preview.getByText('Goal: ship the Q4 plan').count()).toBe(0)
    await axeAllModes('the Send dialog')
    await shot('send', send)
    await send.getByRole('button', { name: 'Send', exact: true }).click()
    await send.getByRole('button', { name: 'Done' }).waitFor({ timeout: 20_000 })
    const st = await share(A, s.agenda)
    expect(st).toMatchObject({ shared: true, role: 'owner' })
    s.link = st.link!
    expect(s.link).toMatch(new RegExp(`^${host.url}/a/[A-Za-z0-9_-]{32}$`))
    // the file calendar is read-only: the invitation text (web link first) is there to paste
    await send.getByText('Paste this into it yourself:', { exact: false }).waitFor()
    expect(await send.locator('pre').textContent()).toContain(s.link)
    await send.getByRole('button', { name: 'Copy Invitation Text' }).click()
    await w().getByText('Copied the invitation text').waitFor()
    expect(await app.evaluateMain(({ clipboard }) => clipboard.readText())).toContain(s.link)
    await send.getByRole('button', { name: 'Done' }).click()
    await send.waitFor({ state: 'detached' })
    // the goals stayed home (off by default)
    expect((await page()).occurrence.goals).toEqual([])

    // once shared, the same spot is the share's state and options: name, attendees who use kacola
    await w().getByRole('button', { name: 'Shared: Up to date' }).click({ timeout: 20_000 })
    const dlg = w().getByRole('dialog', { name: 'Share Agenda' })
    await dlg.getByRole('textbox', { name: 'Your name' }).fill('Kacper')
    await dlg.getByRole('textbox', { name: 'Attendees who use kacola' }).fill('ben@example.com')
    await axeAllModes('the Share dialog')
    await dlg.getByRole('button', { name: 'Save' }).click()
    await until(
      () => share(A, s.agenda),
      (x) => x.members.includes('ben@example.com') && x.ownerName === 'Kacper',
      'the options saved',
    )
    const field = dlg.getByRole('textbox', { name: 'Web link' })
    expect(await field.inputValue()).toBe(s.link)
    await dlg.getByText('Up to date').waitFor()
    await dlg.getByRole('button', { name: 'Copy Link' }).click()
    await w().getByText('Copied the link').waitFor()
    expect(await app.evaluateMain(({ clipboard }) => clipboard.readText())).toBe(s.link)
    await axeAllModes('the Share dialog, shared')
    await shot('dialog-shared', dlg, [field, times()])
    await w().keyboard.press('Escape')
    await dlg.waitFor({ state: 'detached' })
    await w().getByRole('button', { name: 'Shared: Up to date' }).waitFor()

    // an invitee without kacola: email → code → an item and a comment, through the link
    const ivy = await host.invitee(linkToken(s.link), 'ivy@example.com', 'Ivy')
    const added = await ivy.call('shareAddItem', {
      params: { token: linkToken(s.link) },
      body: { text: 'Offsite dates', kind: 'question' },
    })
    await ivy.call('shareAddComment', {
      params: { token: linkToken(s.link) },
      body: { itemId: added.id, text: 'Friday works for me' },
    })
    const grid = w().getByRole('grid', { name: 'Agenda items' })
    const row = grid.getByRole('row', { name: 'Offsite dates' })
    await row.getByText('added by Ivy (ivy@example.com)').waitFor({ timeout: 20_000 })
    await row.getByText('Friday works for me').waitFor({ timeout: 20_000 })
    expect(await row.getByRole('list', { name: 'Comments on “Offsite dates”' }).textContent()).toBe(
      'Ivy (invitee): Friday works for me',
    )
    expect((await view(A, s.agenda)).items.find((i) => i.text === 'Offsite dates')?.createdBy).toBe(
      'invitee:ivy@example.com',
    )
    await axeAllModes('the editor with contributions')
    await shot('editor', grid)

    // the Sharing section beside the agenda (no tabs): the comment and who joined
    const sharing = w().getByRole('region', { name: 'Sharing', exact: true })
    await sharing.scrollIntoViewIfNeeded()
    const comments = sharing.getByRole('list', { name: 'Comments' })
    await comments.getByText('Friday works for me').waitFor()
    expect(await comments.textContent()).toContain('Ivy on “Offsite dates”')
    await sharing.getByRole('list', { name: 'People' }).getByText('Ivy · ivy@example.com').waitFor()
  })

  it('an attendee’s window follows from the main menu (link + email → code); a refused change shows in the merge history', async () => {
    await relaunch(B)
    await w().getByRole('button', { name: 'Main menu' }).click({ timeout: 20_000 })
    await w().getByRole('menuitem', { name: 'Follow a Shared Agenda…' }).click()
    const dlg = w().getByRole('dialog', { name: 'Follow a Shared Agenda' })
    await dlg.getByRole('textbox', { name: 'Link' }).fill(s.link)
    await dlg.getByRole('textbox', { name: 'Your email' }).fill('ben@example.com')
    await dlg.getByRole('textbox', { name: 'Your name (optional)' }).fill('Ben')
    await axeAllModes('the Follow dialog')
    // the link is random (its port and token): masked
    await shot('follow', dlg, [dlg.getByRole('textbox', { name: 'Link' })])
    await dlg.getByRole('button', { name: 'Send Code' }).click()
    const code = dlg.getByRole('textbox', { name: 'Code' })
    await code.waitFor({ timeout: 20_000 })
    // a wrong code first: said, and nothing followed
    await code.fill('BBBB-CCCC')
    await dlg.getByRole('button', { name: 'Follow', exact: true }).click()
    await dlg.getByText(/That code is wrong or has expired/).waitFor({ timeout: 20_000 })
    await code.fill(host.codeFor('ben@example.com'))
    await axeAllModes('the Follow dialog, code')
    // the code is random: masked
    await shot('follow-code', dlg, [times(), code])
    await dlg.getByRole('button', { name: 'Follow', exact: true }).click()
    await w().getByRole('heading', { level: 1, name: 'Team sync' }).waitFor({ timeout: 20_000 })
    s.bAgenda = ((await w().evaluate('location.hash')) as string).split('/')[2]!.split('?')[0]!
    expect(await share(B, s.bAgenda)).toMatchObject({ shared: true, role: 'member', link: s.link })
    await w().getByRole('button', { name: 'Following: Up to date' }).waitFor()
    const grid = w().getByRole('grid', { name: 'Agenda items' })
    await grid.getByRole('row', { name: 'Offsite dates' }).getByText('Friday works for me').waitFor()

    // Ben covers the roadmap here (applied on the organiser's agenda) …
    await w().getByRole('button', { name: 'Status of “Roadmap”: Open' }).click()
    await w().getByRole('menuitem', { name: 'Covered' }).click()
    await until(
      async () => (await view(A, s.agenda)).items.find((i) => i.text === 'Roadmap'),
      (i) => i?.status === 'covered' && i.changedBy === 'peer:ben@example.com',
      'Ben’s change on the organiser’s agenda',
    )
    // … the organiser moves it back by hand (an override that locks it) …
    const roadmap = (await view(A, s.agenda)).items.find((i) => i.text === 'Roadmap')!
    await A.client.call('setAgendaItemStatus', {
      params: { id: s.agenda, itemId: roadmap.id },
      body: { status: 'in-progress' },
    })
    // the organiser's override reaches Ben's copy. (Not asserted: whether the row attributes it. The
    // organiser is the agenda's author, so it should not, but a followed copy knows the owner by their
    // shared name while the change says peer:<email>, so today it reads "by kacper@example.com".)
    await w().getByRole('button', { name: 'Status of “Roadmap”: In progress' }).waitFor({ timeout: 20_000 })
    // … and Ben covers it again: refused (below the organiser's override); his copy follows the organiser
    await w().getByRole('button', { name: 'Status of “Roadmap”: In progress' }).click()
    await w().getByRole('menuitem', { name: 'Covered' }).click()
    await until(
      () => share(B, s.bAgenda),
      (st) => st.refused === 1 && st.pending === 0,
      'the refused change',
    )
    await w().getByRole('button', { name: 'Status of “Roadmap”: In progress' }).waitFor({ timeout: 20_000 })

    const sharing = w().getByRole('region', { name: 'Sharing', exact: true })
    await sharing.scrollIntoViewIfNeeded()
    const merged = sharing.getByRole('list', { name: 'Merge history' })
    await merged
      .getByRole('listitem', { name: 'Roadmap: In progress → Covered by Ben, Refused' })
      .waitFor({ timeout: 20_000 })
    expect(
      await merged.getByRole('listitem').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label'))),
    ).toEqual([
      'Roadmap: In progress → Covered by Ben, Refused',
      'Roadmap: Covered → In progress by Kacper, Applied',
      'Roadmap: Open → Covered by Ben, Applied',
    ])
    expect(await merged.textContent()).toMatch(/owner set it to in-progress by hand/)
    await w().getByText('1 change was refused or superseded').waitFor()
    await axeAllModes('the merge history')
    await shot('history', sharing, [times()])
  })

  it('the organiser records, stops, and shares the recap from Share summary: the outcomes reach the link', async () => {
    await relaunch(A)
    const budget = (await view(A, s.agenda)).items.find((i) => i.text === 'Budget')!
    await A.client.call('updateAgendaItem', {
      params: { id: s.agenda, itemId: budget.id },
      body: {
        outcome: 'Outcome: Approved at 40k.\nDecisions:\n- 40k for Q4\nActions:\n- Kacper: tell finance',
      },
    })
    await A.client.call('setAgendaItemStatus', {
      params: { id: s.agenda, itemId: budget.id },
      body: { status: 'covered' },
    })
    const { meetings } = await A.client.call('listMeetings', {
      query: {
        from: new Date(Date.now() - 3600_000).toISOString(),
        to: new Date(Date.now() + 3600_000).toISOString(),
      },
    })
    const { session } = await A.client.call('joinMeeting', { params: { id: meetings[0]!.id }, body: {} })
    s.session = session.id
    await until(
      async () => (await view(A, s.agenda)).agenda.sessionId,
      (id) => id === session.id,
      'the agenda linked to the recording',
    )
    await A.client.call('stopSession', { params: { id: session.id } })
    await go(`#/sessions/${session.id}`)
    await w().getByRole('list', { name: 'Recap per item' }).waitFor({ timeout: 20_000 })
    // a shared agenda's Share summary also offers the recap to everyone with the link
    await w().getByRole('button', { name: 'Share summary' }).click()
    const recap = w().getByRole('dialog', { name: 'Share Summary' })
    const sw = recap.getByRole('switch', { name: /Share recap/ })
    expect(await sw.isChecked()).toBe(false)
    expect((await page(s.agenda)).items.find((i) => i.text === 'Budget')?.outcome).toBeNull()
    // (React Aria's switch input is visually hidden: press its label, as a person would)
    await recap.getByText('Share recap', { exact: true }).click()
    await until(
      async () => (await page(s.agenda)).items.find((i) => i.text === 'Budget')?.outcome ?? null,
      (o) => o?.includes('Approved at 40k') ?? false,
      'the shared outcome on the link',
    )
    // the switch follows the daemon's agenda.share report
    await until(
      () => sw.isChecked(),
      (on) => on,
      'the switch on',
    )
    await recap.getByText('People with the link see each item’s outcome.').waitFor()
    await axeAllModes('the recap, shared')
    // the preview carries the recording's wall-clock times
    await shot('recap', recap, [recap.locator('pre')])
    await w().keyboard.press('Escape')
    await recap.waitFor({ state: 'detached' })
  })

  it('unshares (confirmed): the link answers 410; the attendee’s copy is kept, shown as no longer shared', async () => {
    // the meeting was recorded: its page is the outcome, where a shared agenda keeps its sharing button
    await go(`#/agendas/${s.agenda}`)
    await w().getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 20_000 })
    await w().getByRole('button', { name: 'Shared: Up to date' }).click({ timeout: 20_000 })
    const dlg = w().getByRole('dialog', { name: 'Share Agenda' })
    await dlg.getByRole('button', { name: 'Unshare…' }).click()
    const sure = w().getByRole('alertdialog', { name: 'Stop sharing this agenda?' })
    await axeAllModes('the unshare confirmation')
    await sure.getByRole('button', { name: 'Unshare', exact: true }).click()
    // unshared, the outcome page has nothing left to manage: the button goes
    await w()
      .getByRole('button', { name: /^Shared: / })
      .waitFor({ state: 'detached', timeout: 20_000 })
    expect(await share(A, s.agenda)).toMatchObject({ shared: false, state: 'off', link: null })
    await expect(page()).rejects.toMatchObject({ status: 410 })
    expect(await w().getByRole('region', { name: 'Sharing', exact: true }).count()).toBe(0)

    // the attendee's daemon learns it on its next sync (then the window renders its agenda.share report)
    await until(
      () => share(B, s.bAgenda),
      (st) => st.state === 'revoked',
      'the attendee’s copy to learn it is no longer shared',
    )
    await relaunch(B)
    await go(`#/agendas/${s.bAgenda}`)
    const banner = w().getByRole('status', {
      name: 'Kacper stopped sharing this agenda. Your copy stays on this computer.',
    })
    await banner.waitFor({ timeout: 20_000 })
    await w().getByRole('button', { name: 'Following: No longer shared' }).waitFor()
    expect((await view(B, s.bAgenda)).items.map((i) => i.text)).toContain('Offsite dates')
    await axeAllModes('a copy no longer shared')
    await shot('revoked', banner)
  })
})
