// S-4 — generate THIRD_PARTY_NOTICES.md from the real production dependency tree, and fail on any licence
// that is not known to be compatible with distributing gnomeola under GPL-3.0-or-later.
//
//   node scripts/third-party-notices.ts            write THIRD_PARTY_NOTICES.md
//   node scripts/third-party-notices.ts --check    exit 1 if the file is stale or a licence is not allowed
//
// Models and voices are data, not npm packages: they are listed from an explicit, reviewed table below
// (kept next to the catalog that downloads them), because their licences are what actually constrains
// redistribution and pnpm cannot see them.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Pkg = { name: string; versions: string[]; license: string; homepage?: string; author?: string }

/** SPDX ids we have reviewed as compatible with shipping inside a GPL-3.0-or-later application. */
export const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'MPL-2.0',
  'Unlicense',
  '0BSD',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'Python-2.0',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'GPL-3.0-or-later',
  // data only (models, voices, corpora): attribution is given in the table below
  'CC-BY-4.0',
  'Public-Domain',
  // fonts only: bundled as separate files next to the program (an aggregate, which the OFL and GPL both allow)
  'OFL-1.1',
])

/** Accepts `A OR B` if any alternative is allowed; `A AND B` only if all are. Parentheses are stripped. */
export function licenceAllowed(expr: string): boolean {
  const e = expr.replace(/[()]/g, '').trim()
  if (/\sOR\s/.test(e)) return e.split(/\s+OR\s+/).some(licenceAllowed)
  if (/\sAND\s/.test(e)) return e.split(/\s+AND\s+/).every(licenceAllowed)
  return ALLOWED.has(e)
}

/** Reviewed data dependencies (models, voices, fixtures). Extended as work streams land. */
export const DATA: { name: string; licence: string; source: string; note: string }[] = [
  {
    name: 'NeMo streaming FastConformer transducer (en, 80 ms, int8)',
    licence: 'CC-BY-4.0',
    source: 'NVIDIA NeMo via k2-fsa/sherpa-onnx releases',
    note: 'default live (tier-1) model; downloaded at first run',
  },
  {
    name: 'NeMo Parakeet TDT transducer 110M (en, int8)',
    licence: 'CC-BY-4.0',
    source: 'NVIDIA NeMo via k2-fsa/sherpa-onnx releases',
    note: 'default final (tier-2) model; downloaded at first run',
  },
  {
    name: 'Silero VAD',
    licence: 'MIT',
    source: 'snakers4/silero-vad via k2-fsa/sherpa-onnx releases',
    note: 'voice activity detection; downloaded at first run',
  },
  {
    name: 'pyannote speaker segmentation 3.0',
    licence: 'MIT',
    source: 'pyannote/segmentation-3.0 (CNRS) via k2-fsa/sherpa-onnx releases',
    note: 'far-end speaker turns (M3); downloaded at first run',
  },
  {
    name: 'NeMo TitaNet-small speaker embeddings (en)',
    licence: 'CC-BY-4.0',
    source: 'NVIDIA NeMo via k2-fsa/sherpa-onnx releases',
    note: 'default speaker embedding model (M3); downloaded at first run',
  },
  {
    name: 'WeSpeaker ResNet34 speaker embeddings (VoxCeleb)',
    licence: 'CC-BY-4.0',
    source: 'wenet-e2e/wespeaker via k2-fsa/sherpa-onnx releases',
    note: 'optional alternative embedding model, benchmarked in docs/stt.md',
  },
  {
    name: 'Whisper / Moonshine / Zipformer alternatives',
    licence: 'MIT',
    source: 'k2-fsa/sherpa-onnx releases',
    note: 'optional, selectable in Preferences (icefall Zipformers are Apache-2.0)',
  },
  {
    name: 'Piper voices joe, sam / LJSpeech, cori',
    licence: 'CC0-1.0',
    source: 'rhasspy/piper-voices',
    note: 'test fixtures only (sam: Apache-2.0; ljspeech, cori: public domain)',
  },
  {
    name: 'LibriSpeech test-clean excerpts',
    licence: 'CC-BY-4.0',
    source: 'Panayotov et al., openslr.org/12',
    note: 'test fixture librispeech-3p',
  },
  {
    name: 'Adwaita symbolic icons (adwaita-icon-theme)',
    licence: 'LGPL-3.0-only',
    source: 'GNOME Project, adwaita-icon-theme (dual LGPL-3.0 / CC-BY-SA-3.0)',
    note: 'path data of a few symbolic icons in the Electron window (packages/desktop/src/renderer/design)',
  },
  {
    name: 'Bricolage Grotesque (variable)',
    licence: 'OFL-1.1',
    source: 'google/fonts ofl/bricolagegrotesque (Ateliertriay)',
    note: 'brand typeface: headings, wordmark, buttons; brand/fonts/ (licence alongside)',
  },
  {
    name: 'Instrument Sans (variable, roman + italic)',
    licence: 'OFL-1.1',
    source: 'google/fonts ofl/instrumentsans (Instrument)',
    note: 'brand typeface: UI text; brand/fonts/',
  },
  {
    name: 'Fraunces Italic (variable)',
    licence: 'OFL-1.1',
    source: 'google/fonts ofl/fraunces (Undercase Type)',
    note: 'brand typeface: the icon k and editorial accents; brand/fonts/',
  },
  {
    name: 'JetBrains Mono (variable)',
    licence: 'OFL-1.1',
    source: 'google/fonts ofl/jetbrainsmono (JetBrains)',
    note: 'brand typeface: timestamps and code; brand/fonts/',
  },
]

export function collect(root: string): Pkg[] {
  const out = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { cwd: root, encoding: 'utf8' })
  const groups = JSON.parse(out) as Record<string, Pkg[]>
  return Object.values(groups)
    .flat()
    .filter((p) => !p.name.startsWith('@gnomeola/'))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function render(pkgs: Pkg[]): string {
  const lines = [
    '# Third-party notices',
    '',
    'gnomeola is distributed under GPL-3.0-or-later. It includes or downloads the following third-party',
    'components. This file is generated by `scripts/third-party-notices.ts` from the production dependency',
    'tree; do not edit it by hand.',
    '',
    '## Software',
    '',
    '| package | version | licence | homepage |',
    '| --- | --- | --- | --- |',
    ...pkgs.map((p) => `| ${p.name} | ${p.versions.join(', ')} | ${p.license} | ${p.homepage ?? ''} |`),
    '',
    '## Models, voices and data',
    '',
  ]
  if (!DATA.length) lines.push('_None yet._', '')
  else {
    lines.push('| component | licence | source | note |', '| --- | --- | --- | --- |')
    for (const d of DATA) lines.push(`| ${d.name} | ${d.licence} | ${d.source} | ${d.note} |`)
    lines.push('')
  }
  lines.push(
    '## Inspiration',
    '',
    'gnomeola is an independent, clean-room project inspired by [Granola](https://www.granola.ai/). It contains no',
    'Granola code, assets or branding and is not affiliated with or endorsed by Granola.',
    '',
  )
  return lines.join('\n')
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..')
  const pkgs = collect(root)
  const bad = pkgs.filter((p) => !licenceAllowed(p.license))
  for (const d of DATA)
    if (!licenceAllowed(d.licence)) bad.push({ name: d.name, versions: [], license: d.licence })
  if (bad.length) {
    console.error('✗ licences not on the reviewed allow-list:')
    for (const b of bad) console.error(`  ${b.name}: ${b.license}`)
    process.exit(1)
  }
  const file = join(root, 'THIRD_PARTY_NOTICES.md')
  const next = render(pkgs)
  if (process.argv.includes('--check')) {
    const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
    if (current !== next) {
      console.error('✗ THIRD_PARTY_NOTICES.md is stale — run: node scripts/third-party-notices.ts')
      process.exit(1)
    }
    console.log(`✓ notices current; ${pkgs.length} packages, all licences allowed`)
  } else {
    writeFileSync(file, next)
    console.log(`wrote THIRD_PARTY_NOTICES.md (${pkgs.length} packages, ${DATA.length} data components)`)
  }
}
