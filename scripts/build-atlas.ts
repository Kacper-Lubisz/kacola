import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { ATLAS, type AtlasEntry } from '../packages/testkit/src/atlas/manifest.ts'

// The screen atlas page (docs/user-stories.md → "Regenerate and republish"): one self-contained HTML
// page built from the story inventory (docs/user-stories.md: stories, fields, Mermaid charts with
// `%% shot: NODE = <id>` links), the atlas manifest (every state, built or planned) and what the atlas
// suites captured (dist/atlas/shots/*.png|txt, dist/atlas/captured-*.json). Screenshots become WebP
// (ImageMagick) under site/img/, referenced relatively, so the page publishes as an Artifact with the
// images as supporting files.
//
//   node scripts/build-atlas.ts [--atlas dist/atlas] [--out dist/atlas/site] [--png]

export type Story = {
  id: string
  title: string
  group: string
  fields: Record<string, string>
  chart: string | null
  /** Chart node id → atlas entry id. */
  shots: Record<string, string>
}
export type Inventory = { overview: string | null; overviewShots: Record<string, string>; stories: Story[] }

const SHOT_LINE = /^\s*%%\s*shot:\s*([\w-]+)\s*=\s*([\w-]+)\s*$/

function shotsOf(chart: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of chart.split('\n')) {
    const m = SHOT_LINE.exec(l)
    if (m) out[m[1]!] = m[2]!
  }
  return out
}

/** Stories (### id — title), their `- **Field:** value` bullets and first Mermaid block, by group (##). */
export function parseStories(md: string): Inventory {
  const lines = md.split('\n')
  const stories: Story[] = []
  let group = ''
  let cur: Story | null = null
  let overview: string | null = null
  let inOverview = false
  let field: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    if (l.startsWith('```mermaid')) {
      const body: string[] = []
      while (++i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i]!)
      const chart = body.join('\n')
      if (cur && !cur.chart) cur.chart = chart
      else if (inOverview && !overview) overview = chart
      field = null
      continue
    }
    if (l.startsWith('```')) {
      while (++i < lines.length && !lines[i]!.startsWith('```'));
      continue
    }
    const h2 = /^## (.+)$/.exec(l)
    if (h2) {
      cur = null
      field = null
      inOverview = /^Overview/.test(h2[1]!)
      group = inOverview ? '' : h2[1]!.replace(/\s*\(.*\)\s*$/, '')
      continue
    }
    const h3 = /^### ([a-z0-9-]+) — (.+)$/.exec(l)
    if (h3) {
      cur = { id: h3[1]!, title: h3[2]!, group, fields: {}, chart: null, shots: {} }
      stories.push(cur)
      field = null
      continue
    }
    if (!cur) continue
    const f = /^- \*\*(.+?):\*\*\s*(.*)$/.exec(l)
    if (f) {
      field = f[1]!
      cur.fields[field] = f[2]!
    } else if (field && /^ {2}\S/.test(l)) cur.fields[field] += ` ${l.trim()}`
    else if (l.trim() === '') field = null
  }
  for (const s of stories) s.shots = s.chart ? shotsOf(s.chart) : {}
  return { overview, overviewShots: overview ? shotsOf(overview) : {}, stories }
}

/** Every inconsistency between the inventory and the manifest (the unit test asserts none). */
export function checkInventory(inv: Inventory, manifest: AtlasEntry[] = ATLAS): string[] {
  const problems: string[] = []
  const ids = new Set(manifest.map((e) => e.id))
  const storyIds = new Set(inv.stories.map((s) => s.id))
  for (const s of inv.stories) {
    if (!s.fields.Status) problems.push(`${s.id}: no Status`)
    if (!s.chart) problems.push(`${s.id}: no flow chart`)
    for (const [node, id] of Object.entries(s.shots))
      if (!ids.has(id))
        problems.push(`${s.id}: chart node ${node} links to ${id}, which is not in the manifest`)
    for (const m of (s.fields.States ?? '').matchAll(/`([\w-]+__[\w-]+__[\w-]+)`/g))
      if (!ids.has(m[1]!)) problems.push(`${s.id}: state ${m[1]} is not in the manifest`)
  }
  for (const [node, id] of Object.entries(inv.overviewShots))
    if (!ids.has(id)) problems.push(`overview: node ${node} links to ${id}, which is not in the manifest`)
  for (const e of manifest)
    if (!storyIds.has(e.story)) problems.push(`manifest: ${e.id}'s story is not in the inventory`)
  const seen = new Set<string>()
  for (const e of manifest) {
    if (seen.has(e.id)) problems.push(`manifest: ${e.id} twice`)
    seen.add(e.id)
  }
  return problems
}

type CapturedFile = {
  file: string
  theme: 'light' | 'dark'
  width: number
  stable: boolean | null
  diff: number
}
type Captured = { id: string; files: CapturedFile[]; masked: number; text?: string; stable?: boolean }

export type Frame = {
  id: string
  story: string
  step: string
  state: string
  label: string
  surface: AtlasEntry['surface']
  status: AtlasEntry['status']
  note?: string
  /** "light-1280" → img path. */
  images: Record<string, string>
  masked: number
  text?: string
  captured: boolean
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** The docs' inline markdown: `code`, **bold**, *em*, [text](href) (anchors dropped). */
const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1')

export function loadCaptured(atlasDir: string): Map<string, Captured> {
  const out = new Map<string, Captured>()
  if (!existsSync(atlasDir)) return out
  for (const f of readdirSync(atlasDir).filter((x) => /^captured-.+\.json$/.test(x))) {
    const j = JSON.parse(readFileSync(join(atlasDir, f), 'utf8')) as { captured: Captured[] }
    for (const c of j.captured) out.set(c.id, c)
  }
  return out
}

/** PNG → WebP (ImageMagick) under outDir/img, or a copy of the PNG with --png / no magick. */
function convert(src: string, dstDir: string, png: boolean): string {
  const base = src
    .split('/')
    .pop()!
    .replace(/\.png$/, '')
  const out = png ? `${base}.png` : `${base}.webp`
  const dst = join(dstDir, out)
  if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) return out
  if (png) copyFileSync(src, dst)
  else execFileSync('magick', [src, '-quality', '84', '-define', 'webp:method=6', dst])
  return out
}

function hasMagick(): boolean {
  try {
    execFileSync('magick', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function frames(atlasDir: string, outDir: string, png: boolean): Frame[] {
  const captured = loadCaptured(atlasDir)
  const shots = join(atlasDir, 'shots')
  const img = join(outDir, 'img')
  mkdirSync(img, { recursive: true })
  return ATLAS.map((e) => {
    const c = captured.get(e.id)
    const images: Record<string, string> = {}
    for (const f of c?.files ?? []) {
      const src = join(shots, f.file)
      if (existsSync(src)) images[`${f.theme}-${f.width}`] = `img/${convert(src, img, png)}`
    }
    const text =
      c?.text && existsSync(join(shots, c.text)) ? readFileSync(join(shots, c.text), 'utf8') : undefined
    return {
      id: e.id,
      story: e.story,
      step: e.step,
      state: e.state,
      label: e.label,
      surface: e.surface,
      status: e.status,
      ...(e.note ? { note: e.note } : {}),
      images,
      masked: c?.masked ?? 0,
      ...(text ? { text } : {}),
      captured: Boolean(c && (Object.keys(images).length || text)),
    }
  })
}

export type Stats = {
  stories: number
  storiesBuilt: number
  storiesPlanned: number
  states: number
  statesCaptured: number
  statesPlanned: number
  statesMissing: string[]
  images: number
  compared: number
  stable: number
  unstable: string[]
}

export function stats(inv: Inventory, fr: Frame[], atlasDir: string): Stats {
  const captured = loadCaptured(atlasDir)
  const files = [...captured.values()].flatMap((c) => c.files)
  const compared = files.filter((f) => f.stable !== null)
  const texts = [...captured.values()].filter((c) => c.stable !== undefined)
  return {
    stories: inv.stories.length,
    storiesBuilt: inv.stories.filter((s) => /^built/.test(s.fields.Status ?? '')).length,
    storiesPlanned: inv.stories.filter((s) => /^planned/.test(s.fields.Status ?? '')).length,
    states: fr.length,
    statesCaptured: fr.filter((f) => f.captured).length,
    statesPlanned: fr.filter((f) => f.status === 'planned').length,
    statesMissing: fr.filter((f) => f.status === 'built' && !f.captured).map((f) => f.id),
    images: files.length,
    compared: compared.length + texts.length,
    stable: compared.filter((f) => f.stable).length + texts.filter((c) => c.stable).length,
    unstable: [
      ...compared.filter((f) => !f.stable).map((f) => `${f.file} (${(f.diff * 100).toFixed(3)}% of pixels)`),
      ...texts.filter((c) => !c.stable).map((c) => `${c.text} (text)`),
    ],
  }
}

// ------------------------------------------------------------------------------------------ page

const SURFACE_LABEL: Record<AtlasEntry['surface'], string> = {
  window: 'Window',
  shell: 'Top bar',
  web: 'Web',
  cli: 'Terminal',
}

function frameHtml(f: Frame, n: number, borrowedFrom: string | null): string {
  const cls = [
    'frame',
    `s-${f.surface}`,
    f.captured ? 'is-captured' : f.status === 'planned' ? 'is-planned' : 'is-missing',
  ]
  const meta = `<span class="n">${n}</span><span class="surface">${SURFACE_LABEL[f.surface]}</span>${
    borrowedFrom ? `<span class="from">from ${esc(borrowedFrom)}</span>` : ''
  }`
  let body: string
  if (f.text) body = `<pre class="term" tabindex="0">${esc(f.text)}</pre>`
  else if (f.captured)
    body = `<button class="shot" type="button" data-images='${esc(JSON.stringify(f.images))}' aria-label="Open ${esc(f.label)}"><img alt="${esc(f.label)}" loading="lazy" decoding="async" src="${esc(f.images['light-1280'] ?? Object.values(f.images)[0]!)}"></button>`
  else if (f.status === 'planned')
    body = `<div class="placeholder"><span class="ph-word">planned</span><span class="ph-sub">no screen yet</span></div>`
  else
    body = `<div class="placeholder missing"><span class="ph-word">not captured</span><span class="ph-sub">built, but the last run did not reach it</span></div>`
  const notes = [
    f.note ? esc(f.note) : '',
    f.masked ? `${f.masked} wall-clock region${f.masked > 1 ? 's' : ''} masked` : '',
  ].filter(Boolean)
  return `<figure class="${cls.join(' ')}" id="f-${f.id}" data-surface="${f.surface}">
  <div class="frame-meta">${meta}</div>
  ${body}
  <figcaption><span class="step">${esc(f.step)}</span><span class="dot-sep">·</span><span class="state">${esc(f.state)}</span>
    <p class="label">${inline(f.label)}</p>
    ${notes.length ? `<p class="fnote">${notes.join(' · ')}</p>` : ''}
    <code class="fid">${esc(f.id)}</code></figcaption>
</figure>`
}

function storyHtml(s: Story, fr: Frame[], byStory: Map<string, Story>): string {
  const own = fr.filter((f) => f.story === s.id)
  const ownIds = new Set(own.map((f) => f.id))
  const borrowed = Object.values(s.shots)
    .filter((id, i, a) => !ownIds.has(id) && a.indexOf(id) === i)
    .map((id) => fr.find((f) => f.id === id)!)
    .filter(Boolean)
  const list = [...own, ...borrowed]
  const status = (s.fields.Status ?? '').split(' ')[0]!.replace(/[^a-z]/g, '')
  const captured = own.filter((f) => f.captured).length
  const planned = own.filter((f) => f.status === 'planned').length
  const skip = new Set(['Status', 'States'])
  const fields = Object.entries(s.fields)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => `<div class="field"><dt>${esc(k)}</dt><dd>${inline(v)}</dd></div>`)
    .join('')
  const statusNote = (s.fields.Status ?? '').replace(/^(built|planned)\s*/, '').replace(/^\((.*)\)$/, '$1')
  const shotMap: Record<string, { id: string; captured: boolean }> = {}
  for (const [node, id] of Object.entries(s.shots)) {
    const f = fr.find((x) => x.id === id)
    shotMap[node] = { id, captured: Boolean(f?.captured) }
  }
  return `<section class="story" id="${s.id}" data-status="${status}">
  <header class="story-head">
    <div class="story-title"><h3>${esc(s.title)}</h3><code class="sid">${esc(s.id)}</code></div>
    <div class="story-pills"><span class="pill ${status}">${status}</span>
      <span class="count">${captured} captured${planned ? ` · ${planned} planned` : ''}${
        borrowed.length ? ` · ${borrowed.length} shared` : ''
      }</span></div>
    ${statusNote ? `<p class="status-note">${inline(statusNote)}</p>` : ''}
  </header>
  <dl class="fields">${fields}</dl>
  ${
    s.chart
      ? `<div class="flow" data-shots='${esc(JSON.stringify(shotMap))}'><script type="text/plain" class="flow-src">${s.chart.replace(/<\/script/gi, '<\\/script')}</script><div class="flow-out" aria-label="Flow chart: ${esc(s.title)}"></div></div>`
      : ''
  }
  <div class="strip" role="list" aria-label="Screens of ${esc(s.title)}, in order">
    ${list
      .map((f, i) => {
        const from = f.story === s.id ? null : (byStory.get(f.story)?.id ?? f.story)
        return `<div role="listitem">${frameHtml(f, i + 1, from)}</div>`
      })
      .join('\n')}
  </div>
</section>`
}

export function renderPage(inv: Inventory, fr: Frame[], st: Stats, generatedAt: string): string {
  const byStory = new Map(inv.stories.map((s) => [s.id, s]))
  const groups: { name: string; stories: Story[] }[] = []
  for (const s of inv.stories) {
    let g = groups.find((x) => x.name === s.group)
    if (!g) {
      g = { name: s.group, stories: [] }
      groups.push(g)
    }
    g.stories.push(s)
  }
  const nav = groups
    .map(
      (g) =>
        `<li><span class="nav-group">${esc(g.name)}</span><ul>${g.stories
          .map((s) => {
            const status = (s.fields.Status ?? '').split(' ')[0]!.replace(/[^a-z]/g, '')
            return `<li><a href="#${s.id}"><span class="sdot ${status}" aria-hidden="true"></span>${esc(s.title)}</a></li>`
          })
          .join('')}</ul></li>`,
    )
    .join('')
  const summaryRows = inv.stories
    .map((s) => {
      const own = fr.filter((f) => f.story === s.id)
      const status = (s.fields.Status ?? '').split(' ')[0]!.replace(/[^a-z]/g, '')
      const cap = own.filter((f) => f.captured).length
      const pl = own.filter((f) => f.status === 'planned').length
      const miss = own.filter((f) => f.status === 'built' && !f.captured).length
      const total = own.length || 1
      return `<tr><td><a href="#${s.id}">${esc(s.title)}</a></td><td><span class="pill ${status}">${status}</span></td><td class="num">${cap}</td><td class="num">${pl}</td><td class="num">${miss || ''}</td><td class="cov"><span class="b-cap" style="width:${(cap / total) * 100}%"></span><span class="b-pl" style="width:${(pl / total) * 100}%"></span></td></tr>`
    })
    .join('')
  const overviewShots: Record<string, { id: string; captured: boolean }> = {}
  for (const [node, id] of Object.entries(inv.overviewShots))
    overviewShots[node] = { id, captured: Boolean(fr.find((f) => f.id === id)?.captured) }
  const stablePct = st.compared ? Math.round((st.stable / st.compared) * 1000) / 10 : null
  return `<title>kacola screen atlas</title>
<meta name="description" content="Every user story, its flow, and a real screenshot of every state it touches.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,650;12..96,700&family=Fraunces:ital,opsz,wght@1,9..144,500&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root {
  --bg: #F6F1E7; --bg-side: #EFE8DA; --surface: #FFFDF8; --raised: #FFFFFF;
  --border: #E2D9C6; --border-subtle: #E9E1D1; --border-strong: #CBBFA8;
  --text: #1F1B16; --text-2: #5E564B; --text-3: #70675A;
  --red: #E0482B; --red-text: #B3341B; --ink: #1F1B16; --on-ink: #F6F1E7;
  --ok: #3F7D4E; --warn: #B7791F; --info: #2F6FA3;
  --hover: rgba(31,27,22,0.05); --sel: rgba(31,27,22,0.08);
  --shadow: 0 1px 2px rgba(31,27,22,.06), 0 1px 1px rgba(31,27,22,.04);
  --shadow-2: 0 6px 20px rgba(31,27,22,.08), 0 2px 6px rgba(31,27,22,.05);
  --display: "Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif;
  --body: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --serif: "Fraunces", Georgia, serif;
  --frame-w: 400px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #171411; --bg-side: #1C1814; --surface: #211D19; --raised: #2B2620;
    --border: #3A332B; --border-subtle: #2E2822; --border-strong: #4A4138;
    --text: #F3ECE0; --text-2: #B3A895; --text-3: #978C7B;
    --red: #F0603F; --red-text: #F58A72; --ink: #F3ECE0; --on-ink: #1F1B16;
    --ok: #6FB07F; --warn: #E0A54A; --info: #6FA6D6;
    --hover: rgba(243,236,224,0.06); --sel: rgba(243,236,224,0.10);
    --shadow: 0 1px 2px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.1);
    --shadow-2: 0 6px 20px rgba(0,0,0,.2), 0 2px 6px rgba(0,0,0,.12);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #171411; --bg-side: #1C1814; --surface: #211D19; --raised: #2B2620;
  --border: #3A332B; --border-subtle: #2E2822; --border-strong: #4A4138;
  --text: #F3ECE0; --text-2: #B3A895; --text-3: #978C7B;
  --red: #F0603F; --red-text: #F58A72; --ink: #F3ECE0; --on-ink: #1F1B16;
  --ok: #6FB07F; --warn: #E0A54A; --info: #6FA6D6;
  --hover: rgba(243,236,224,0.06); --sel: rgba(243,236,224,0.10);
  --shadow: 0 1px 2px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.1);
  --shadow-2: 0 6px 20px rgba(0,0,0,.2), 0 2px 6px rgba(0,0,0,.12);
}
* { box-sizing: border-box; }
html { scroll-padding-top: 76px; }
body { background: var(--bg); color: var(--text); font: 15px/1.47 var(--body); padding-inline: 16px; padding-block: 0 64px; }
a { color: var(--red-text); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font: 500 12.5px/1.4 var(--mono); }
button { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid color-mix(in srgb, var(--red) 55%, transparent); outline-offset: 2px; border-radius: 6px; }
.wrap { max-width: 1440px; margin: 0 auto; }

/* header */
.top { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; padding-block: 36px 20px; }
.brand { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.wordmark { font: 700 34px/1 var(--display); letter-spacing: -0.04em; font-variation-settings: "opsz" 96; }
.wordmark i { display: inline-block; width: .2em; height: .2em; border-radius: 50%; background: var(--red); margin-left: .06em; }
.brand h1 { margin: 0; font: 650 22px/1.2 var(--display); letter-spacing: -0.015em; color: var(--text-2); }
.lede { margin: 8px 0 0; max-width: 68ch; color: var(--text-2); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: var(--border-subtle); border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; flex: 1 1 520px; max-width: 760px; }
.stat { background: var(--surface); padding: 12px 14px; }
.stat b { display: block; font: 700 24px/1.1 var(--display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat span { font: 600 11.5px/1.3 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
.stat.red b { color: var(--red-text); }

/* toolbar */
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; padding-block: 10px; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border-subtle); }
.seg { display: inline-flex; background: var(--bg-side); border-radius: 999px; padding: 3px; gap: 2px; }
.seg button { border: 0; background: transparent; padding: 5px 12px; border-radius: 999px; font: 600 13.5px/1.2 var(--display); color: var(--text-2); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
.bar label { font: 600 11.5px/1 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); margin-right: 6px; }
.bar .grp { display: inline-flex; align-items: center; }
.bar .hint { margin-left: auto; color: var(--text-3); font-size: 13px; }

/* layout */
.cols { display: grid; grid-template-columns: 1fr; gap: 28px; margin-top: 24px; }
@media (min-width: 1100px) { .cols { grid-template-columns: 250px minmax(0, 1fr); } }
nav.toc { display: none; }
@media (min-width: 1100px) {
  nav.toc { display: block; position: sticky; top: 72px; align-self: start; max-height: calc(100vh - 90px); overflow: auto; padding-right: 6px; }
}
nav.toc ul { list-style: none; margin: 0; padding: 0; }
nav.toc > ul > li { margin-bottom: 14px; }
.nav-group { display: block; font: 600 11.5px/1.3 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); margin: 0 0 4px 8px; }
nav.toc a { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; color: var(--text); font-size: 13.5px; line-height: 1.3; }
nav.toc a:hover { background: var(--hover); text-decoration: none; }
.sdot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--ok); }
.sdot.planned { background: transparent; border: 1.5px dashed var(--text-3); }

h2 { font: 700 24px/1.25 var(--display); letter-spacing: -0.02em; margin: 40px 0 6px; text-wrap: balance; }
h2 + .gdesc { margin: 0 0 16px; color: var(--text-2); }
.panel { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 14px; box-shadow: var(--shadow); padding: 16px; }
.overview .flow-out { min-height: 200px; }

/* summary */
.summary { overflow-x: auto; }
.summary table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 560px; }
.summary th { text-align: left; font: 600 11.5px/1.3 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); padding: 6px 8px; border-bottom: 1px solid var(--border); }
.summary td { padding: 6px 8px; border-bottom: 1px solid var(--border-subtle); }
.summary td.num { font-variant-numeric: tabular-nums; text-align: right; width: 64px; }
.summary td.cov { width: 28%; }

.summary td.cov span { display: inline-block; height: 8px; vertical-align: middle; }
.b-cap { background: var(--ok); border-radius: 4px 0 0 4px; }
.b-pl { background: repeating-linear-gradient(45deg, var(--border-strong) 0 3px, transparent 3px 6px); }

/* stories */
.story { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--border-subtle); }
.story-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; }
.story-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.story h3 { margin: 0; font: 650 20px/1.3 var(--display); letter-spacing: -0.015em; text-wrap: balance; }
.sid { color: var(--text-3); }
.story-pills { display: flex; align-items: center; gap: 10px; }
.pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font: 600 12px/1.5 var(--body); letter-spacing: .02em; }
.pill.built { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
.pill.planned { border: 1px dashed var(--text-3); color: var(--text-2); }
.count { font-size: 13px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.status-note { flex-basis: 100%; margin: 2px 0 0; font-size: 13.5px; color: var(--text-2); }
.fields { display: grid; grid-template-columns: 1fr; gap: 6px 22px; margin: 12px 0 14px; }
@media (min-width: 800px) { .fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.field { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; font-size: 14px; }
.field dt { font: 600 11.5px/1.9 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
.field dd { margin: 0; color: var(--text-2); max-width: 70ch; }
.field dd code { color: var(--text); }

.flow { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 12px; overflow-x: auto; }
.flow-out svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
.flow-out .node.has-shot { cursor: pointer; }
.flow-out .node.has-shot rect, .flow-out .node.has-shot polygon, .flow-out .node.has-shot path, .flow-out .node.has-shot circle { stroke: var(--red) !important; stroke-width: 1.6px !important; }
.flow-out .node.shot-planned rect, .flow-out .node.shot-planned polygon, .flow-out .node.shot-planned path { stroke: var(--text-3) !important; stroke-dasharray: 4 3; }
.flow-out .node.has-shot:hover rect, .flow-out .node.has-shot:hover polygon { fill: color-mix(in srgb, var(--red) 10%, var(--surface)) !important; }
.flow-src-fallback { font: 12px/1.45 var(--mono); color: var(--text-2); white-space: pre; margin: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12.5px; color: var(--text-3); margin-top: 8px; }
.legend i { display: inline-block; width: 18px; height: 10px; border-radius: 3px; border: 1.6px solid var(--red); vertical-align: middle; margin-right: 6px; }
.legend i.pl { border: 1.6px dashed var(--text-3); }

.strip { display: flex; gap: 14px; overflow-x: auto; padding: 14px 2px 10px; scroll-snap-type: x proximity; }
.strip > div { flex: none; scroll-snap-align: start; }
.frame { margin: 0; width: var(--frame-w); max-width: calc(100vw - 48px); display: flex; flex-direction: column; gap: 8px; }
.frame.s-shell { width: min(var(--frame-w), 360px); }
.frame-meta { display: flex; gap: 8px; align-items: center; font: 600 11.5px/1 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
.frame-meta .n { font: 500 12px/1 var(--mono); letter-spacing: 0; color: var(--text); background: var(--bg-side); border-radius: 999px; padding: 3px 7px; }
.frame-meta .from { text-transform: none; letter-spacing: 0; font-weight: 500; }
.shot { display: block; padding: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--bg-side); cursor: zoom-in; box-shadow: var(--shadow); width: 100%; }
.shot img { display: block; width: 100%; height: auto; max-height: 560px; object-fit: contain; object-position: top; }
.frame.flash .shot, .frame.flash .placeholder, .frame.flash .term { outline: 3px solid var(--red); outline-offset: 3px; }
.placeholder { aspect-ratio: 16 / 10; border: 1.5px dashed var(--border-strong); border-radius: 10px; display: grid; place-content: center; text-align: center; gap: 4px; background: repeating-linear-gradient(135deg, transparent 0 10px, color-mix(in srgb, var(--border-subtle) 60%, transparent) 10px 11px); }
.ph-word { font: italic 500 26px/1 var(--serif); color: var(--text-2); }
.ph-sub { font-size: 13px; color: var(--text-3); }
.placeholder.missing { border-color: var(--red); }
.term { margin: 0; max-height: 360px; overflow: auto; background: #1F1B16; color: #F3ECE0; border-radius: 10px; padding: 12px 14px; font: 12px/1.5 var(--mono); white-space: pre-wrap; word-break: break-word; }
.frame.s-cli { width: min(max(var(--frame-w), 420px), calc(100vw - 48px)); }
figcaption { font-size: 13.5px; }
figcaption .step, figcaption .state { font: 600 13px/1.3 var(--display); }
figcaption .state { color: var(--red-text); }
.dot-sep { color: var(--text-3); margin: 0 5px; }
figcaption .label { margin: 3px 0 0; color: var(--text-2); }
figcaption .fnote { margin: 3px 0 0; color: var(--text-3); font-size: 12.5px; }
.fid { display: block; margin-top: 4px; color: var(--text-3); font-size: 11px; word-break: break-all; }
.frame .nowidth { font-size: 11.5px; color: var(--text-3); }
.frame.is-captured .shot[data-fallback="1"]::after { content: ""; }

body[data-status-filter="built"] .story[data-status="planned"], body[data-status-filter="planned"] .story[data-status="built"] { display: none; }

/* lightbox */
dialog.lb { border: 0; padding: 0; background: transparent; max-width: 96vw; max-height: 94vh; }
dialog.lb::backdrop { background: rgba(23,20,17,.72); }
dialog.lb img { display: block; max-width: 96vw; max-height: 86vh; border-radius: 10px; box-shadow: var(--shadow-2); background: var(--surface); }
dialog.lb .lb-cap { display: flex; justify-content: space-between; gap: 12px; color: #F3ECE0; font-size: 13px; padding: 8px 2px 0; }
dialog.lb button { background: #F3ECE0; color: #1F1B16; border: 0; border-radius: 999px; padding: 4px 12px; font: 600 13px/1.4 var(--display); cursor: pointer; }
.foot { margin-top: 48px; color: var(--text-3); font-size: 13px; }
.foot code { color: var(--text-2); }
.unstable { margin: 8px 0 0; padding-left: 18px; color: var(--text-2); font-size: 13px; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>

<div class="wrap">
  <header class="top">
    <div>
      <div class="brand"><span class="wordmark" aria-label="kacola">kacola<i></i></span><h1>Screen atlas</h1></div>
      <p class="lede">Every user story, from where it starts (a calendar invite, the top bar, the window, the terminal, the web) to where it ends, with a real screenshot of each state it touches. The screenshots come from e2e runs of the real app, in light and dark. Screens that are not built yet show as planned gaps.</p>
    </div>
    <div class="stats" role="list">
      <div class="stat" role="listitem"><b>${st.stories}</b><span>stories</span></div>
      <div class="stat" role="listitem"><b>${st.storiesBuilt} / ${st.storiesPlanned}</b><span>built / planned</span></div>
      <div class="stat" role="listitem"><b>${st.statesCaptured}</b><span>states captured</span></div>
      <div class="stat" role="listitem"><b>${st.statesPlanned}</b><span>states planned</span></div>
      <div class="stat" role="listitem"><b>${st.images}</b><span>screenshots</span></div>
      <div class="stat${st.unstable.length ? ' red' : ''}" role="listitem"><b>${stablePct === null ? '—' : `${stablePct}%`}</b><span>same as last run</span></div>
    </div>
  </header>

  <div class="bar" role="toolbar" aria-label="Screenshot options">
    <span class="grp"><label id="l-theme">Screens</label><span class="seg" role="group" aria-labelledby="l-theme">
      <button type="button" data-theme-shot="light" aria-pressed="true">Light</button><button type="button" data-theme-shot="dark" aria-pressed="false">Dark</button></span></span>
    <span class="grp"><label id="l-width">Width</label><span class="seg" role="group" aria-labelledby="l-width">
      <button type="button" data-width="1280" aria-pressed="true">1280</button><button type="button" data-width="800" aria-pressed="false">800</button><button type="button" data-width="360" aria-pressed="false">360</button></span></span>
    <span class="grp"><label id="l-status">Stories</label><span class="seg" role="group" aria-labelledby="l-status">
      <button type="button" data-status="all" aria-pressed="true">All</button><button type="button" data-status="built" aria-pressed="false">Built</button><button type="button" data-status="planned" aria-pressed="false">Planned</button></span></span>
    <span class="hint">Click a red-edged box in a chart to jump to its screen.</span>
  </div>

  <div class="cols">
    <nav class="toc" aria-label="Stories"><ul><li><ul><li><a href="#overview">Overview map</a></li><li><a href="#summary">Status summary</a></li></ul></li>${nav}</ul></nav>
    <main>
      <h2 id="overview">Every way in</h2>
      <p class="gdesc">Where users enter kacola, and where each entry leads. Dashed lines are planned.</p>
      <div class="panel overview"><div class="flow" data-shots='${esc(JSON.stringify(overviewShots))}'><script type="text/plain" class="flow-src">${(inv.overview ?? '').replace(/<\/script/gi, '<\\/script')}</script><div class="flow-out" aria-label="Overview of entry points"></div></div>
        <div class="legend"><span><i></i>has a screenshot</span><span><i class="pl"></i>planned screen</span></div></div>

      <h2 id="summary">Status summary</h2>
      <p class="gdesc">${st.statesCaptured} of ${st.states} states captured, ${st.statesPlanned} planned${
        st.statesMissing.length ? `, <strong>${st.statesMissing.length} built but not captured</strong>` : ''
      }. ${
        st.compared
          ? `${st.stable} of ${st.compared} screenshots and terminal frames matched the previous run exactly.`
          : 'Run the suites twice to compare runs.'
      }</p>
      ${st.unstable.length ? `<ul class="unstable">${st.unstable.map((u) => `<li><code>${esc(u)}</code></li>`).join('')}</ul>` : ''}
      <div class="panel summary"><table><thead><tr><th>Story</th><th>Status</th><th>Captured</th><th>Planned</th><th>Missing</th><th>Coverage</th></tr></thead><tbody>${summaryRows}</tbody></table></div>

      ${groups
        .map(
          (g) =>
            `<h2 id="g-${g.name.toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(g.name)}</h2>${g.stories
              .map((s) => storyHtml(s, fr, byStory))
              .join('\n')}`,
        )
        .join('\n')}

      <p class="foot">Generated ${esc(generatedAt)} from <code>docs/user-stories.md</code> and <code>packages/testkit/src/atlas/manifest.ts</code> by <code>scripts/build-atlas.ts</code>. Regenerate: <code>pnpm atlas</code> (runs the atlas suites, then builds this page). Screenshots are frozen: fixed data, a fixed clock, held pipelines and streams, reduced motion; wall-clock regions are masked.</p>
    </main>
  </div>
</div>

<dialog class="lb" id="lb" aria-label="Screenshot">
  <img alt="">
  <div class="lb-cap"><span></span><button type="button" id="lb-close">Close</button></div>
</dialog>

<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
(() => {
  const state = { theme: 'light', width: '1280', status: 'all' }
  try { Object.assign(state, JSON.parse(localStorage.getItem('atlas-view') || '{}')) } catch {}
  const save = () => { try { localStorage.setItem('atlas-view', JSON.stringify(state)) } catch {} }
  const frameW = { '1280': '400px', '800': '300px', '360': '190px' }

  function pick(images) {
    return images[state.theme + '-' + state.width] || images[state.theme + '-1280'] || images['light-' + state.width] || images['light-1280'] || Object.values(images)[0]
  }
  function apply() {
    document.documentElement.style.setProperty('--frame-w', frameW[state.width])
    document.body.dataset.statusFilter = state.status
    for (const b of document.querySelectorAll('.shot')) {
      const images = JSON.parse(b.dataset.images)
      const src = pick(images)
      const img = b.querySelector('img')
      if (img.getAttribute('src') !== src) img.setAttribute('src', src)
      const exact = images[state.theme + '-' + state.width]
      b.dataset.fallback = exact ? '0' : '1'
      b.title = exact ? '' : 'Captured at 1280 px only'
    }
    for (const btn of document.querySelectorAll('[data-theme-shot]')) btn.setAttribute('aria-pressed', String(btn.dataset.themeShot === state.theme))
    for (const btn of document.querySelectorAll('[data-width]')) btn.setAttribute('aria-pressed', String(btn.dataset.width === state.width))
    for (const btn of document.querySelectorAll('[data-status]')) btn.setAttribute('aria-pressed', String(btn.dataset.status === state.status))
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button')
    if (!t) return
    if (t.dataset.themeShot) { state.theme = t.dataset.themeShot; save(); apply() }
    else if (t.dataset.width) { state.width = t.dataset.width; save(); apply() }
    else if (t.dataset.status) { state.status = t.dataset.status; save(); apply() }
    else if (t.classList.contains('shot')) openLb(t)
  })

  // lightbox
  const lb = document.getElementById('lb')
  function openLb(btn) {
    const img = btn.querySelector('img')
    lb.querySelector('img').src = img.src
    lb.querySelector('img').alt = img.alt
    lb.querySelector('.lb-cap span').textContent = img.alt
    if (lb.showModal) lb.showModal()
  }
  document.getElementById('lb-close').addEventListener('click', () => lb.close())
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close() })

  function jump(id) {
    const f = document.getElementById('f-' + id)
    if (!f) return
    f.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' })
    f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash')
    setTimeout(() => f.classList.remove('flash'), 1600)
  }

  // flow charts
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
  let n = 0
  async function renderFlows() {
    const flows = [...document.querySelectorAll('.flow')]
    if (!window.mermaid) {
      for (const f of flows) {
        const pre = document.createElement('pre'); pre.className = 'flow-src-fallback'
        pre.textContent = f.querySelector('.flow-src').textContent
        f.querySelector('.flow-out').replaceChildren(pre)
      }
      return
    }
    window.mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', theme: 'base',
      flowchart: { htmlLabels: true, curve: 'basis', padding: 10, nodeSpacing: 34, rankSpacing: 40 },
      themeVariables: {
        fontFamily: 'Instrument Sans, system-ui, sans-serif', fontSize: '14px',
        primaryColor: css('--surface'), primaryTextColor: css('--text'), primaryBorderColor: css('--border-strong'),
        lineColor: css('--text-3'), secondaryColor: css('--bg-side'), tertiaryColor: css('--bg'),
        clusterBkg: css('--bg'), clusterBorder: css('--border'), edgeLabelBackground: css('--surface'),
        titleColor: css('--text-2'), textColor: css('--text'), mainBkg: css('--surface'), nodeBorder: css('--border-strong'),
      },
    })
    for (const f of flows) {
      const src = f.querySelector('.flow-src').textContent
      const out = f.querySelector('.flow-out')
      try {
        const { svg } = await window.mermaid.render('flow' + ++n, src)
        out.innerHTML = svg
      } catch (err) {
        const pre = document.createElement('pre'); pre.className = 'flow-src-fallback'; pre.textContent = src
        out.replaceChildren(pre)
        continue
      }
      const shots = JSON.parse(f.dataset.shots || '{}')
      for (const g of out.querySelectorAll('g.node')) {
        const m = /flowchart-([\\w-]+?)-\\d+$/.exec(g.id)
        const s = m && shots[m[1]]
        if (!s) continue
        g.classList.add(s.captured ? 'has-shot' : 'shot-planned')
        g.setAttribute('tabindex', '0'); g.setAttribute('role', 'link')
        g.setAttribute('aria-label', 'Show the screen ' + s.id)
        const go = () => jump(s.id)
        g.addEventListener('click', go)
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } })
      }
    }
  }
  apply()
  renderFlows()
  const rerender = () => { n = 0; renderFlows() }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender)
  new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})()
</script>
`
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..')
  const arg = (name: string, dflt: string) => {
    const i = process.argv.indexOf(name)
    return i > 0 ? process.argv[i + 1]! : dflt
  }
  const atlasDir = arg('--atlas', join(root, 'dist', 'atlas'))
  const outDir = arg('--out', join(atlasDir, 'site'))
  const png = process.argv.includes('--png') || !hasMagick()
  const inv = parseStories(readFileSync(join(root, 'docs', 'user-stories.md'), 'utf8'))
  const problems = checkInventory(inv)
  if (problems.length) {
    console.error(`docs/user-stories.md and the atlas manifest disagree:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  rmSync(join(outDir, 'index.html'), { force: true })
  const fr = frames(atlasDir, outDir, png)
  // drop images no frame uses any more (renamed / removed states)
  const used = new Set(fr.flatMap((f) => Object.values(f.images)).map((p) => p.replace(/^img\//, '')))
  for (const f of readdirSync(join(outDir, 'img'))) if (!used.has(f)) rmSync(join(outDir, 'img', f))
  const st = stats(inv, fr, atlasDir)
  writeFileSync(
    join(outDir, 'index.html'),
    renderPage(inv, fr, st, new Date().toISOString().slice(0, 16).replace('T', ' ')),
  )
  const bytes = readdirSync(join(outDir, 'img')).reduce(
    (n, f) => n + statSync(join(outDir, 'img', f)).size,
    0,
  )
  console.log(
    JSON.stringify({
      page: join(outDir, 'index.html'),
      images: used.size,
      imageMB: Math.round(bytes / 1e5) / 10,
      stories: st.stories,
      storiesBuilt: st.storiesBuilt,
      storiesPlanned: st.storiesPlanned,
      statesCaptured: st.statesCaptured,
      statesPlanned: st.statesPlanned,
      statesMissing: st.statesMissing,
      comparedWithLastRun: st.compared,
      unstable: st.unstable,
    }),
  )
}
