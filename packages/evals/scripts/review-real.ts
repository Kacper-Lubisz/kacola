// A review page for a private real-meeting fixture's labels, so a person can check them quickly:
//
//   node packages/evals/scripts/review-real.ts <fixtureDir>      → <fixtureDir>/review.html
//
// Each item: its label (coverage, when it came up, when it was answered, why), the evidence lines with
// timestamps, near misses, and what each provider's latest run did (results-*.json written by run-evals).
// The full transcript with segment ids follows, so a label can be moved to another segment. To correct a
// label, edit labels.json (set "reviewed": true when done), re-run the suite and this script.
//
// The page shows the transcript: it is written into the fixture directory (gitignored), never published.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type ItemScore, loadRealFixture, type RealOutcome } from '../src/real.ts'

const dirArg = process.argv[2]
if (!dirArg) {
  console.error('usage: node packages/evals/scripts/review-real.ts <fixtureDir>')
  process.exit(2)
}
const dir = resolve(dirArg)
const fx = loadRealFixture(dir)
type Results = {
  label: string
  model: string
  mode: string
  generatedAt: string
  metrics: Record<string, number | null>
  items: ItemScore[]
  outcomes: RealOutcome[]
}
const results: Results[] = readdirSync(dir)
  .filter((f) => /^results-.*\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Results)

const segs = fx.transcript.segments
const pos = new Map(segs.map((s, i) => [s.id, i]))
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const line = (id: string | null, cls = '') => {
  if (!id) return '<span class="muted">none</span>'
  const i = pos.get(id)!
  const s = segs[i]!
  return `<div class="line ${cls}"><a href="#s${i}" class="t">${mmss(s.startMs)}</a><span class="sp">${esc(s.speaker)}</span><span>${esc(s.text)}</span><code>#${i}</code></div>`
}
const at = (id: string | null, edge: 'startMs' | 'endMs') =>
  id ? `${mmss(segs[pos.get(id)!]![edge])} <code>#${pos.get(id)}</code>` : '<span class="muted">—</span>'

const items = fx.labels.items
  .map((it) => {
    const runs = results
      .map((r) => {
        const sc = r.items.find((x) => x.itemId === it.id)
        const o = r.outcomes.find((x) => x.itemId === it.id)
        if (!sc || !o) return ''
        const tick =
          o.tickSegment !== null
            ? `ticked at ${mmss(o.tickAtMs!)}${sc.lagS !== null ? ` (lag ${sc.lagS} s)` : ''}${line(segs[o.tickSegment]!.id, 'tick')}`
            : o.suggestAtMs !== null
              ? `suggested at ${mmss(o.suggestAtMs)}`
              : 'no tick'
        return `<li><b>${esc(r.label)}</b> <span class="v v-${sc.verdict}">${sc.verdict}</span> max P ${sc.maxP} · ${tick}${o.answer ? `<div class="muted">answer: ${esc(o.answer)}</div>` : ''}</li>`
      })
      .join('')
    return `<section class="item" id="${esc(it.id)}">
  <h2><span class="c c-${it.coverage}">${it.coverage}</span> ${esc(it.text)} <code>${esc(it.id)} · ${it.kind}</code></h2>
  <p class="why">${esc(it.why)}</p>
  <dl><dt>came up</dt><dd>${at(it.startedAt, 'startMs')}</dd><dt>answered by</dt><dd>${at(it.answeredAt, 'endMs')}</dd>${
    it.answer ? `<dt>answer</dt><dd>${esc(it.answer)}</dd>` : ''
  }</dl>
  ${it.evidence.length ? `<h3>Evidence</h3>${it.evidence.map((e) => line(e, e === it.answeredAt ? 'ans' : '')).join('')}` : ''}
  ${it.nearMisses?.length ? `<h3>Near misses (not an answer)</h3>${it.nearMisses.map((e) => line(e, 'near')).join('')}` : ''}
  ${runs ? `<h3>Latest runs</h3><ul>${runs}</ul>` : ''}
</section>`
  })
  .join('\n')

const summary = results.length
  ? `<table><tr><th>run</th><th>precision</th><th>recall</th><th>false ticks on negatives</th><th>lag median / p90 (s)</th><th>calls</th></tr>${results
      .map(
        (r) =>
          `<tr><td>${esc(r.label)} <span class="muted">${esc(r.model)} · ${esc(r.generatedAt.slice(0, 16))}</span></td><td>${r.metrics.autoPrecision ?? '—'}</td><td>${r.metrics.autoRecall ?? '—'}</td><td>${r.metrics.falseTicksOnNegatives ?? '—'} / ${r.metrics.negativeItems ?? '—'}</td><td>${r.metrics.tickLagMedianS ?? '—'} / ${r.metrics.tickLagP90S ?? '—'}</td><td>${r.metrics.decisionCalls ?? '—'}</td></tr>`,
      )
      .join('')}</table>`
  : '<p class="muted">No runs yet: run node packages/evals/scripts/run-evals.ts offline live.</p>'

const counts = ['full', 'partial', 'none'].map(
  (c) => `${fx.labels.items.filter((i) => i.coverage === c).length} ${c}`,
)
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Label review</title>
<style>
:root{--bg:#fbfaf8;--fg:#1d1d1b;--muted:#6b6862;--line:#e4e1db;--card:#fff;--full:#1f7a4d;--partial:#a86b00;--none:#8a8a8a;--bad:#b42318;--hl:#fff4c2;--tick:#e3f1ff}
@media (prefers-color-scheme:dark){:root{--bg:#18181a;--fg:#ecebe8;--muted:#9b978f;--line:#33322f;--card:#202022;--hl:#4a4020;--tick:#1d3550}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:960px;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:0 0 6px}h3{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:14px 0 4px}
code{font-size:12px;color:var(--muted)}.muted{color:var(--muted)}
.item{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:14px 0}
.why{margin:4px 0 8px}dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}dt{color:var(--muted)}dd{margin:0}
.line{display:grid;grid-template-columns:48px 84px 1fr auto;gap:8px;padding:3px 6px;border-radius:6px}
.line.ans{background:var(--hl)}.line.tick{background:var(--tick)}.line.near{opacity:.8;font-style:italic}
.t{color:var(--muted);text-decoration:none;font-variant-numeric:tabular-nums}.sp{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c{font-size:12px;padding:1px 8px;border-radius:99px;color:#fff;vertical-align:2px}.c-full{background:var(--full)}.c-partial{background:var(--partial)}.c-none{background:var(--none)}
.v{font-size:12px;padding:0 6px;border-radius:4px;border:1px solid var(--line)}.v-false-tick,.v-premature-tick,.v-miss{color:var(--bad);border-color:var(--bad)}
table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;font-size:14px}
details{margin-top:24px}summary{cursor:pointer;font-weight:600}
@media (max-width:600px){.line{grid-template-columns:44px 1fr auto}.sp{display:none}}
</style></head><body>
<h1>Label review: ${esc(fx.name)}</h1>
<p class="muted">${fx.labels.items.length} items (${counts.join(', ')}) · labelled by ${esc(fx.labels.labelledBy)} · ${fx.labels.reviewed ? 'reviewed' : '<b>not reviewed</b>'} · ${segs.length} segments, ${Math.round(fx.transcript.durationMs / 60_000)} min</p>
<p>To correct a label, edit <code>${esc(join(dir, 'labels.json'))}</code> (segment ids are on each line below as <code>#index</code>; the file uses the ids from the transcript), set <code>"reviewed": true</code>, then re-run the suite and this page.</p>
${summary}
${items}
<details><summary>Full transcript (${segs.length} segments)</summary>
${segs.map((s, i) => `<div class="line" id="s${i}"><span class="t">${mmss(s.startMs)}</span><span class="sp">${esc(s.speaker)}</span><span>${esc(s.text)}</span><code>#${i} ${esc(s.id)}</code></div>`).join('\n')}
</details>
</body></html>
`
writeFileSync(join(dir, 'review.html'), html)
console.log(`wrote ${join(dir, 'review.html')}`)
