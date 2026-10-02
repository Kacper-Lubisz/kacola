import type { CalendarRefresh, CalendarStatus, OfflineCalendar } from '@gnomeola/protocol'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import type { QueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { keys } from '../../data/keys.ts'
import type { Api } from '../../data/queries.ts'

// Refresh calendar (home's button by the date, F5 anywhere in the window): the daemon re-queries every
// calendar — EDS retries the ones that failed and asks remote ones to re-sync, files are re-read — and
// answers once the new snapshot is in. One refresh at a time; the button spins while it runs. Its
// `calendar.updated` event refreshes home like any other; the answer is folded in too, in case the
// event stream is behind. Unit-tested in test/calendar-refresh.test.ts.

type RefreshState = {
  running: boolean
  /** Run one refresh (a second press while one runs is the same refresh). Resolves to the answer, or null on failure. */
  refresh: (api: Pick<Api, 'call'>, qc: QueryClient) => Promise<CalendarRefresh | null>
  /** The last failure's reason (cleared by the next refresh). */
  error: string | null
}

let inflight: Promise<CalendarRefresh | null> | null = null

export const useCalendarRefresh = create<RefreshState>((set) => ({
  running: false,
  error: null,
  refresh: (api, qc) => {
    if (inflight) return inflight
    set({ running: true, error: null })
    inflight = (async () => {
      try {
        const r = await api.call('refreshCalendar')
        qc.setQueryData(keys.calendar(), r.calendar)
        await qc.invalidateQueries({ queryKey: ['meetings'] })
        void qc.invalidateQueries({ queryKey: keys.upcoming() })
        return r
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
        return null
      } finally {
        inflight = null
        set({ running: false })
      }
    })()
    return inflight
  },
}))

export type CalendarNotice = { text: string; detail: string | null } | null

const nameList = (cals: readonly OfflineCalendar[]) => {
  const names = cals.map((c) => c.name)
  return names.length <= 2
    ? names.join(_(' and '))
    : fmt(_('{first} and {n} more'), { first: names[0]!, n: names.length - 1 })
}

/**
 * The one quiet line home shows when the calendar is not fully there, or null when it is: the calendar
 * could not be read at all, accounts that need signing in again, calendars that are offline (showing
 * their saved copy) or could not be opened. Refresh is the fix offered next to it.
 */
export function calendarNotice(status: CalendarStatus | undefined): CalendarNotice {
  if (!status || status.state === 'off' || status.state === 'starting') return null
  if (status.state === 'unavailable')
    return { text: _('Can’t read your calendars right now'), detail: status.detail }
  const offline = status.offline ?? []
  if (!offline.length) return null
  const signIn = offline.filter((c) => c.reason === 'sign-in')
  if (signIn.length === offline.length)
    return {
      text: fmt(
        ngettext(
          '{names} needs signing in again (GNOME Online Accounts)',
          '{names} need signing in again (GNOME Online Accounts)',
          signIn.length,
        ),
        { names: nameList(signIn) },
      ),
      detail: null,
    }
  return {
    text: fmt(
      ngettext(
        '{names} isn’t up to date: showing what was saved',
        '{names} aren’t up to date: showing what was saved',
        offline.length,
      ),
      { names: nameList(offline) },
    ),
    detail: signIn.length ? _('Some need signing in again in GNOME Online Accounts.') : null,
  }
}
