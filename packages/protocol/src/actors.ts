import { z } from 'zod'

// Who did something, in words a person reads. Five actors, the same everywhere (the window, the CLI, the
// invitee web page, the API):
//
//   you             the user (the window, the CLI)
//   kacola          the on-device live tracker (yours, or another attendee's on a shared agenda)
//   your Claude     an agent you connected (`agent:claude` → "your Claude", `agent:codex` → "your Codex")
//   Ben's Claude    another attendee's agent on a shared agenda
//   Ben             another person: an attendee's device, or an invitee through the web page
//
// `changedBy` on the wire stays the machine form (protocol agendas.ts ChangedBy); this is its display.

export const ActorKind = z.enum(['you', 'kacola', 'your-agent', 'their-agent', 'person'])
export type ActorKind = z.infer<typeof ActorKind>

export const Actor = z.object({
  kind: ActorKind,
  /** The display: "you", "kacola", "your Claude", "Ben's Claude", "Ben". */
  label: z.string(),
  /** The person it belongs to, when not you: "Ben" for Ben's Claude, Ben, and Ben's tracker. */
  person: z.string().nullable(),
})
export type Actor = z.infer<typeof Actor>

/** `claude` → "Claude", `my-bot` → "My-bot". */
export const agentDisplayName = (name: string): string =>
  name ? name.charAt(0).toUpperCase() + name.slice(1) : 'agent'

/** "Ben" → "Ben's"; "James" → "James's". */
export const possessive = (name: string): string => `${name}'s`

/**
 * The display of a `changedBy` value. `names` resolves an email or a peer label to a person's name
 * (a shared agenda's participants); without one the label is shown as given.
 */
export function actorOf(by: string, o: { names?: (label: string) => string | null } = {}): Actor {
  const name = (label: string) => o.names?.(label) ?? label
  if (by === 'user') return { kind: 'you', label: 'you', person: null }
  if (by === 'tracker') return { kind: 'kacola', label: 'kacola', person: null }
  if (by.startsWith('agent:'))
    return { kind: 'your-agent', label: `your ${agentDisplayName(by.slice(6))}`, person: null }
  if (by.startsWith('invitee:')) {
    const who = name(by.slice(8))
    return { kind: 'person', label: who, person: who }
  }
  if (by.startsWith('peer:')) {
    const [label = '', sub] = by.slice(5).split('/', 2) as [string, string | undefined]
    const who = name(label)
    if (sub === 'tracker') return { kind: 'kacola', label: 'kacola', person: who }
    if (sub?.startsWith('agent:'))
      return {
        kind: 'their-agent',
        label: `${possessive(who)} ${agentDisplayName(sub.slice(6))}`,
        person: who,
      }
    return { kind: 'person', label: who, person: who }
  }
  return { kind: 'person', label: by, person: by }
}
