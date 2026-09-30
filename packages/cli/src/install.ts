import { createHash } from 'node:crypto'
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'

// P-4: put `gnomeola` on the user's PATH, for each way gnomeola is installed, so agents (and people) get
// the CLI and the Claude skill from installing the app. The desktop app's first run and Preferences call
// this through the bundled CLI (`gnomeola install-cli --json`), so the logic lives here once.
//
//   flatpak  ~/.local/bin/gnomeola → `flatpak run --command=gnomeola org.gnome.Gnomeola "$@"`
//            (the Flatpak has --filesystem=~/.local/bin:create for exactly this)
//   macos    /usr/local/bin/gnomeola if writable (the app asks for admin rights first), else
//            ~/.local/bin/gnomeola → the .app's Electron binary as Node + Resources/runtime/cli.mjs
//   dev      ~/.local/bin/gnomeola → this Node (or Electron-as-Node) + this cli entry
//
// The shim is a small POSIX sh script carrying a marker line, so we only ever update or remove our own:
// a `gnomeola` we did not write is never clobbered without --force, and a different `gnomeola` earlier
// on PATH is reported. When the daemon is down (exit 3), the shim starts the app with --background — it
// runs the daemon — waits for it to answer, and runs the command again (safe: nothing reached a daemon).

export type InstallMode = 'flatpak' | 'macos' | 'dev'

export const SHIM_MARKER = '# gnomeola-cli-shim v1'
export const APP_ID = 'org.gnome.Gnomeola'

export type ShimSpec = {
  mode: InstallMode
  /** argv (plus leading VAR=value words) that runs the CLI; the shim appends "$@". */
  run: string[]
  /** Shell command that starts the app in the background, or null: no autostart. */
  launch: string | null
}

export type SpecOptions = {
  /** macos: the .app bundle. */
  appPath?: string
  /** macos: the app's executable inside Contents/MacOS (default: gnomeola). */
  appExecutable?: string
  /** dev: the runtime (node, or Electron with ELECTRON_RUN_AS_NODE) and the CLI entry. */
  node?: string
  entry?: string
  asElectron?: boolean
  /** Overrides the mode's app launch command. */
  launch?: string | null
}

/** Single-quote a word for sh. */
export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

export function shimSpec(mode: InstallMode, o: SpecOptions = {}): ShimSpec {
  if (mode === 'flatpak')
    return {
      mode,
      run: ['flatpak', 'run', `--command=gnomeola`, APP_ID],
      launch: o.launch !== undefined ? o.launch : `flatpak run ${APP_ID} --background`,
    }
  if (mode === 'macos') {
    if (!o.appPath) throw new Error('macos mode needs the .app path')
    const exe = join(o.appPath, 'Contents', 'MacOS', o.appExecutable ?? 'gnomeola')
    return {
      mode,
      run: ['ELECTRON_RUN_AS_NODE=1', exe, join(o.appPath, 'Contents', 'Resources', 'runtime', 'cli.mjs')],
      // -g: do not bring the app to the front; it starts without a window
      launch: o.launch !== undefined ? o.launch : `open -g -a ${shq(o.appPath)} --args --background`,
    }
  }
  if (!o.node || !o.entry) throw new Error('dev mode needs the runtime and the CLI entry')
  return {
    mode,
    run: [...(o.asElectron ? ['ELECTRON_RUN_AS_NODE=1'] : []), o.node, o.entry],
    launch: o.launch ?? null,
  }
}

export function renderShim(spec: ShimSpec): string {
  const words = spec.run.map((w) =>
    /^[A-Z_]+=/.test(w) ? `${w.split('=')[0]}=${shq(w.slice(w.indexOf('=') + 1))}` : shq(w),
  )
  return `#!/bin/sh
${SHIM_MARKER} (${spec.mode}) — written by \`gnomeola install-cli\`; \`gnomeola uninstall-cli\` removes it.
# Runs the gnomeola CLI from the app. If the daemon is not running, starts the app in the background (it
# runs the daemon), waits up to $GNOMEOLA_START_TIMEOUT seconds (default 30) and runs the command again.
# $GNOMEOLA_APP_LAUNCH replaces the launch command; GNOMEOLA_NO_AUTOSTART=1 turns this off.
gnomeola_run() {
  ${words.join(' ')} "$@"
}
gnomeola_launch() {
  if [ -n "\${GNOMEOLA_APP_LAUNCH:-}" ]; then sh -c "$GNOMEOLA_APP_LAUNCH"; return; fi
  ${spec.launch ?? 'return 1'}
}
GNOMEOLA_SHIM=1 gnomeola_run "$@"
code=$?
[ "$code" -eq 3 ] || exit "$code"
[ -z "\${GNOMEOLA_NO_AUTOSTART:-}" ] || exit 3
# a remote daemon is not ours to start (a loopback GNOMEOLA_URL is: a port other than the default)
case "\${GNOMEOLA_URL:-}" in "" | http://127.0.0.1:* | http://localhost:* | "http://[::1]:"*) ;; *) exit 3 ;; esac
case " $* " in *" --url "* | *" --url="*) exit 3 ;; esac
[ -n "\${GNOMEOLA_APP_LAUNCH:-}" ] || ${spec.launch ? 'true' : 'exit 3'}
echo "gnomeola: starting the gnomeola app in the background…" >&2
(gnomeola_launch </dev/null >/dev/null 2>&1 &)
waited=0
while [ "$waited" -lt "\${GNOMEOLA_START_TIMEOUT:-30}" ]; do
  sleep 1
  waited=$((waited + 1))
  if GNOMEOLA_SHIM=1 gnomeola_run status >/dev/null 2>&1; then
    gnomeola_run "$@"
    exit $?
  fi
done
echo "gnomeola: the app did not start its daemon within \${GNOMEOLA_START_TIMEOUT:-30}s" >&2
exit 3
`
}

// ------------------------------------------------------------------------------------ install

export type Fs = {
  exists(p: string): boolean
  read(p: string): string
  writable(dir: string): boolean
  isExecutable(p: string): boolean
}

export const nodeFs: Fs = {
  exists: existsSync,
  read: (p) => readFileSync(p, 'utf8'),
  writable: (dir) => {
    try {
      accessSync(dir, constants.W_OK)
      return true
    } catch {
      return false
    }
  },
  isExecutable: (p) => {
    try {
      accessSync(p, constants.X_OK)
      return statSync(p).isFile()
    } catch {
      return false
    }
  },
}

export type InstallOptions = {
  spec: ShimSpec
  home: string
  /** PATH to analyse (shadowing, whether the bin dir is on it). */
  path: string
  /** Replaces the mode's candidate directories. */
  binDir?: string
  /** Replace a `gnomeola` this tool did not write. */
  force?: boolean
  /** The skill: its source text and where skills live (default ~/.claude/skills); null to skip. */
  skill: { source: string; root?: string; force?: boolean } | null
  dryRun?: boolean
}

export type ShimAction = 'installed' | 'updated' | 'unchanged' | 'replaced'
export type InstallReport = {
  mode: InstallMode
  shim: { path: string; action: ShimAction }
  skill: { path: string; action: 'installed' | 'updated' | 'unchanged' | 'kept-edited' } | null
  /** Is the shim's directory on PATH? */
  onPath: boolean
  /** Another `gnomeola` that PATH finds before ours. */
  shadowedBy: string | null
  /** Other `gnomeola`s later on PATH, which ours now hides. */
  shadows: string[]
  /** macOS: /usr/local/bin needed admin rights, so the shim went to the fallback. */
  needsAdmin: string | null
  warnings: string[]
}

export class InstallError extends Error {
  override name = 'InstallError'
  readonly conflict: string | null
  constructor(message: string, conflict: string | null = null) {
    super(message)
    this.conflict = conflict
  }
}

export function binCandidates(mode: InstallMode, home: string): string[] {
  const local = join(home, '.local', 'bin')
  return mode === 'macos' ? ['/usr/local/bin', local] : [local]
}

const isOurs = (text: string) => text.includes(SHIM_MARKER)

/** Every executable `gnomeola` on PATH, in lookup order. */
export function whichAll(path: string, fs: Fs = nodeFs): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const d of path.split(delimiter)) {
    if (!d) continue
    const p = join(resolve(d), 'gnomeola')
    if (seen.has(p)) continue
    seen.add(p)
    if (fs.isExecutable(p)) out.push(p)
  }
  return out
}

function atomicWrite(path: string, content: string, mode: number): void {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, content, { mode })
  chmodSync(tmp, mode)
  renameSync(tmp, path)
}

export function installCli(o: InstallOptions, fs: Fs = nodeFs): InstallReport {
  const content = renderShim(o.spec)
  const warnings: string[] = []
  let needsAdmin: string | null = null
  let chosen: { path: string; action: ShimAction } | null = null
  const foreign: string[] = []
  for (const dir of o.binDir ? [o.binDir] : binCandidates(o.spec.mode, o.home)) {
    const target = join(dir, 'gnomeola')
    const userDir = o.binDir !== undefined || dir.startsWith(o.home)
    if (!fs.exists(dir)) {
      if (!userDir) continue // never create system directories
      if (!o.dryRun) mkdirSync(dir, { recursive: true })
    } else if (!fs.writable(dir)) {
      if (!userDir) needsAdmin = dir
      warnings.push(`${dir} is not writable${userDir ? '' : ' without administrator rights'}`)
      continue
    }
    let action: ShimAction = 'installed'
    if (fs.exists(target)) {
      const current = fs.read(target)
      if (current === content) action = 'unchanged'
      else if (isOurs(current)) action = 'updated'
      else if (o.force) {
        action = 'replaced'
        warnings.push(`replaced ${target}, which was not written by gnomeola install-cli`)
      } else {
        foreign.push(target)
        warnings.push(`${target} exists and was not written by gnomeola install-cli; left alone`)
        continue
      }
    }
    if (action !== 'unchanged' && !o.dryRun) atomicWrite(target, content, 0o755)
    chosen = { path: target, action }
    break
  }
  if (!chosen)
    throw new InstallError(
      foreign.length
        ? `a different gnomeola is already installed at ${foreign.join(', ')}; pass --force to replace it`
        : `no writable directory for the gnomeola command (${warnings.join('; ')})`,
      foreign[0] ?? null,
    )

  const onPath = o.path.split(delimiter).some((d) => d && resolve(d) === dirname(chosen.path))
  if (!onPath)
    warnings.push(`${dirname(chosen.path)} is not on your PATH; add it to use \`gnomeola\` by name`)
  const found = whichAll(o.path, fs)
  const firstOther = found.find((p) => p !== chosen.path) ?? null
  const ourIndex = found.indexOf(chosen.path)
  const shadowedBy =
    firstOther && (ourIndex === -1 || found.indexOf(firstOther) < ourIndex) ? firstOther : null
  if (shadowedBy) warnings.push(`another gnomeola at ${shadowedBy} comes first on PATH and will run instead`)
  const shadows = ourIndex === -1 ? [] : found.slice(ourIndex + 1)

  const skill = o.skill
    ? writeSkill(o.skill.root ?? join(o.home, '.claude', 'skills'), o.skill.source, o.skill.force, o.dryRun)
    : null
  if (skill?.action === 'kept-edited') warnings.push(`kept your edited skill at ${skill.path}`)
  return { mode: o.spec.mode, shim: chosen, skill, onPath, shadowedBy, shadows, needsAdmin, warnings }
}

export type UninstallReport = {
  removed: string[]
  /** `gnomeola`s in the candidate directories that this tool did not write (untouched). */
  keptForeign: string[]
  skill: { path: string; action: 'removed' | 'kept-edited' | 'absent' } | null
}

export function uninstallCli(
  o: { mode: InstallMode; home: string; binDir?: string; skillRoot?: string; keepSkill?: boolean },
  fs: Fs = nodeFs,
): UninstallReport {
  const removed: string[] = []
  const keptForeign: string[] = []
  for (const dir of o.binDir ? [o.binDir] : binCandidates(o.mode, o.home)) {
    const target = join(dir, 'gnomeola')
    if (!fs.exists(target)) continue
    if (isOurs(fs.read(target))) {
      rmSync(target, { force: true })
      removed.push(target)
    } else keptForeign.push(target)
  }
  let skill: UninstallReport['skill'] = null
  if (!o.keepSkill) {
    const dir = join(o.skillRoot ?? join(o.home, '.claude', 'skills'), SKILL_DIR)
    const md = join(dir, 'SKILL.md')
    const stamp = join(dir, STAMP)
    if (!existsSync(md)) skill = { path: md, action: 'absent' }
    else if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === sha(readFileSync(md, 'utf8'))) {
      rmSync(dir, { recursive: true, force: true })
      skill = { path: md, action: 'removed' }
    } else skill = { path: md, action: 'kept-edited' }
  }
  return { removed, keptForeign, skill }
}

// ------------------------------------------------------------------------------------- skill

export const SKILL_DIR = 'meeting-context'
const STAMP = '.gnomeola-installed'

export const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

/**
 * Installs the skill under `root`. A copy the user edited since our last install (its hash no longer
 * matches the stamp) is kept unless `force`.
 */
export function writeSkill(
  root: string,
  source: string,
  force = false,
  dryRun = false,
): { path: string; action: 'installed' | 'updated' | 'unchanged' | 'kept-edited' } {
  const target = join(root, SKILL_DIR, 'SKILL.md')
  const stamp = join(root, SKILL_DIR, STAMP)
  let action: 'installed' | 'updated' | 'unchanged' | 'kept-edited' = 'installed'
  if (existsSync(target)) {
    const current = readFileSync(target, 'utf8')
    const recorded = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null
    if (current === source) action = 'unchanged'
    else if (recorded !== sha(current) && !force) return { path: target, action: 'kept-edited' }
    else action = 'updated'
  }
  if (action !== 'unchanged' && !dryRun) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
    writeFileSync(stamp, `${sha(source)}\n`)
  }
  return { path: target, action }
}
