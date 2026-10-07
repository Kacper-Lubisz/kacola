import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkBoundaries, checkLayers, checkRuntime, importsIn, isForbidden } from './check-boundaries.ts'

function fixtureRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'kacola-boundaries-'))
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, body)
  }
  return root
}

describe('boundary rule', () => {
  it('allows protocol, forbids every other internal package', () => {
    expect(isForbidden('@kacola/protocol')).toBe(false)
    expect(isForbidden('@kacola/protocol/client')).toBe(false)
    for (const p of ['store', 'capture', 'stt', 'llm', 'daemon', 'testkit'])
      expect(isForbidden(`@kacola/${p}`)).toBe(true)
    expect(isForbidden('zod')).toBe(false)
    expect(isForbidden('../../store/src/index.ts')).toBe(true)
    expect(isForbidden('./local.ts')).toBe(false)
  })

  it('finds static, dynamic, re-export and require specifiers', () => {
    const src = `import a from '@kacola/store'\nexport { b } from "x"\nconst c = await import('@kacola/llm')\nconst d = require('y')\nimport type { T } from '@kacola/protocol'`
    expect(importsIn(src)).toEqual(['@kacola/store', 'x', '@kacola/llm', 'y', '@kacola/protocol'])
  })

  it('flags a client that declares a forbidden dependency', () => {
    const root = fixtureRepo({
      'packages/cli/package.json': JSON.stringify({ dependencies: { '@kacola/store': 'workspace:*' } }),
    })
    expect(checkBoundaries(root)).toEqual([
      { pkg: 'cli', where: 'package.json#dependencies', specifier: '@kacola/store' },
    ])
  })

  it('flags a client that imports around its manifest', () => {
    const root = fixtureRepo({
      'packages/web/package.json': JSON.stringify({ dependencies: { '@kacola/protocol': 'workspace:*' } }),
      'packages/web/src/app.tsx': `import { db } from '../../store/src/index.ts'`,
    })
    const v = checkBoundaries(root)
    expect(v).toHaveLength(1)
    expect(v[0]!.specifier).toBe('../../store/src/index.ts')
  })

  it('passes a clean client', () => {
    const root = fixtureRepo({
      'packages/cli/package.json': JSON.stringify({
        dependencies: { '@kacola/protocol': 'workspace:*', zod: '^4' },
      }),
      'packages/cli/src/main.ts': `import { routes } from '@kacola/protocol'`,
    })
    expect(checkBoundaries(root)).toEqual([])
  })
})

describe('window clients (Electron split)', () => {
  it('lets the window import ui-core, and nobody else', () => {
    const root = fixtureRepo({
      'packages/desktop/package.json': JSON.stringify({
        dependencies: { '@kacola/protocol': 'workspace:*', '@kacola/ui-core': 'workspace:*' },
      }),
      'packages/desktop/src/renderer/a.ts': `import { x } from '@kacola/ui-core/sessions'`,
      'packages/desktop/src/main/b.ts': `import { d } from '@kacola/daemon'\nimport { e } from '../../../daemon/src/main.ts'`,
      'packages/ui-core/package.json': JSON.stringify({
        dependencies: { '@kacola/protocol': 'workspace:*' },
      }),
      'packages/ui-core/src/c.ts': `import { db } from '@kacola/store'`,
      'packages/cli/package.json': JSON.stringify({ dependencies: { '@kacola/ui-core': 'workspace:*' } }),
    })
    expect(checkBoundaries(root).map((v) => `${v.pkg} ${v.where} ${v.specifier}`)).toEqual([
      'cli package.json#dependencies @kacola/ui-core',
      'ui-core packages/ui-core/src/c.ts @kacola/store',
      'desktop packages/desktop/src/main/b.ts @kacola/daemon',
      'desktop packages/desktop/src/main/b.ts ../../../daemon/src/main.ts',
    ])
  })

  it('keeps Node out of ui-core, the renderer and the preload', () => {
    const root = fixtureRepo({
      'packages/ui-core/src/a.ts': `import { readFileSync } from 'node:fs'`,
      'packages/desktop/src/renderer/b.tsx': `import { ipcRenderer } from 'electron'\nimport React from 'react'`,
      'packages/desktop/src/preload/c.ts': `import { contextBridge } from 'electron'\nimport { join } from 'node:path'`,
      'packages/desktop/src/main/d.ts': `import { app } from 'electron'\nimport { join } from 'node:path'`,
    })
    expect(checkRuntime(root).map((v) => `${v.where} ${v.specifier}`)).toEqual([
      'packages/ui-core/src/a.ts node:fs',
      'packages/desktop/src/renderer/b.tsx electron',
      'packages/desktop/src/preload/c.ts node:path',
    ])
  })

  it('the real repository is clean', () => {
    const root = join(import.meta.dirname, '..')
    expect(checkBoundaries(root)).toEqual([])
    expect(checkRuntime(root)).toEqual([])
  })
})

describe('layer rules (M8)', () => {
  it('keeps the capture-agent on protocol + capture, and the server off local-only packages', () => {
    const root = fixtureRepo({
      'packages/capture-agent/package.json': JSON.stringify({
        dependencies: { '@kacola/protocol': 'workspace:*', '@kacola/store': 'workspace:*' },
        devDependencies: { '@kacola/server': 'workspace:*' },
      }),
      'packages/capture-agent/src/a.ts': `import { x } from '@kacola/capture'\nimport { d } from '@kacola/daemon'`,
      'packages/capture-agent/test/a.test.ts': `import { s } from '@kacola/server'`,
      'packages/server/package.json': JSON.stringify({ dependencies: { '@kacola/stt': 'workspace:*' } }),
      'packages/server/src/ok.ts': `import { c } from '@kacola/stt/cloud'\nimport { p } from '@kacola/store/pg'`,
      'packages/server/src/bad.ts': `import { s } from '@kacola/stt'\nimport { r } from '../../capture/src/index.ts'`,
    })
    expect(checkLayers(root).map((v) => `${v.pkg} ${v.where} ${v.specifier}`)).toEqual([
      'capture-agent package.json#dependencies @kacola/store',
      'capture-agent packages/capture-agent/src/a.ts @kacola/daemon',
      'server packages/server/src/bad.ts @kacola/stt',
      'server packages/server/src/bad.ts ../../capture/src/index.ts',
    ])
  })

  it('the real repository is clean', () => {
    expect(checkLayers(join(import.meta.dirname, '..'))).toEqual([])
  })
})
