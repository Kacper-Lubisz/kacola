import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import { type Spawned, spawnGuarded, stopProcess } from '../ui/processes.ts'

// V-4b infrastructure for the GNOME Shell extension, on top of the headless display (../ui):
//
//   * UNSAFE_MODE_EXTENSION — a test-only companion extension that puts the NESTED Shell into unsafe
//     mode, so org.gnome.Shell.Eval works there. GNOME Shell 50 has no command-line switch for it (only
//     Looking Glass sets it), and the alternative — a test hook inside the production extension — would
//     ship test code to users. Eval is then used to read the real indicator's actors and to activate
//     menu items exactly as a click does (the item's `activate` signal).
//   * startFakeKacola — a scriptable com.kacperlubisz.Kacola service speaking the real bridge's line
//     protocol, for rendering every state the extension must handle without a daemon.
//
// Everything here runs against the display's PRIVATE session bus (display.env); never the user's.

const run = promisify(execFile)

export const UNSAFE_MODE_EXTENSION = resolve(import.meta.dirname, 'unsafe-mode@kacola.test')
const FAKE_SCRIPT = resolve(import.meta.dirname, 'fake-kacola.js')
export const INTERFACE_XML_PATH = resolve(
  import.meta.dirname,
  '../../../daemon/dbus/com.kacperlubisz.Kacola.xml',
)

function busAddress(env: Record<string, string>): string {
  const a = env.DBUS_SESSION_BUS_ADDRESS
  if (!a?.startsWith('unix:path=/'))
    throw new Error(`refusing a session bus that is not a private socket: ${a}`)
  return a
}

/**
 * Evaluate JavaScript inside the nested Shell (needs UNSAFE_MODE_EXTENSION enabled). The code's value is
 * JSON-serialised by the Shell and parsed here; a thrown error or a refused Eval rejects.
 */
export async function shellEval<T = unknown>(env: Record<string, string>, code: string): Promise<T> {
  const { stdout } = await run(
    'busctl',
    [
      `--address=${busAddress(env)}`,
      '--json=short',
      'call',
      'org.gnome.Shell',
      '/org/gnome/Shell',
      'org.gnome.Shell',
      'Eval',
      's',
      code,
    ],
    { env: { PATH: env.PATH ?? '/usr/bin:/bin' }, timeout: 15_000 },
  )
  const { data } = JSON.parse(stdout) as { data: [boolean, string] }
  const [ok, value] = data
  if (!ok) throw new Error(`Shell Eval failed${value ? `: ${value}` : ' (is the Shell in unsafe mode?)'}`)
  return (value === '' ? undefined : JSON.parse(value)) as T
}

/** State of an installed extension in the nested Shell: 1 = active (ENABLED on Shell 50), plus any error. */
export async function extensionState(
  env: Record<string, string>,
  uuid: string,
): Promise<{ state: number; stateName: string; error: string | null } | null> {
  const { stdout } = await run(
    'busctl',
    [
      `--address=${busAddress(env)}`,
      '--json=short',
      'call',
      'org.gnome.Shell',
      '/org/gnome/Shell',
      'org.gnome.Shell.Extensions',
      'GetExtensionInfo',
      's',
      uuid,
    ],
    { env: { PATH: env.PATH ?? '/usr/bin:/bin' }, timeout: 15_000 },
  )
  const { data } = JSON.parse(stdout) as { data: [Record<string, { type: string; data: unknown }>] }
  const info = data[0]
  if (!info || !('state' in info)) return null
  const state = Number(info.state!.data)
  const names: Record<number, string> = {
    1: 'active',
    2: 'inactive',
    3: 'error',
    4: 'out-of-date',
    5: 'downloading',
    6: 'initialized',
    7: 'deactivating',
    8: 'activating',
  }
  return {
    state,
    stateName: names[state] ?? String(state),
    error: info.error?.data ? String(info.error.data) : null,
  }
}

// ------------------------------------------------------------------------------------ fake service

export type FakeCall = { id: number; method: string; args: unknown[] }
export type FakeReply = { result: unknown[] } | { error: { name: string; message: string } }

export type FakeKacola = {
  /** Set properties (bridge-protocol values); PropertiesChanged is emitted for real changes. */
  setProps(props: Record<string, unknown>): void
  signal(name: string, args: unknown[]): void
  /** Every method call received so far. */
  readonly calls: FakeCall[]
  /** Answer calls: return a reply. Default: Start/Stop → ['ses_fake'], Join → ['ses_fake', ''], others → []. */
  onCall: (call: FakeCall) => FakeReply | Promise<FakeReply>
  waitForCall(method: string, timeoutMs?: number): Promise<FakeCall>
  log(): string
  stop(): Promise<void>
}

export async function startFakeKacola(env: Record<string, string>): Promise<FakeKacola> {
  busAddress(env)
  const proc: Spawned = spawnGuarded('fake-kacola', 'gjs', ['-m', FAKE_SCRIPT, INTERFACE_XML_PATH], {
    env,
    stdin: 'pipe',
  })
  const calls: FakeCall[] = []
  const waiters: { method: string; resolve: (c: FakeCall) => void }[] = []
  const write = (msg: unknown) => proc.child.stdin!.write(`${JSON.stringify(msg)}\n`)
  let out = ''
  const fake: FakeKacola = {
    setProps: (props) => write({ type: 'props', props }),
    signal: (name, args) => write({ type: 'signal', name, args }),
    calls,
    onCall: (c) => {
      if (c.method === 'Start' || c.method === 'Stop') return { result: ['ses_fake'] }
      if (c.method === 'Join') return { result: ['ses_fake', ''] }
      return { result: [] }
    },
    waitForCall(method, timeoutMs = 10_000) {
      const seen = calls.find((c) => c.method === method)
      if (seen) return Promise.resolve(seen)
      return new Promise((resolveCall, reject) => {
        const t = setTimeout(() => reject(new Error(`no ${method} call within ${timeoutMs}ms`)), timeoutMs)
        waiters.push({
          method,
          resolve: (c) => {
            clearTimeout(t)
            resolveCall(c)
          },
        })
      })
    },
    log: () => `${out}\n${proc.log()}`,
    async stop() {
      proc.child.stdin?.end()
      await stopProcess(proc, 2000)
    },
  }
  const acquired = new Promise<void>((resolveAcquired, reject) => {
    const rl = createInterface({ input: proc.child.stdout! })
    rl.on('line', (line) => {
      out += `${line}\n`
      let msg: { type: string; id?: number; method?: string; args?: unknown[] }
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }
      if (msg.type === 'acquired') resolveAcquired()
      if (msg.type === 'lost') reject(new Error('fake kacola could not own com.kacperlubisz.Kacola'))
      if (msg.type === 'call') {
        const call = { id: msg.id!, method: msg.method!, args: msg.args ?? [] }
        calls.push(call)
        for (const w of waiters.filter((x) => x.method === call.method)) {
          waiters.splice(waiters.indexOf(w), 1)
          w.resolve(call)
        }
        void Promise.resolve(fake.onCall(call)).then((reply) =>
          write({ type: 'reply', id: call.id, ...reply }),
        )
      }
    })
    void proc.exited.then(() => reject(new Error(`fake kacola exited\n${proc.log()}`)))
  })
  await Promise.race([
    acquired,
    new Promise((_, reject) => setTimeout(() => reject(new Error('fake kacola did not start')), 10_000)),
  ])
  return fake
}

/** Path of the kacola extension source in this repo. */
export const KACOLA_EXTENSION = resolve(import.meta.dirname, '../../../../extensions/kacola@kacperlubisz.com')
export const KACOLA_UUID = 'kacola@kacperlubisz.com'

/** A .desktop handler for https/http links that appends each URL it is asked to open to `logFile`. */
export function fakeUrlHandler(dataHome: string, configHome: string, logFile: string): void {
  // (call it from the display's prepare() hook, before the Shell starts)
  const apps = join(dataHome, 'applications')
  mkdirSync(apps, { recursive: true })
  const script = join(apps, 'kacola-test-url-handler.sh')
  writeFileSync(script, `#!/bin/sh\nprintf '%s\\n' "$1" >> '${logFile}'\n`, { mode: 0o755 })
  writeFileSync(
    join(apps, 'kacola-test-url-handler.desktop'),
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=URL recorder (tests)',
      `Exec=${script} %u`,
      'MimeType=x-scheme-handler/http;x-scheme-handler/https;',
      'NoDisplay=true',
      '',
    ].join('\n'),
  )
  mkdirSync(configHome, { recursive: true })
  writeFileSync(
    join(configHome, 'mimeapps.list'),
    [
      '[Default Applications]',
      'x-scheme-handler/http=kacola-test-url-handler.desktop',
      'x-scheme-handler/https=kacola-test-url-handler.desktop',
      '',
    ].join('\n'),
  )
}
