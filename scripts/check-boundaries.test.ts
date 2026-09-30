import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkBoundaries, checkLayers, importsIn, isForbidden } from './check-boundaries.ts'

function fixtureRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'gnomeola-boundaries-'))
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, body)
  }
  return root
}

describe('boundary rule', () => {
  it('allows protocol, forbids every other internal package', () => {
    expect(isForbidden('@gnomeola/protocol')).toBe(false)
    expect(isForbidden('@gnomeola/protocol/client')).toBe(false)
    for (const p of ['store', 'capture', 'stt', 'llm', 'daemon', 'testkit'])
      expect(isForbidden(`@gnomeola/${p}`)).toBe(true)
    expect(isForbidden('zod')).toBe(false)
    expect(isForbidden('../../store/src/index.ts')).toBe(true)
    expect(isForbidden('./local.ts')).toBe(false)
  })

  it('finds static, dynamic, re-export and require specifiers', () => {
    const src = `import a from '@gnomeola/store'\nexport { b } from "x"\nconst c = await import('@gnomeola/llm')\nconst d = require('y')\nimport type { T } from '@gnomeola/protocol'`
    expect(importsIn(src)).toEqual(['@gnomeola/store', 'x', '@gnomeola/llm', 'y', '@gnomeola/protocol'])
  })

  it('flags a client that declares a forbidden dependency', () => {
    const root = fixtureRepo({
      'packages/cli/package.json': JSON.stringify({ dependencies: { '@gnomeola/store': 'workspace:*' } }),
    })
    expect(checkBoundaries(root)).toEqual([
      { pkg: 'cli', where: 'package.json#dependencies', specifier: '@gnomeola/store' },
    ])
  })

  it('flags a client that imports around its manifest', () => {
    const root = fixtureRepo({
      'packages/ui/package.json': JSON.stringify({ dependencies: { '@gnomeola/protocol': 'workspace:*' } }),
      'packages/ui/src/app.tsx': `import { db } from '../../store/src/index.ts'`,
    })
    const v = checkBoundaries(root)
    expect(v).toHaveLength(1)
    expect(v[0]!.specifier).toBe('../../store/src/index.ts')
  })

  it('passes a clean client', () => {
    const root = fixtureRepo({
      'packages/cli/package.json': JSON.stringify({
        dependencies: { '@gnomeola/protocol': 'workspace:*', zod: '^4' },
      }),
      'packages/cli/src/main.ts': `import { routes } from '@gnomeola/protocol'`,
    })
    expect(checkBoundaries(root)).toEqual([])
  })
})

describe('layer rules (M8)', () => {
  it('keeps the capture-agent on protocol + capture, and the server off local-only packages', () => {
    const root = fixtureRepo({
      'packages/capture-agent/package.json': JSON.stringify({
        dependencies: { '@gnomeola/protocol': 'workspace:*', '@gnomeola/store': 'workspace:*' },
        devDependencies: { '@gnomeola/server': 'workspace:*' },
      }),
      'packages/capture-agent/src/a.ts': `import { x } from '@gnomeola/capture'\nimport { d } from '@gnomeola/daemon'`,
      'packages/capture-agent/test/a.test.ts': `import { s } from '@gnomeola/server'`,
      'packages/server/package.json': JSON.stringify({ dependencies: { '@gnomeola/stt': 'workspace:*' } }),
      'packages/server/src/ok.ts': `import { c } from '@gnomeola/stt/cloud'\nimport { p } from '@gnomeola/store/pg'`,
      'packages/server/src/bad.ts': `import { s } from '@gnomeola/stt'\nimport { r } from '../../capture/src/index.ts'`,
    })
    expect(checkLayers(root).map((v) => `${v.pkg} ${v.where} ${v.specifier}`)).toEqual([
      'capture-agent package.json#dependencies @gnomeola/store',
      'capture-agent packages/capture-agent/src/a.ts @gnomeola/daemon',
      'server packages/server/src/bad.ts @gnomeola/stt',
      'server packages/server/src/bad.ts ../../capture/src/index.ts',
    ])
  })

  it('the real repository is clean', () => {
    expect(checkLayers(join(import.meta.dirname, '..'))).toEqual([])
  })
})
