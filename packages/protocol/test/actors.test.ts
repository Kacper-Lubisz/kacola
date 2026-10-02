import { describe, expect, it } from 'vitest'
import { actorOf, publicActorLabel, type SharedActor } from '../src/index.ts'

// Five actors, one wording everywhere: you, kacola, your Claude, Ben's Claude, Ben.

describe('actorOf', () => {
  const names = (label: string) => ({ 'ben@x.com': 'Ben', 'ivy@y.org': 'Ivy' })[label] ?? null

  it('names every changedBy form', () => {
    expect(actorOf('user')).toEqual({ kind: 'you', label: 'you', person: null })
    expect(actorOf('tracker')).toEqual({ kind: 'kacola', label: 'kacola', person: null })
    expect(actorOf('agent:claude')).toEqual({ kind: 'your-agent', label: 'your Claude', person: null })
    expect(actorOf('agent:codex').label).toBe('your Codex')
    expect(actorOf('peer:ben@x.com', { names })).toEqual({ kind: 'person', label: 'Ben', person: 'Ben' })
    expect(actorOf('peer:ben@x.com/agent:claude', { names })).toEqual({
      kind: 'their-agent',
      label: "Ben's Claude",
      person: 'Ben',
    })
    expect(actorOf('peer:ben@x.com/tracker', { names })).toEqual({
      kind: 'kacola',
      label: 'kacola',
      person: 'Ben',
    })
    expect(actorOf('invitee:ivy@y.org', { names }).label).toBe('Ivy')
    // without a name the label stands in; never "(tracker)" or "auto"
    expect(actorOf('peer:zed@z.com/agent:claude').label).toBe("zed@z.com's Claude")
  })
})

describe('publicActorLabel (the invitee web page)', () => {
  const actor = (o: Partial<SharedActor>): SharedActor => ({
    participantId: 'owner',
    role: 'owner',
    label: 'kacper@x.com',
    name: null,
    by: 'user',
    ...o,
  })

  it('a tracker is kacola, an agent is "<name>\'s Claude", a person is their name', () => {
    expect(publicActorLabel(actor({}), 'Kacper')).toBe('Kacper')
    expect(publicActorLabel(actor({ by: 'tracker' }), 'Kacper')).toBe('kacola')
    expect(publicActorLabel(actor({ by: 'agent:claude' }), 'Kacper')).toBe("Kacper's Claude")
    const ben = { participantId: 'spt_1', role: 'member' as const, label: 'ben@x.com', name: 'Ben' }
    expect(publicActorLabel(actor({ ...ben, by: 'agent:claude' }), 'Kacper')).toBe("Ben's Claude")
    expect(publicActorLabel(actor({ ...ben, by: 'tracker' }), 'Kacper')).toBe('kacola')
    expect(publicActorLabel(actor({ ...ben, name: null }), 'Kacper')).toBe('b…@x.com')
  })
})
