import type { AgentAction, AgentMode, AgentPresenceState, LeaseInfo, Session } from '@gnomeola/protocol'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Chip,
  Icon,
  IconButton,
  Popover,
  SegmentedControl,
  Switch,
  Tooltip,
} from '../../design/primitives/index.ts'
import { useAgendaMutation } from './agenda-data.ts'
import { MODES, modeDescription, modeLabel } from './labels.ts'
import { revokeLeaseMutation, setAgentAccessMutation, updateLeaseMutation } from './mutations.ts'

// Who else is in the meeting: the user's connected agents (the agent channel's leases), in the live
// header. "Your Claude · can suggest" (what it may do), with a pulse while it reads (none under reduced motion), its recent
// activity on hover, and — pressed — the mode (observe / suggest / act), its full activity, Disconnect
// (revokes the lease), and for a private meeting the switch that allows agents at all. Presence arrives
// as ephemeral agent.presence events (the pulse); the lease list is the daemon's, refetched on each.

/** "Claude", or "Claude (work-laptop)" for an agent not simply named claude. */
export function agentTitle(name: string): string {
  return name.toLowerCase() === 'claude' ? 'Claude' : fmt(_('Claude ({name})'), { name })
}

/** What a connected agent may do, said plainly: the pill on the live header. */
export function permissionLabel(mode: AgentMode): string {
  switch (mode) {
    case 'observe':
      return _('can read along')
    case 'suggest':
      return _('can suggest')
    case 'act':
      return _('can check items off')
  }
}

export function presenceLabel(s: AgentPresenceState): string {
  switch (s) {
    case 'connected':
      return _('connected')
    case 'reading':
      return _('reading')
    case 'idle':
      return _('idle')
    case 'disconnected':
      return _('disconnected')
  }
}

const OUTCOME: Record<AgentAction['outcome'], string> = {
  applied: '✓',
  suggested: '?',
  refused: '✕',
}

function ActionList({ actions, max }: { actions: AgentAction[]; max: number }) {
  const recent = actions.slice(-max).reverse()
  if (!recent.length) return <p className="m-0 type-callout text-text-secondary">{_('Nothing yet.')}</p>
  return (
    <ol aria-label={_('Activity')} className="m-0 flex list-none flex-col gap-1 p-0">
      {recent.map((a) => (
        <li key={`${a.at}:${a.summary}`} className="flex items-baseline gap-2 type-callout">
          <span className="font-mono text-[13px] text-text-tertiary tabular-nums">
            {formatClockTime(a.at)}
          </span>
          <span aria-hidden="true" className="text-text-secondary">
            {OUTCOME[a.outcome]}
          </span>
          <span className="min-w-0 flex-1 break-words text-text-primary">
            {a.summary}
            {a.outcome === 'refused' ? ` (${_('refused')})` : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}

function LeaseDetails({ session, lease }: { session: Session; lease: LeaseInfo }) {
  const setMode = useAgendaMutation(updateLeaseMutation, _('Could not change the mode'))
  const revoke = useAgendaMutation(revokeLeaseMutation, _('Could not disconnect'))
  return (
    <section aria-label={agentTitle(lease.name)} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon name="agent" size={18} className="text-text-secondary" />
        <h2 className="m-0 flex-1 type-headline text-text-primary">{agentTitle(lease.name)}</h2>
        <Chip tone={lease.state === 'reading' ? 'info' : 'neutral'}>{presenceLabel(lease.state)}</Chip>
      </div>
      <SegmentedControl
        label={fmt(_('What {name} may do'), { name: agentTitle(lease.name) })}
        segments={MODES.map((m) => ({ id: m, label: modeLabel(m) }))}
        value={lease.mode}
        onChange={(mode) => setMode.mutate({ sessionId: session.id, leaseId: lease.id, mode })}
      />
      <p className="m-0 type-caption text-text-secondary">{modeDescription(lease.mode)}</p>
      <p className="m-0 type-caption text-text-secondary">
        {[
          fmt(ngettext('{n} checked off', '{n} checked off', lease.counts.statusChanges), {
            n: lease.counts.statusChanges,
          }),
          fmt(ngettext('{n} suggestion', '{n} suggestions', lease.counts.suggestions), {
            n: lease.counts.suggestions,
          }),
          fmt(ngettext('{n} context card', '{n} context cards', lease.counts.context), {
            n: lease.counts.context,
          }),
        ].join(' · ')}
      </p>
      <ActionList actions={lease.actions} max={20} />
      <div>
        <Button
          variant="destructive"
          size="sm"
          icon="disconnect"
          onPress={() => revoke.mutate({ sessionId: session.id, leaseId: lease.id })}
        >
          {_('Disconnect')}
        </Button>
      </div>
    </section>
  )
}

/** The private-meeting switch: agents may attach only if the user allows it here. */
export function AgentAccessSwitch({ session }: { session: Session }) {
  const { queries } = useServices()
  const { data } = useQuery(queries.agentAccess(session.id))
  const set = useAgendaMutation(setAgentAccessMutation, _('Could not change agent access'))
  if (!data?.private) return null
  return (
    <div className="flex flex-col gap-1 border-t border-border-subtle pt-2">
      <Switch
        isSelected={data.allowAgents}
        onChange={(v) => set.mutate({ sessionId: session.id, allowAgents: v })}
      >
        <span className="type-callout">{_('Allow agents in this private meeting')}</span>
      </Switch>
      <p className="m-0 type-caption text-text-secondary">
        {_('Off: no agent can read it, and connected ones are disconnected.')}
      </p>
    </div>
  )
}

export function PresenceChip({ session }: { session: Session }) {
  const { queries, store } = useServices()
  const live = session.status === 'recording' || session.status === 'paused'
  const { data: leases } = useQuery({ ...queries.leases(session.id), enabled: live })
  const presence = useStore(store, (s) => s.presence[session.id])
  if (!live) return null
  const active = (leases ?? [])
    .filter((l) => l.endedAt === null)
    .map((l) => {
      const p = presence?.[l.id]
      return p && p.at > Date.parse(l.heartbeatAt) - 60_000 ? { ...l, state: p.state, mode: p.mode } : l
    })
    .filter((l) => l.state !== 'disconnected')
  if (!active.length)
    return session.private ? (
      <Popover
        label={_('Agent access')}
        className="w-[320px]"
        trigger={<IconButton icon="agent" label={_('Agent access')} />}
      >
        <p className="m-0 mb-2 type-callout text-text-secondary">{_('No agent is connected.')}</p>
        <AgentAccessSwitch session={session} />
      </Popover>
    ) : null
  const lead = active[0]!
  const reading = active.some((l) => l.state === 'reading')
  const label =
    active.length > 1
      ? fmt(_('{n} agents · {permission}'), { n: active.length, permission: permissionLabel(lead.mode) })
      : fmt(_('Your {agent} · {permission}'), {
          agent: agentTitle(lead.name),
          permission: permissionLabel(lead.mode),
        })
  return (
    <Popover
      label={_('Connected agents')}
      className="w-[360px]"
      placement="bottom end"
      trigger={
        <Tooltip
          content={
            <span className="flex flex-col gap-0.5">
              {lead.actions.length
                ? lead.actions
                    .slice(-3)
                    .reverse()
                    .map((a) => <span key={`${a.at}:${a.summary}`}>{a.summary}</span>)
                : _('No activity yet')}
            </span>
          }
        >
          {/* as tall as the recording pill and the controls beside it in the live header */}
          <Button
            size="sm"
            pill
            className="!h-9 !px-3.5"
            aria-label={fmt(_('{label}. Show agent'), { label })}
          >
            <span aria-hidden="true" className="relative flex size-2">
              {reading ? (
                <span className="record-pulse absolute inset-0 rounded-full bg-status-info" />
              ) : null}
              <span className="relative size-2 rounded-full bg-status-success" />
            </span>
            {label}
          </Button>
        </Tooltip>
      }
    >
      <div className="flex flex-col gap-4">
        {active.map((l) => (
          <LeaseDetails key={l.id} session={session} lease={l} />
        ))}
        <AgentAccessSwitch session={session} />
      </div>
    </Popover>
  )
}
