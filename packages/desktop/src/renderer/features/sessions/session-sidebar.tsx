import { displayTitle, sessionSubtitle } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _ } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useServices } from '../../data/services.tsx'
import { type NavItem, NavigationList } from '../../design/primitives/index.ts'

// The sidebar's session list: server state from the ['sessions'] query (kept live by the EventBridge),
// selection from the route.

export function SessionSidebar() {
  const { queries } = useServices()
  const { data } = useQuery(queries.sessions())
  const params = useParams({ strict: false }) as { sessionId?: string }
  const navigate = useNavigate()
  // relative times ("5 min ago") keep moving, and a recording's clock with them
  const now = useNow(30_000)
  const items: NavItem[] = useMemo(
    () =>
      (data?.ordered ?? []).map((s) => ({
        id: s.id,
        textValue: displayTitle(s),
        content: (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{displayTitle(s)}</span>
            <span className="truncate text-[9pt] text-dim">{sessionSubtitle(s, now)}</span>
          </div>
        ),
      })),
    [data, now],
  )
  return (
    <nav aria-label={_('Sessions')} className="min-h-0 flex-1 overflow-y-auto">
      <NavigationList
        label={_('Sessions')}
        items={items}
        selected={params.sessionId ?? null}
        onSelect={(id) => void navigate({ to: '/sessions/$sessionId', params: { sessionId: id } })}
        empty={
          data ? (
            <div className="px-3 py-6 text-center">
              <p className="m-0 font-bold">{_('No Sessions Yet')}</p>
              <p className="m-0 text-dim">{_('Press Record to capture your first meeting.')}</p>
            </div>
          ) : null
        }
      />
    </nav>
  )
}
