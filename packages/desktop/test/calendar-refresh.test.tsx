// @vitest-environment jsdom
import type { CalendarRefresh, CalendarStatus } from '@gnomeola/protocol'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { keys } from '../src/renderer/data/keys.ts'
import { calendarNotice, useCalendarRefresh } from '../src/renderer/features/home/calendar-refresh.ts'
import { renderApp } from './app-harness.tsx'
import { until } from './helpers.ts'

// Refresh calendar in the window: one refresh at a time, its answer folded into the cache (and the day's
// meetings refetched), the quiet notice when calendars are not up to date, the button by the date and F5.

afterEach(() => cleanup())

const status = (over: Partial<CalendarStatus> = {}): CalendarStatus => ({
  state: 'ok',
  provider: 'eds',
  detail: null,
  calendars: [{ id: 'work', name: 'Work' }],
  updatedAt: '2026-10-01T09:00:00.000Z',
  offline: [],
  ...over,
})

describe('the refresh', () => {
  it('runs one refresh at a time, folds the answer in and refetches the meetings', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['meetings', { from: 'a', to: 'b' }], { meetings: [] })
    let calls = 0
    let release: (r: CalendarRefresh) => void = () => {}
    const api = {
      call: (name: string) => {
        expect(name).toBe('refreshCalendar')
        calls++
        return new Promise<CalendarRefresh>((r) => {
          release = r
        })
      },
    } as never
    const first = useCalendarRefresh.getState().refresh(api, qc)
    const second = useCalendarRefresh.getState().refresh(api, qc)
    expect(useCalendarRefresh.getState().running).toBe(true)
    expect(calls).toBe(1)
    const answer = {
      calendar: status({ updatedAt: '2026-10-01T10:00:00.000Z' }),
      occurrences: 4,
      refreshed: true,
    }
    release(answer)
    expect(await first).toEqual(answer)
    expect(await second).toEqual(answer)
    expect(useCalendarRefresh.getState().running).toBe(false)
    expect(qc.getQueryData(keys.calendar())).toEqual(answer.calendar)
    expect(qc.getQueryState(['meetings', { from: 'a', to: 'b' }])?.isInvalidated).toBe(true)
  })

  it('a failure ends the run and keeps its reason', async () => {
    const qc = new QueryClient()
    const api = { call: () => Promise.reject(new Error('kacola isn’t answering')) } as never
    expect(await useCalendarRefresh.getState().refresh(api, qc)).toBeNull()
    expect(useCalendarRefresh.getState()).toMatchObject({ running: false, error: 'kacola isn’t answering' })
  })
})

describe('calendarNotice', () => {
  it('says nothing when every calendar is current, off, or still starting', () => {
    expect(calendarNotice(undefined)).toBeNull()
    expect(calendarNotice(status())).toBeNull()
    expect(calendarNotice(status({ offline: undefined }))).toBeNull()
    expect(calendarNotice(status({ state: 'off' }))).toBeNull()
    expect(calendarNotice(status({ state: 'starting' }))).toBeNull()
  })
  it('names the calendars that are not up to date, and why, quietly', () => {
    expect(calendarNotice(status({ state: 'unavailable', detail: 'EDS is not running' }))).toEqual({
      text: 'Can’t read your calendars right now',
      detail: 'EDS is not running',
    })
    expect(calendarNotice(status({ offline: [{ id: 'g', name: 'Team', reason: 'sign-in' }] }))?.text).toBe(
      'Team needs signing in again (GNOME Online Accounts)',
    )
    const two = status({
      offline: [
        { id: 'g', name: 'Team', reason: 'offline' },
        { id: 'h', name: 'Holidays', reason: 'failed' },
      ],
    })
    expect(calendarNotice(two)).toEqual({
      text: 'Team and Holidays aren’t up to date: showing what was saved',
      detail: null,
    })
    const many = status({
      offline: [
        { id: 'a', name: 'Classes', reason: 'offline' },
        { id: 'b', name: 'Exams', reason: 'sign-in' },
        { id: 'c', name: 'Family', reason: 'offline' },
      ],
    })
    expect(calendarNotice(many)).toEqual({
      text: 'Classes and 2 more aren’t up to date: showing what was saved',
      detail: 'Some need signing in again in GNOME Online Accounts.',
    })
  })
})

describe('home: Refresh calendar', () => {
  it('the button by the date and F5 refresh; a calendar not up to date shows quietly, with Refresh next to it', async () => {
    let current = status({ offline: [{ id: 'g', name: 'Team', reason: 'offline' }] })
    let refreshes = 0
    const app = renderApp({
      handlers: {
        calendarStatus: () => current,
        listMeetings: () => ({ from: '', to: '', meetings: [], calendar: current }),
        refreshCalendar: async () => {
          refreshes++
          await new Promise((r) => setTimeout(r, 30))
          current = status()
          return { calendar: current, occurrences: 0, refreshed: true }
        },
      },
    })
    await screen.findByText('Team isn’t up to date: showing what was saved')
    const button = await screen.findByRole('button', { name: 'Refresh calendar' })
    fireEvent.click(button)
    // spinning while it runs
    await screen.findByRole('button', { name: 'Refreshing the calendar…' })
    await until(() => refreshes === 1)
    await until(() => screen.queryByText('Team isn’t up to date: showing what was saved') === null)
    await screen.findByRole('button', { name: 'Refresh calendar' })
    fireEvent.keyDown(window, { key: 'F5' })
    await until(() => refreshes === 2)
    app.stop()
  })
})
