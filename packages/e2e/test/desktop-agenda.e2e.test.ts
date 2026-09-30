import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgendaView, LeaseInfo } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'

type Locator = ReturnType<DesktopApp['window']['getByRole']>

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type AgentChannelOverlay, startAgentChannelOverlay } from '../src/agent-channel-overlay.ts'
import { setTheme } from '../src/desktop.ts'
import { expectScreenshot } from '../src/desktop-ui.ts'
import { type CannedResponse, type FakeAnthropic, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { markOnboarded } from '../src/ui.ts'

// The agenda UI (kacola wave 2) in the Electron window, against the REAL daemon — its agenda service,
// calendar service (a calendar file), the draft route through @gnomeola/llm to a fake Anthropic server —
// and, for the agent channel's owner routes that are not merged yet (they answer 501), the overlay in
// ../src/agent-channel-overlay.ts (schema-checked stand-ins; real routes pass straight through).
//
// The flows: the editor (keyboard add, edit dialog, status, drag and keyboard reorder, history, goals,
// context cards), markdown export / copy / import, Add link to invite refused by a read-only calendar
// (copy fallback), Plan with Claude (held mid-stream for the baseline), the meeting in progress → Join
// and record → the live panel (the tracker's auto mark with its evidence, an agent's mark, suggestions,
// next talking point, undo, interview view, compact), presence (connected / reading, mode, Disconnect),
// and after Stop the recap and the carry-over into the next occurrence. axe in light, dark and high
// contrast on every screen; baselines at ≤ 1 %.

const PIPELINE = { speed: 4, segmentEveryMs: 1500, partialEveryMs: 250, finalizeAfterMs: 200, tickMs: 20 }
const KEY = 'sk-ant-e2e-desktop-agenda-000111222'
const MEETING = '1:1 with Ana'
const WEEK = 7 * 24 * 60
const OLD = '2026-01-15T10:00:00.000Z'

const sse = (body: string): CannedResponse => ({
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
  body,
})
const frame = (type: string, data: Record<string, unknown>) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
const usage = { input_tokens: 700, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
/** A Messages API stream writing `chunks` as text deltas. */
const anthropicText = (chunks: string[]) =>
  sse(
    frame('message_start', {
      message: {
        id: 'msg_draft',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { ...usage, output_tokens: 1 },
      },
    }) +
      frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
      chunks
        .map((text) => frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }))
        .join('') +
      frame('content_block_stop', { index: 0 }) +
      frame('message_delta', {
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { ...usage, output_tokens: 60 },
      }) +
      frame('message_stop', {}),
  )

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
  let overlay: AgentChannelOverlay
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
  const axeAllModes = async (what: string) => {
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
  /** Still frame: no focus ring, no hover, reduced motion (no pulse, no spinner). */
  const still = async () => {
    await w().evaluate('document.activeElement?.blur()')
    await w().mouse.move(0, 0)
    await w().evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))')
  }
  const shot = async (name: string, region: Locator) => {
    for (const scheme of ['light', 'dark'] as const) {
      await setTheme(app, scheme)
      await still()
      await expectScreenshot(app, `agenda-${name}-${scheme}`, { region })
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
      },
    })
    overlay = await startAgentChannelOverlay(daemon.baseUrl)
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: overlay.url, GNOMEOLA_COLOR_SCHEME: 'light' } })
    await w().getByRole('button', { name: 'Record', exact: true }).waitFor({ timeout: 20_000 })
    await w().emulateMedia({ reducedMotion: 'reduce' })
  }, 300_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await overlay?.close()
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

    // edit: kind, owner, timebox
    await w().getByRole('button', { name: 'Edit “Offsite dates”' }).click()
    const dlg = w().getByRole('dialog', { name: 'Edit Item' })
    await dlg.getByRole('button', { name: /Kind/ }).click()
    await w().getByRole('option', { name: 'Must cover' }).click()
    await dlg.getByRole('textbox', { name: 'Owner' }).fill('me')
    await dlg.getByRole('textbox', { name: 'Timebox (minutes)' }).fill('10')
    await dlg.getByRole('button', { name: 'Save' }).click()
    await until(
      () => item(id, 'Offsite dates'),
      (i) => i.kind === 'must-cover' && i.timeboxMin === 10,
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
    await rows
      .nth(3)
      .getByRole('button', { name: 'Drag to reorder' })
      .dragTo(rows.nth(0), { targetPosition: { x: 40, y: 4 } })
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
    await shot('editor', w().getByRole('tabpanel', { name: 'Items' }))

    // context: a private card, then shared
    await w().getByRole('tab', { name: 'Context' }).click()
    await w().getByRole('textbox', { name: 'Card title' }).fill('Last quarter numbers')
    await w().getByRole('textbox', { name: 'Card text' }).fill('Revenue up 12%, hiring behind by two.')
    await w().getByRole('button', { name: 'Add Card' }).click()
    const card = w().getByRole('article', { name: 'Last quarter numbers' })
    await card.waitFor()
    expect((await view(id)).context[0]).toMatchObject({
      title: 'Last quarter numbers',
      visibility: 'private',
    })
    await card.getByRole('switch', { name: 'Shared with attendees' }).click()
    await until(
      async () => (await view(id)).context[0]?.visibility,
      (x) => x === 'shared',
      'sharing the card',
    )
    await axeAllModes('context tab')
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

  it('a calendar meeting: Plan from Coming up; Add link to invite refused → copy the block', async () => {
    await go('#/')
    const plan = w().getByRole('button', { name: `Plan ${MEETING}` })
    await plan.waitFor({ timeout: 15_000 })
    await plan.click()
    await w().getByRole('heading', { level: 1, name: MEETING }).waitFor()
    meetingAgenda = ((await w().evaluate('location.hash')) as string).split('/')[2]!.split('?')[0]!
    expect((await view(meetingAgenda)).agenda.meeting).toMatchObject({
      eventUid: 'one-on-one@x',
      recurring: true,
    })
    await w().getByRole('status', { name: 'This meeting is happening now' }).waitFor()

    await w().getByRole('button', { name: 'Add Link to Invite' }).click()
    const dlg = w().getByRole('dialog', { name: 'Couldn’t Edit the Invitation' })
    await dlg.waitFor()
    expect(await dlg.textContent()).toContain(`kacola://`)
    await axeAllModes('invite refused')
    await dlg.getByRole('button', { name: 'Copy' }).click()
    await waitFor(
      async () =>
        (await app.evaluateMain(({ clipboard }) => clipboard.readText())).includes('kacola://meeting/'),
      5000,
      'the copied block',
    )
  })

  it('Plan with Claude: goals → streamed proposals (held for the baseline) → accepted items', async () => {
    await go(`#/agendas/${meetingAgenda}`)
    await w().getByRole('heading', { level: 1, name: MEETING }).waitFor()
    api.enqueue(
      anthropicText([
        '- [must-cover] Promo timeline (10m, @me)\n',
        '- [question] How is onboarding going (@Ana)\n',
        '- [decision] Next review date\n',
        '- [topic] Offsite ideas\n',
      ]),
    )
    const release = api.holdAfter(6)
    await w().getByRole('button', { name: 'Plan with Claude' }).click()
    const dlg = w().getByRole('dialog', { name: 'Plan with Claude' })
    await dlg
      .getByRole('textbox', { name: 'Goals (one per line)' })
      .fill('agree the promo timeline\nhear how onboarding is going')
    await dlg.getByRole('button', { name: 'Draft Items' }).click()
    await dlg.getByRole('checkbox', { name: /How is onboarding going/ }).waitFor({ timeout: 15_000 })
    await new Promise((r) => setTimeout(r, 400))
    expect(await dlg.getByRole('checkbox').count()).toBe(2)
    await axeAllModes('planning mid-stream')
    await shot('planning', dlg)
    release()
    await dlg.getByText('Drafted by claude-opus-5').waitFor({ timeout: 15_000 })
    const body = api.seen.at(-1)!.body as { messages: { content: { text: string }[] }[] }
    expect(body.messages[0]!.content.map((b) => b.text).join('')).toContain('- agree the promo timeline')
    await dlg.getByRole('checkbox', { name: /Offsite ideas/ }).click()
    await dlg.getByRole('button', { name: 'Add 3 Items' }).click()
    await until(
      () => texts(meetingAgenda),
      (t) => t.length === 3,
      'the accepted items',
    )
    expect(await texts(meetingAgenda)).toEqual([
      'Promo timeline',
      'How is onboarding going',
      'Next review date',
    ])
    expect((await view(meetingAgenda)).agenda.goals).toEqual([
      'agree the promo timeline',
      'hear how onboarding is going',
    ])
  })

  it('Join and record → the live panel folds the tracker’s and the agent’s marks; suggestions; undo; interview; compact', async () => {
    await daemon.client.call('addAgendaItems', {
      params: { id: meetingAgenda },
      body: { items: [{ text: 'Parking lot' }, { text: 'Skip this one' }] },
    })
    await w().getByRole('button', { name: 'Join and Record' }).click()
    await w().getByRole('tab', { name: 'Agenda', selected: true }).waitFor({ timeout: 15_000 })
    sessionId = ((await w().evaluate('location.hash')) as string).split('/')[2]!.split('?')[0]!
    await until(
      async () => (await view(meetingAgenda)).agenda.sessionId,
      (s) => s === sessionId,
      'the agenda to link',
    )
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
    const status = (text: string, body: Record<string, unknown>) =>
      daemon.client.call('setAgendaItemStatus', {
        params: { id: meetingAgenda, itemId: ids[text]! },
        body: body as never,
      })
    await status('Promo timeline', {
      status: 'covered',
      by: 'tracker',
      auto: true,
      confidence: 0.93,
      evidence: [{ segmentId: seg[0]!.id, quote: 'so the promo goes in March', confidence: 0.93 }],
    })
    await status('How is onboarding going', { status: 'in-progress', by: 'agent:claude' })
    await status('Parking lot', { status: 'parked' })
    await status('Skip this one', { status: 'skipped' })
    await daemon.client.call('addSuggestion', {
      params: { id: meetingAgenda },
      body: { kind: 'question', text: 'Ask whether the March cycle has a deadline', source: 'agent:claude' },
    })
    await daemon.client.call('addSuggestion', {
      params: { id: meetingAgenda },
      body: {
        kind: 'next-point',
        text: 'Bridge to the review date while onboarding wraps up',
        itemId: ids['Next review date'],
        source: 'tracker',
      },
    })

    const promo = w().getByRole('listitem', { name: 'Promo timeline' })
    await promo.getByText('auto').waitFor()
    await w()
      .getByRole('listitem', { name: 'How is onboarding going' })
      .getByText('checked by Claude')
      .waitFor()
    const next = w().getByRole('region', { name: 'Next talking point' })
    await next.getByText('Bridge to the review date while onboarding wraps up').waitFor()
    await w()
      .getByRole('listitem', { name: 'Suggestion: Ask whether the March cycle has a deadline' })
      .waitFor()
    await axeAllModes('live panel')
    await shot('live', w().getByRole('tabpanel', { name: 'Agenda' }))

    // the evidence chip jumps the transcript to the line
    await promo.getByRole('button', { name: 'Show in transcript: “so the promo goes in March”' }).click()
    await w().getByRole('tab', { name: 'Transcript', selected: true }).waitFor()
    await until(
      () => w().evaluate('location.hash') as Promise<string>,
      (h) => h.includes(`segment=${seg[0]!.id}`),
      'the citation',
    )
    await w().getByRole('tab', { name: 'Agenda' }).click()

    // undo the auto mark: the user sets it back (an override)
    await w().getByRole('listitem', { name: 'Promo timeline' }).getByRole('button', { name: 'Undo' }).click()
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

    // the agent's suggestion becomes an item
    const s = w().getByRole('listitem', { name: 'Suggestion: Ask whether the March cycle has a deadline' })
    await s.getByRole('button', { name: 'Turn into Item' }).click()
    await until(
      () => texts(meetingAgenda),
      (t) => t.includes('Ask whether the March cycle has a deadline'),
      'the new item',
    )
    await s.waitFor({ state: 'detached' })

    // interview view
    await daemon.client.call('addAgendaItems', {
      params: { id: meetingAgenda },
      body: {
        items: [
          {
            text: 'Team size',
            kind: 'info-to-get',
            status: 'covered',
            outcome: 'eight engineers, two designers',
          },
          { text: 'Salary band', kind: 'info-to-get' },
        ],
      },
    })
    await w().getByRole('radio', { name: 'Interview' }).click()
    const told = w().getByRole('region', { name: 'Told (1)' })
    await told.getByText('eight engineers, two designers').waitFor()
    await w().getByRole('region', { name: 'Not told yet (1)' }).getByText('Salary band').waitFor()
    await axeAllModes('interview view')
    await shot('interview', w().getByRole('tabpanel', { name: 'Agenda' }))
    await w().getByRole('radio', { name: 'Agenda' }).click()

    // compact: what is in progress, the next point
    await w().getByRole('button', { name: 'Compact view' }).click()
    const list = w().getByRole('list', { name: 'Agenda items' })
    await until(
      async () => list.getByRole('listitem').count(),
      (n) => n === 1,
      'compact',
    )
    await list.getByRole('listitem', { name: 'How is onboarding going' }).waitFor()
    await w().getByRole('button', { name: 'Full view' }).click()
  })

  it('presence: connected / reading, the activity on the chip, mode, Disconnect', async () => {
    const lease: LeaseInfo = {
      id: 'lse_e2e1',
      sessionId,
      agendaId: meetingAgenda,
      name: 'claude',
      mode: 'suggest',
      createdAt: OLD,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      heartbeatAt: new Date().toISOString(),
      state: 'connected',
      endedAt: null,
      endReason: null,
      counts: { statusChanges: 1, suggestions: 1, items: 0, context: 0, refused: 0 },
      actions: [
        {
          at: OLD,
          kind: 'status',
          outcome: 'applied',
          summary: 'Marked “How is onboarding going” in progress',
          ref: null,
        },
        {
          at: OLD,
          kind: 'suggestion',
          outcome: 'suggested',
          summary: 'Suggested asking about the deadline',
          ref: null,
        },
      ],
    }
    overlay.leases.push(lease)
    overlay.presence(sessionId, { leaseId: lease.id, name: 'claude', mode: 'suggest', state: 'connected' })
    const chip = w().getByRole('button', { name: 'Claude · connected. Show agent' })
    await chip.waitFor({ timeout: 10_000 })
    await still()
    await expectScreenshot(app, 'agenda-presence-connected-light', { region: chip })
    overlay.presence(sessionId, { leaseId: lease.id, name: 'claude', mode: 'suggest', state: 'reading' })
    const reading = w().getByRole('button', { name: 'Claude · reading. Show agent' })
    await reading.waitFor()
    await still()
    await expectScreenshot(app, 'agenda-presence-reading-light', { region: reading })
    await reading.click()
    const pop = w().getByRole('dialog', { name: 'Connected agents' })
    await pop.getByText('Suggested asking about the deadline').waitFor()
    await axeAllModes('presence popover')
    await shot('presence-popover', pop)
    await pop.getByRole('radio', { name: 'Act' }).click()
    await until(
      async () => overlay.leases[0]!.mode,
      (m) => m === 'act',
      'the mode change',
    )
    await pop.getByRole('button', { name: 'Disconnect' }).click()
    await until(
      async () => overlay.leases[0]!.endReason,
      (r) => r === 'revoked',
      'the revoke',
    )
    await w()
      .getByRole('button', { name: /Claude · / })
      .waitFor({ state: 'detached' })
    expect(overlay.answered).toEqual(
      expect.arrayContaining(['listAgentLeases', 'updateAgentLease', 'releaseAgentLease']),
    )
  })

  it('after Stop: the recap per item, and open items carried over to the next occurrence', async () => {
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
    const nr = recap.getByRole('listitem', { name: 'Next review date' })
    expect(await nr.textContent()).toMatch(/Review on 12 November\..*12 November.*Ana: book the room/)
    const openNext = w().getByRole('button', { name: 'Open Next Agenda' })
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
