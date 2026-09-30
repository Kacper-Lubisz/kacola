import type { AgendaView, Session } from '@gnomeola/protocol'
import { carriesOver, parseRecapOutcome, statusCounts } from '@gnomeola/ui-core/agendas'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useServices } from '../../data/services.tsx'
import { Button, Card, Chip, Icon } from '../../design/primitives/index.ts'
import { EvidenceChip } from './evidence.tsx'
import { STATUS_ICON, STATUS_TONE, statusLabel } from './labels.ts'

// The recap after the meeting: per item, what became of it — the outcome, decisions and actions the recap
// hook wrote (in the recap prompt's form, read by ui-core's parseRecapOutcome), else the item's own outcome
// and the evidence that settled it — and, for a recurring meeting, which items roll to the next
// occurrence (with a link to that agenda once it exists).

function NextOccurrence({ view }: { view: AgendaView }) {
  const { queries } = useServices()
  const navigate = useNavigate()
  const { data } = useQuery(queries.agendas())
  const next = data?.find((a) => a.carriedFrom === view.agenda.id)
  const rolling = carriesOver(view)
  if (!rolling.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2">
      <Icon name="carry" size={18} className="shrink-0 text-text-secondary" />
      <span className="min-w-0 flex-1 type-callout text-text-primary">
        {fmt(
          ngettext(
            '{n} open item carries over to the next meeting',
            '{n} open items carry over to the next meeting',
            rolling.length,
          ),
          { n: rolling.length },
        )}
      </span>
      {next ? (
        <Button
          size="sm"
          onPress={() => void navigate({ to: '/agendas/$agendaId', params: { agendaId: next.id } })}
        >
          {_('Open Next Agenda')}
        </Button>
      ) : null}
    </div>
  )
}

export function RecapView({ view, session }: { view: AgendaView; session: Session }) {
  const items = [...view.items].sort((a, b) => a.order - b.order)
  const counts = statusCounts(items)
  void session
  return (
    <section aria-labelledby="recap" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="recap" className="m-0 type-title2 text-text-primary">
          {_('Recap')}
        </h2>
        <p className="m-0 type-callout text-text-secondary">
          {fmt(_('{covered} covered · {skipped} skipped · {open} still open'), {
            covered: counts.covered,
            skipped: counts.skipped,
            open: counts.open + counts['in-progress'] + counts.parked,
          })}
        </p>
      </div>
      <NextOccurrence view={view} />
      <ol aria-label={_('Recap per item')} className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((i) => {
          const r = parseRecapOutcome(i.outcome)
          return (
            <li key={i.id} aria-label={i.text}>
              <Card className="flex flex-col gap-2 p-3">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 type-headline break-words text-text-primary">{i.text}</span>
                  <Chip icon={STATUS_ICON[i.status]} tone={STATUS_TONE[i.status]}>
                    {statusLabel(i.status)}
                  </Chip>
                </div>
                {r.outcome ? (
                  <p className="m-0 type-body break-words text-text-primary">{r.outcome}</p>
                ) : (
                  <p className="m-0 type-callout text-text-secondary">{_('No outcome recorded.')}</p>
                )}
                {r.decisions.length ? (
                  <div className="flex flex-col gap-1">
                    <h3 className="m-0 type-overline text-text-secondary">{_('Decisions')}</h3>
                    <ul className="m-0 flex flex-col gap-0.5 pl-5">
                      {r.decisions.map((d) => (
                        <li key={d} className="type-callout text-text-primary">
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {r.actions.length ? (
                  <div className="flex flex-col gap-1">
                    <h3 className="m-0 type-overline text-text-secondary">{_('Actions')}</h3>
                    <ul className="m-0 flex flex-col gap-0.5 pl-5">
                      {r.actions.map((a) => (
                        <li key={`${a.owner}:${a.text}`} className="type-callout text-text-primary">
                          {a.owner ? <strong className="font-semibold">{a.owner}: </strong> : null}
                          {a.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {i.evidence.length ? (
                  <div className="flex flex-wrap gap-1">
                    {i.evidence.slice(-2).map((ev) => (
                      <EvidenceChip key={`${ev.segmentId}:${ev.quote}`} sessionId={view.agenda.sessionId} ev={ev} />
                    ))}
                  </div>
                ) : null}
              </Card>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
