// V-9b — mutation testing over the packages where a wrong test is most dangerous. A mutant that
// survives means some behaviour could change without any test noticing.
// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.stryker.config.ts', related: false },
  mutate: [
    'packages/protocol/src/sse.ts',
    'packages/protocol/src/time.ts',
    'packages/protocol/src/client.ts',
    'packages/protocol/src/routes.ts',
    'packages/testkit/src/invariants/index.ts',
    'packages/protocol/src/notes-diff.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: 'reports/mutation/protocol.json' },
  thresholds: { high: 90, low: 80, break: 85 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
  // Stryker copies the project into a sandbox: keep build outputs (dist/ holds the Flatpak build cache,
  // GBs), screenshots and reports out, or its file scan alone runs out of memory.
  ignorePatterns: [
    '.claude',
    'notes',
    'node_modules',
    '**/fixtures/**',
    'dist',
    'reports',
    '**/out/**',
    '**/__artifacts__/**',
    '**/__screenshots__/**',
    '**/test-results/**',
    'packaging/flatpak/input',
    '**/.vercel/**',
    '.stryker-tmp',
  ],
}
