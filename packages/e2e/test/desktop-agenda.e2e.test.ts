import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AgendaView, createClient, LEASE_HEADER, type LeaseGrant } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop, matchBaseline } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'

type Locator = ReturnType<DesktopApp['window']['getByRole']>

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { BASELINES, DESKTOP_ARTIFACTS, setTheme } from '../src/desktop.ts'
import { expectScreenshot } from '../src/desktop-ui.ts'
import { type FakeAnthropic, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { markOnboarded } from '../src/ui.ts'

// The agenda UI (kacola wave 2) in the Electron window, against the REAL daemon — its agenda service,
// calendar service (a calendar file), the draft route through @gnomeola/llm to a fake Anthropic server —
// and the agent channel: a real lease for "Claude" (act mode), whose writes carry its token, and
// presence from its heartbeats. The live tracker is off here (GNOMEOLA_TRACKER=off: its marks depend on
// timing; desktop-tracker.e2e follows the real one) and so is the speech guard.
//
// The flows, on the meeting page as it moves through its phases: Prep — the editor (keyboard add, edit
// dialog, status, drag and keyboard reorder, history, goals, context cards), markdown export / copy /
// import, Send the agenda without a sharing server (one action, no kacola:// link), deleting items (at
// once, Undo in the toast restores them from their history), opened from home's day; Live after Join and record — the checklist
// (an agent's ticks, quietly attributed, with Undo), the one suggestion slot (its evidence opens the
// transcript at the line; Not now / Accept), presence (connected / reading, its permission, mode,
// Disconnect); Outcome after Stop — the recap per item, the outcome block, and the carry-over into the
// next occurrence. axe in light, dark and high contrast on every screen; baselines at ≤ 1 %.

const PIPELINE = { speed: 4, segmentEveryMs: 1500, partialEveryMs: 250, finalizeAfterMs: 200, tickMs: 20 }
const KEY = 'sk-ant-e2e-desktop-agenda-000111222'
const MEETING = '1:1 with Ana'
const WEEK = 7 * 24 * 60

/** Wait until `probe()` satisfies `ok` (a value the daemon or the window reports); returns that value. */
async function until<T>(
  probe: () => Promise<T>,
  ok: (v: T) => boolean,
  what: string,
  ms = 15_000,
): Promise<T> {
  const end = Date.now() + ms
  let last: T | undefined
  for (;;) {
    try {
      last = await probe()
      if (ok(last)) return last
    } catch {}
    if (Date.now() > end) throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('desktop: agendas', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let grant: LeaseGrant
  let api: FakeAnthropic
  let app: DesktopApp
  let dir = ''
  let markerId = ''
  let meetingAgenda = ''
  let sessionId = ''

  const w = () => app.window
  const view = async (id: string): Promise<AgendaView> =>
    daemon.client.call('getAgenda', { params: { id }, query: { includePrivate: true } })
  const texts = async (id: string) =>
    (await view(id)).items.sort((a, b) => a.order - b.order).map((i) => i.text)
  const item = async (id: string, text: string) => (await view(id)).items.find((i) => i.text === text)!
  const go = async (hash: string) => {
    await w().evaluate(`location.hash = ${JSON.stringify(hash)}`)
  }
  /** axe over the current screen in light, dark and both high-contrast modes, then back to light. */
  const axeAllModes = async (what: string, disableRules: string[] = []) => {
    // no hover tooltip (a transient layer outside the landmarks) in the scan
    await w().mouse.move(0, 0)
    await new Promise((r) => setTimeout(r, 400))
    for (const [scheme, contrast] of [
      ['light', 'normal'],
      ['dark', 'normal'],
      ['light', 'high'],
      ['dark', 'high'],
    ] as const) {
      await setTheme(app, scheme, contrast)
      expect(await app.axe({ disableRules }), `${what} (${scheme}, ${contrast})`).toEqual([])
    }
    await setTheme(app, 'light')
  }
  /** Still frame: no focus ring, no hover, reduced motion (no pulse, no spinner). */
  const still = async () => {
    // earlier toasts ("Copied…") time out after 5–8 s: none in a baseline
    const toasts = w()
      .getByRole('region', { name: 'Notifications' })
      .locator('[role="status"], [role="alert"]')
    await until(
      () => toasts.count(),
      (n) => n === 0,
      'the toasts to go',
      12_000,
    )
    await w().evaluate('document.activeElement?.blur()')
    await w().mouse.move(0, 0)
    await w().evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))')
  }
  const shot = async (name: string, region: Locator, masks: Locator[] = []) => {
    for (const scheme of ['light', 'dark'] as const) {
      await setTheme(app, scheme)
      await still()
      if (!masks.length) await expectScreenshot(app, `agenda-${name}-${scheme}`, { region })
      else {
        // wall-clock times (an agent's activity) under an opaque box
        const out = join(DESKTOP_ARTIFACTS, `agenda-${name}-${scheme}.png`)
        await region.screenshot({
          path: out,
          caret: 'initial',
          animations: 'allow',
          mask: masks,
          maskColor: '#A89A84',
        })
        const failure = matchBaseline(out, join(BASELINES, `agenda-${name}-${scheme}.png`))
        if (failure) throw new Error(`screenshot agenda-${name}-${scheme}: ${failure}`)
      }
    }
    await setTheme(app, 'light')
  }

  beforeAll(async () => {
    buildDesktop()
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-agenda-'))
    const calFile = join(dir, 'calendar.json')
    const now = Date.now()
    const t = (min: number) => new Date(now + min * 60_000).toISOString()
    const weekly = (week: number) => ({
      uid: 'one-on-one@x',
      summary: MEETING,
      sourceUid: 'cal-work',
      calendarName: 'Work',
      recurrenceId: t(-5 + week * WEEK),
      start: t(-5 + week * WEEK),
      end: t(25 + week * WEEK),
      description: 'Weekly check-in',
      location: '',
      url: '',
      allDay: false,
      startDate: null,
      endDate: null,
      timezone: 'Europe/Warsaw',
      status: 'CONFIRMED',
      myPartstat: null,
      organizer: 'mailto:me@example.com',
      attendees: 2,
      recurring: true,
      xprops: {},
    })
    writeFileSync(
      calFile,
      JSON.stringify({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: [weekly(0), weekly(1)] }),
    )
    api = await startFakeAnthropic({ eventDelayMs: 40 })
    daemon = await startDaemon({
      dataDir: join(dir, 'data'),
      env: {
        GNOMEOLA_CALENDAR: `file:${calFile}`,
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE),
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
        GNOMEOLA_TRACKER: 'off',
        GNOMEOLA_SPEECH_GUARD: 'none',
      },
    })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    await w().getByRole('button', { name: 'New recording', exact: true }).waitFor({ timeout: 20_000 })
    await w().emulateMedia({ reducedMotion: 'reduce' })
  }, 300_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    await api?.close()
    if (dir) rmSync(dir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('the editor: keyboard add, edit, status, drag and keyboard reorder, history, goals, context cards', async () => {
    const v = await daemon.client.call('createAgenda', {
      body: {
        title: 'Quarterly planning',
        goals: ['agree the Q4 goals'],
        items: [
          { text: 'Budget review', kind: 'decision', timeboxMin: 15 },
          { text: 'Hiring plan', owner: 'ana' },
          { text: 'Offsite dates' },
        ],
      },
    })
    const id = v.agenda.id
    await go(`#/agendas/${id}`)
    await w().getByRole('heading', { level: 1, name: 'Quarterly planning' }).waitFor()

    // add an item with the keyboard only
    await w().getByRole('textbox', { name: 'New item' }).focus()
    await w().keyboard.type('Team offsite budget')
    await w().keyboard.press('Enter')
    await until(
      () => texts(id),
      (t) => t.length === 4,
      'the item to be added',
    )
    expect(await texts(id)).toEqual(['Budget review', 'Hiring plan', 'Offsite dates', 'Team offsite budget'])

    // edit: kind, owner (the UI never asks for a timebox)
    await w().getByRole('button', { name: 'Edit “Offsite dates”' }).click()
    const dlg = w().getByRole('dialog', { name: 'Edit Item' })
    await dlg.getByRole('button', { name: /Kind/ }).click()
    await w().getByRole('option', { name: 'Must cover' }).click()
    await dlg.getByRole('textbox', { name: 'Owner' }).fill('me')
    expect(await dlg.getByRole('textbox', { name: /Timebox/ }).count()).toBe(0)
    await dlg.getByRole('button', { name: 'Save' }).click()
    await until(
      () => item(id, 'Offsite dates'),
      (i) => i.kind === 'must-cover' && i.owner === 'me',
      'the edit',
    )
    expect((await item(id, 'Offsite dates')).owner).toBe('me')

    // status from its menu (keyboard)
    await w().getByRole('button', { name: 'Status of “Budget review”: Open' }).focus()
    await w().keyboard.press('Enter')
    await w().getByRole('menuitem', { name: 'In progress' }).waitFor()
    await w().getByRole('menuitem', { name: 'In progress' }).click()
    await until(
      () => item(id, 'Budget review'),
      (i) => i.status === 'in-progress',
      'the status',
    )

    // keyboard reorder: the item menu's Move Up
    await w().getByRole('button', { name: 'More for “Hiring plan”' }).focus()
    await w().keyboard.press('Enter')
    await w().getByRole('menuitem', { name: 'Move Up' }).waitFor()
    await w().keyboard.press('Enter')
    await until(
      () => texts(id),
      (t) => t[0] === 'Hiring plan',
      'Move Up',
    )

    // drag reorder: the last item's grip onto the first row
    const rows = w().getByRole('grid', { name: 'Agenda items' }).getByRole('row')
    // (React Aria makes the whole row the drag source; the grip is its keyboard handle)
    await rows
      .nth(3)
      .dragTo(rows.nth(0), { sourcePosition: { x: 16, y: 16 }, targetPosition: { x: 40, y: 4 } })
    await until(
      () => texts(id),
      (t) => t.indexOf('Team offsite budget') < 3,
      'the drag to reorder',
    )

    // history of the item whose status changed
    await w().getByRole('button', { name: 'History of “Budget review”' }).click()
    const hist = w().getByRole('dialog', { name: 'History of “Budget review”' })
    await hist.getByText('Open → In progress by you').waitFor()
    await w().keyboard.press('Escape')

    // goals
    await w().getByRole('textbox', { name: 'Add a goal' }).fill('settle the offsite')
    await w().getByRole('button', { name: 'Add Goal' }).click()
    await until(
      async () => (await view(id)).agenda.goals,
      (g) => g.length === 2,
      'the goal',
    )

    // put the items back into a fixed order for the baseline
    const byText = Object.fromEntries((await view(id)).items.map((i) => [i.text, i.id]))
    await daemon.client.call('reorderAgendaItems', {
      params: { id },
      body: {
        itemIds: ['Budget review', 'Hiring plan', 'Offsite dates', 'Team offsite budget'].map(
          (t) => byText[t]!,
        ),
      },
    })
    await until(
      () => texts(id),
      (t) => t.join() === 'Budget review,Hiring plan,Offsite dates,Team offsite budget',
      'the order',
    )
    await w()
      .getByRole('grid', { name: 'Agenda items' })
      .getByRole('row')
      .nth(3)
      .getByText('Team offsite budget')
      .waitFor()
    await axeAllModes('agenda editor')
    await shot('editor', w().getByRole('region', { name: 'Agenda', exact: true }))

    // context (beside the agenda, no tabs): a private card, then shared
    await w().getByRole('button', { name: 'Add a Card' }).click()
    await w().getByRole('textbox', { name: 'Card title' }).fill('Last quarter numbers')
    await w().getByRole('textbox', { name: 'Card text' }).fill('Revenue up 12%, hiring behind by two.')
    await w().getByRole('button', { name: 'Add Card' }).click()
    const card = w().getByRole('article', { name: 'Last quarter numbers' })
    await card.waitFor()
    expect((await view(id)).context[0]).toMatchObject({
      title: 'Last quarter numbers',
      visibility: 'private',
    })
    await card.getByRole('switch', { name: 'Shared with attendees' }).focus()
    await w().keyboard.press('Space')
    await until(
      async () => (await view(id)).context[0]?.visibility,
      (x) => x === 'shared',
      'sharing the card',
    )
    await axeAllModes('context')
  })

  it('markdown: export through the save dialog, copy, import (merge)', async () => {
    const id = (await daemon.client.call('listAgendas', { query: { includePrivate: true } })).agendas.find(
      (a) => a.title === 'Quarterly planning',
    )!.id
    await go(`#/agendas/${id}?tab=items`)
    await w().getByRole('heading', { level: 1, name: 'Quarterly planning' }).waitFor()
    const out = join(dir, 'agenda.md')
    await app.evaluateMain(({ dialog }, path) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: path,
      })) as unknown as typeof dialog.showSaveDialog
    }, out)
    await w().getByRole('button', { name: 'Agenda actions' }).click()
    await w().getByRole('menuitem', { name: 'Export as Markdown…' }).click()
    await waitFor(
      async () => {
        try {
          return readFileSync(out, 'utf8').includes('- [~] Budget review')
        } catch {
          return false
        }
      },
      10_000,
      'the export',
    )
    expect(readFileSync(out, 'utf8')).toContain('# Quarterly planning')

    await w().getByRole('button', { name: 'Agenda actions' }).click()
    await w().getByRole('menuitem', { name: 'Copy as Markdown' }).click()
    await waitFor(
      async () => (await app.evaluateMain(({ clipboard }) => clipboard.readText())).includes('Hiring plan'),
      5000,
      'the copy',
    )

    await w().getByRole('button', { name: 'Agenda actions' }).click()
    await w().getByRole('menuitem', { name: 'Import Markdown…' }).click()
    const dlg = w().getByRole('dialog', { name: 'Import Markdown' })
    await dlg.getByRole('textbox', { name: 'Markdown' }).fill('- [ ] Imported item (5m) [question]\n')
    await dlg.getByRole('button', { name: 'Import' }).click()
    await until(
      () => texts(id),
      (t) => t.includes('Imported item'),
      'the import',
    )
    expect((await item(id, 'Imported item')).kind).toBe('question')
    expect((await texts(id)).length).toBe(5) // merge kept the rest
  })

  it('a calendar meeting: Plan from home’s day; Send the agenda without a sharing server says so', async () => {
    await go('#/')
    // the meeting under way sits in its place on the day, highlighted, with Plan (no agenda yet)
    const next = w().getByRole('region', { name: `Now: ${MEETING}` })
    await next.waitFor({ timeout: 15_000 })
    expect(await next.getByText('No agenda yet').count()).toBe(0)
    const plan = next.getByRole('button', { name: `Plan ${MEETING}` })
    await plan.waitFor({ timeout: 15_000 })
    await plan.click()
    await w().getByRole('heading', { level: 1, name: MEETING }).waitFor()
    meetingAgenda = ((await w().evaluate('location.hash')) as string).split('/')[2]!.split('?')[0]!
    expect((await view(meetingAgenda)).agenda.meeting).toMatchObject({
      eventUid: 'one-on-one@x',
      recurring: true,
    })
    await w()
      .getByText(/^· now, (just started|started .+ ago)$/)
      .waitFor()

    // Send the agenda without a sharing server: it says so, with one action — and never hands out a
    // kacola:// link that attendees without kacola could not open
    await w().getByRole('button', { name: 'Send the agenda' }).click()
    const dlg = w().getByRole('dialog', { name: 'Send the Agenda' })
    await dlg.getByRole('region', { name: 'What attendees see' }).waitFor()
    await dlg.getByRole('button', { name: 'Send', exact: true }).click()
    await dlg.getByRole('button', { name: 'Set Up Sharing' }).waitFor({ timeout: 15_000 })
    expect(await dlg.getByRole('status').count()).toBeGreaterThan(0)
    expect(await dlg.textContent()).not.toContain('kacola://')
    expect(await dlg.getByRole('button', { name: 'Copy Invitation Text' }).count()).toBe(0)
    await axeAllModes('send without a sharing server')
    expect((await daemon.client.call('getAgendaShare', { params: { id: meetingAgenda } })).shared).toBe(false)
    // its one action opens Preferences
    await dlg.getByRole('button', { name: 'Set Up Sharing' }).click()
    await w().getByRole('dialog', { name: 'Preferences' }).waitFor()
    await w().keyboard.press('Escape')
    await w().getByRole('dialog', { name: 'Preferences' }).waitFor({ state: 'detached' })
  })

  it('deleting items: at once from the row or the Delete key, Undo in the toast brings it back (same id, same place)', async () => {
    await go(`#/agendas/${meetingAgenda}`)
    await w().getByRole('heading', { level: 1, name: MEETING }).waitFor()
    // the items as the CLI / the skill plans them, from the terminal
    await daemon.client.call('updateAgenda', {
      params: { id: meetingAgenda },
      body: { goals: ['agree the promo timeline', 'hear how onboarding is going'] },
    })
    await daemon.client.call('addAgendaItems', {
      params: { id: meetingAgenda },
      body: {
        items: [
          { text: 'Promo timeline', kind: 'must-cover', owner: 'me' },
          { text: 'Offsite ideas' },
          { text: 'How is onboarding going', kind: 'question', owner: 'Ana' },
          { text: 'Next review date', kind: 'decision' },
        ],
      },
    })
    const grid = w().getByRole('grid', { name: 'Agenda items' })
    await grid.getByRole('row', { name: 'Next review date' }).waitFor()
    const before = (await view(meetingAgenda)).items.find((i) => i.text === 'Offsite ideas')!
    const toast = (text: string) =>
      w().getByRole('region', { name: 'Notifications' }).getByRole('status').filter({ hasText: text }).last()

    // the row's quiet delete, named for the item: gone at once, no confirm
    await w().getByRole('button', { name: 'Delete “Offsite ideas”' }).click()
    await grid.getByRole('row', { name: 'Offsite ideas' }).waitFor({ state: 'detached' })
    expect(await w().getByRole('alertdialog').count()).toBe(0)
    await until(
      () => texts(meetingAgenda),
      (t) => !t.includes('Offsite ideas'),
      'the delete',
    )
    await axeAllModes('item deleted, Undo offered')
    // Undo: restored through the item history, with its id and at its place
    await toast('Deleted “Offsite ideas”').getByRole('button', { name: 'Undo' }).click()
    await grid.getByRole('row', { name: 'Offsite ideas' }).waitFor()
    await until(
      () => texts(meetingAgenda),
      (t) => t.join() === 'Promo timeline,Offsite ideas,How is onboarding going,Next review date',
      'the undo',
    )
    const back = (await view(meetingAgenda)).items.find((i) => i.text === 'Offsite ideas')!
    expect(back.id).toBe(before.id)
    const versions = (
      await daemon.client.call('getAgendaItemHistory', {
        params: { id: meetingAgenda },
        query: { itemId: before.id, includePrivate: true },
      })
    ).versions.map((v) => v.kind)
    expect(versions).toEqual(['added', 'removed', 'restored'])

    // the keyboard path: Delete on the focused row
    await grid.getByRole('row', { name: 'Offsite ideas' }).focus()
    await w().keyboard.press('Delete')
    await toast('Deleted “Offsite ideas”').waitFor()
    await until(
      () => texts(meetingAgenda),
      (t) => t.join() === 'Promo timeline,How is onboarding going,Next review date',
      'the Delete key',
    )
    await toast('Deleted “Offsite ideas”').getByRole('button', { name: 'Dismiss' }).click()
  })

  it('Join and record → the live checklist folds the agent’s ticks; the one suggestion slot; undo', async () => {
    await daemon.client.call('addAgendaItems', {
      params: { id: meetingAgenda },
      body: { items: [{ text: 'Parking lot' }, { text: 'Skip this one' }] },
    })
    await w().getByRole('button', { name: 'Join and record' }).click()
    // the prep page moves on by itself: live, the recording pill in its header
    await w()
      .getByRole('timer', { name: /^Recording/ })
      .waitFor({ timeout: 15_000 })
    sessionId = (await until(
      async () => (await view(meetingAgenda)).agenda.sessionId,
      (s) => s !== null,
      'the agenda to link',
    ))!
    await w().getByRole('list', { name: 'Agenda items' }).waitFor({ timeout: 15_000 })

    const seg = await until(
      async () =>
        (
          await daemon.client.call('getTranscript', {
            params: { id: sessionId },
            query: { includePrivate: true },
          })
        ).segments,
      (s) => s.length > 0,
      'a transcript segment',
    )
    const ids = Object.fromEntries((await view(meetingAgenda)).items.map((i) => [i.text, i.id]))
    // the user's Claude, connected in act mode: its writes carry its lease token (attributed agent:claude)
    grant = await daemon.client.call('createAgentLease', {
      params: { id: sessionId },
      body: { name: 'claude', mode: 'act' },
    })
    const claude = createClient({ baseUrl: daemon.baseUrl, headers: { [LEASE_HEADER]: grant.token } })
    const status = (text: string, body: Record<string, unknown>, as = daemon.client) =>
      as.call('setAgendaItemStatus', {
        params: { id: meetingAgenda, itemId: ids[text]! },
        body: body as never,
      })
    await status(
      'Promo timeline',
      {
        status: 'covered',
        confidence: 0.93,
        evidence: [{ segmentId: seg[0]!.id, quote: 'so the promo goes in March', confidence: 0.93 }],
      },
      claude,
    )
    await status('How is onboarding going', { status: 'in-progress' }, claude)
    await status(
      'Next review date',
      {
        status: 'in-progress',
        evidence: [{ segmentId: seg[0]!.id, quote: 'the review could be in March', confidence: 0.8 }],
      },
      claude,
    )
    await status('Parking lot', { status: 'parked' })
    await status('Skip this one', { status: 'skipped' })
    await claude.call('addSuggestion', {
      params: { id: meetingAgenda },
      body: { kind: 'question', text: 'Ask whether the March cycle has a deadline', source: 'agent:claude' },
    })
    await claude.call('addSuggestion', {
      params: { id: meetingAgenda },
      body: {
        kind: 'next-point',
        text: 'Bridge to the review date while onboarding wraps up',
        itemId: ids['Next review date'],
        source: 'agent:claude',
      },
    })

    // ticks someone else made are attributed, quietly; the current item is the first in progress
    const promo = w().getByRole('listitem', { name: 'Promo timeline' })
    await promo.getByText('ticked by your Claude').waitFor()
    expect(
      await w().getByRole('listitem', { name: 'How is onboarding going' }).getAttribute('aria-current'),
    ).toBe('step')
    // ONE suggestion at a time: the newest of its kind
    const slot = w().getByRole('region', { name: /^Suggestion: / })
    const bridge = w().getByRole('region', {
      name: 'Suggestion: Bridge to the review date while onboarding wraps up',
    })
    await bridge.waitFor()
    await bridge.getByText('from your Claude').waitFor()
    expect(await slot.count()).toBe(1)
    await axeAllModes('live page')
    await shot('live', w().getByRole('main'), [w().getByRole('timer')])
    // every status at once: open, in progress (agent), covered (agent), skipped, parked
    await shot('live-items', w().getByRole('list', { name: 'Agenda items' }))

    // the suggestion's evidence opens the transcript beside the page, at the line
    await bridge.getByRole('button', { name: 'Show in transcript: “the review could be in March”' }).click()
    await w().getByRole('button', { name: 'Close the transcript' }).waitFor()
    await until(
      () => w().evaluate('location.hash') as Promise<string>,
      (h) => h.includes(`segment=${seg[0]!.id}`),
      'the citation',
    )
    await w().getByRole('button', { name: 'Close the transcript' }).click()

    // undo the agent's tick: the user sets it back (an override; manual wins after)
    await promo.getByRole('button', { name: 'Undo the tick on “Promo timeline”' }).click()
    await until(
      () => item(meetingAgenda, 'Promo timeline'),
      (i) => i.status === 'open',
      'the undo',
    )
    const hist = await daemon.client.call('getAgendaHistory', {
      params: { id: meetingAgenda },
      query: { includePrivate: true },
    })
    expect(hist.changes.at(-1)).toMatchObject({ to: 'open', by: 'user', override: true })

    // Not now: the next one waiting takes the slot; Accept resolves it
    await bridge.getByRole('button', { name: 'Not now' }).click()
    const ask = w().getByRole('region', { name: 'Suggestion: Ask whether the March cycle has a deadline' })
    await ask.waitFor()
    await ask.getByRole('button', { name: 'Accept' }).click()
    await ask.waitFor({ state: 'detached' })
    const states = Object.fromEntries((await view(meetingAgenda)).suggestions.map((x) => [x.text, x.state]))
    expect(states).toMatchObject({
      'Bridge to the review date while onboarding wraps up': 'dismissed',
      'Ask whether the March cycle has a deadline': 'accepted',
    })
    expect(await slot.count()).toBe(0)
  })

  it('presence: connected / reading, the activity on the chip, mode, Disconnect (the real agent channel)', async () => {
    const claude = createClient({ baseUrl: daemon.baseUrl, headers: { [LEASE_HEADER]: grant.token } })
    const lease = async () =>
      (
        await daemon.client.call('listAgentLeases', {
          params: { id: sessionId },
          query: { includeEnded: true },
        })
      ).leases.find((l) => l.id === grant.lease.id)!
    // the pill states what it may do
    const chip = w().getByRole('button', { name: 'Your Claude · can check items off. Show agent' })
    await chip.waitFor({ timeout: 10_000 })
    await still()
    await expectScreenshot(app, 'agenda-presence-connected-light', { region: chip })
    await claude.call('heartbeatAgentLease', {
      params: { leaseId: grant.lease.id },
      body: { state: 'reading' },
    })
    // reading: the same words (the pulse says it; none under reduced motion)
    const reading = chip
    await until(
      async () => (await lease()).state,
      (st) => st === 'reading',
      'the reading heartbeat',
    )
    await still()
    await expectScreenshot(app, 'agenda-presence-reading-light', { region: reading })
    await reading.click()
    const pop = w().getByRole('dialog', { name: 'Connected agents' })
    await pop
      .getByText(/Ask whether the March cycle has a deadline/)
      .first()
      .waitFor()
    // `region` off for this one scan: React Aria puts the popover's screen-reader-only Dismiss button
    // beside (not inside) its dialog, outside every landmark; everything the popover shows is in the dialog
    await axeAllModes('presence popover', ['region'])
    await shot('presence-popover', pop, [
      pop.getByRole('list', { name: 'Activity' }).locator('span.font-mono'),
    ])
    await pop.getByRole('radio', { name: 'Observe' }).click()
    await until(lease, (l) => l.mode === 'observe', 'the mode change')
    await pop.getByRole('button', { name: 'Disconnect' }).click()
    await until(lease, (l) => l.endReason === 'revoked', 'the revoke')
    await w()
      .getByRole('button', { name: /Your Claude · / })
      .waitFor({ state: 'detached' })
    // the token is dead
    await expect(
      claude.call('heartbeatAgentLease', { params: { leaseId: grant.lease.id }, body: {} }),
    ).rejects.toMatchObject({ status: expect.any(Number) })
  })

  it('after Stop: the recap per item, the outcome, and open items carried over to the next occurrence', async () => {
    await daemon.client.call('updateAgendaItem', {
      params: { id: meetingAgenda, itemId: (await item(meetingAgenda, 'Next review date')).id },
      body: {
        outcome: 'Outcome: Review on 12 November.\nDecisions:\n- 12 November\nActions:\n- Ana: book the room',
      },
    })
    await daemon.client.call('setAgendaItemStatus', {
      params: { id: meetingAgenda, itemId: (await item(meetingAgenda, 'Next review date')).id },
      body: { status: 'covered' },
    })
    await daemon.client.call('stopSession', { params: { id: sessionId } })
    const recap = w().getByRole('list', { name: 'Recap per item' })
    await recap.waitFor({ timeout: 20_000 })
    expect(await recap.getByRole('listitem', { name: 'Next review date' }).textContent()).toContain('settled')
    // the outcome block: what was decided, who does what
    const outcome = w().getByRole('region', { name: 'Outcome' })
    await outcome.getByText('12 November', { exact: true }).waitFor()
    const todo = outcome.getByRole('listitem', { name: 'book the room' })
    expect(await todo.textContent()).toContain('Ana')
    await outcome.getByText('Carried over').waitFor()
    const openNext = w().getByRole('button', { name: 'Open the next meeting' })
    await openNext.waitFor({ timeout: 20_000 })
    await axeAllModes('recap')
    await shot('recap', recap)
    await openNext.click()
    await w().getByRole('heading', { level: 1, name: MEETING }).waitFor()
    await w()
      .getByText(/items? carried over/)
      .first()
      .waitFor()
    const nextId = ((await w().evaluate('location.hash')) as string).split('/')[2]!.split('?')[0]!
    expect(nextId).not.toBe(meetingAgenda)
    const carried = (await view(nextId)).items
    expect(carried.map((i) => i.text)).toEqual(expect.arrayContaining(['Promo timeline', 'Parking lot']))
    expect(carried.every((i) => i.carriedFrom?.agendaId === meetingAgenda)).toBe(true)
  })
})
