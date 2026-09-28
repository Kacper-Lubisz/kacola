import type { ChildProcess } from 'node:child_process'

// Children we must not leak if the host exits without stopping us.
const live = new Set<ChildProcess>()
let hooked = false
export function trackChild(child: ChildProcess): void {
  live.add(child)
  child.on('exit', () => live.delete(child))
  if (!hooked) {
    hooked = true
    process.on('exit', () => {
      for (const c of live) c.kill('SIGKILL')
    })
  }
}
