import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Ctx } from '../context.ts'
import { CliError, EXIT } from '../errors.ts'
import { renderJson } from '../output.ts'

export const SKILL_NAME = 'meeting-context'

/** Where the skill source lives in the repo. A bundled build inlines it via GNOMEOLA_SKILL_MD. */
export function skillSource(): string {
  const inlined = (globalThis as { GNOMEOLA_SKILL_MD?: string }).GNOMEOLA_SKILL_MD
  if (inlined) return inlined
  const path = join(import.meta.dirname, '..', '..', '..', '..', 'skills', SKILL_NAME, 'SKILL.md')
  if (!existsSync(path)) throw new CliError(EXIT.ERROR, `skill source not found at ${path}`)
  return readFileSync(path, 'utf8')
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

/**
 * Installs the skill into ~/.claude/skills (or --dir). Refuses to overwrite a copy the user has edited
 * unless --force, detected by comparing against the hash recorded at the last install.
 */
export function skillInstall(ctx: Ctx, o: { dir?: string; force?: boolean }) {
  const root = o.dir ?? join(ctx.io.env.HOME ?? homedir(), '.claude', 'skills')
  const target = join(root, SKILL_NAME, 'SKILL.md')
  const stamp = join(root, SKILL_NAME, '.gnomeola-installed')
  const source = skillSource()
  let action: 'installed' | 'updated' | 'unchanged' = 'installed'
  if (existsSync(target)) {
    const current = readFileSync(target, 'utf8')
    const recorded = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null
    if (current === source) action = 'unchanged'
    else if (recorded !== sha(current) && !o.force) {
      throw new CliError(EXIT.REFUSED, `${target} has local edits`, 'pass --force to overwrite them')
    } else action = 'updated'
  }
  if (action !== 'unchanged') {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
    writeFileSync(stamp, `${sha(source)}\n`)
  }
  // Invoking a skill is itself a permission prompt in Claude Code (and silently denied when headless), so
  // say which rules make it frictionless — but never edit the user's settings for them.
  const permissions = [`Skill(${SKILL_NAME})`, 'Bash(gnomeola:*)']
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ action, path: target, permissions }, ctx.io))
  ctx.io.stdout(`${action}: ${target}\n`)
  ctx.io.stdout(
    `to use it without prompts, add to permissions.allow in ~/.claude/settings.json:\n  ${permissions.map((x) => JSON.stringify(x)).join(', ')}\n`,
  )
}
