import { displayTitle, statusSummary } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { useQuery } from '@tanstack/react-query'
import { useServices } from '../../data/services.tsx'
import { HeaderBar } from '../../design/primitives/index.ts'
import type { SessionSearch } from '../transcript/search-params.ts'
import { SessionPanes } from '../transcript/session-panes.tsx'

// Placeholder session detail (phase 2 replaces the body with the transcript / notes / ask views).
export function SessionPage({ sessionId, search = {} }: { sessionId: string; search?: SessionSearch }) {
  const { queries } = useServices()
  const { data: session } = useQuery(queries.session(sessionId))
  const now = useNow(30_000)
  if (!session) return null
  return (
    <div className="flex h-full min-h-0 flex-col bg-view">
      <HeaderBar controls="end" title={displayTitle(session)} />
      <div className="flex flex-col gap-1 px-6 py-4">
        <h1 className="m-0 text-[15pt] font-extrabold">{displayTitle(session)}</h1>
        <p className="m-0 text-dim">{statusSummary(session, now)}</p>
      </div>
      <SessionPanes sessionId={sessionId} search={search} />
    </div>
  )
}
