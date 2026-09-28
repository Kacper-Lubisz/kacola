// V-9b — mutation testing over the packages where a wrong test is most dangerous. A mutant that
// survives means some behaviour could change without any test noticing.
// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.config.ts', related: false },
  mutate: [
    'packages/protocol/src/sse.ts',
    'packages/protocol/src/time.ts',
    'packages/protocol/src/client.ts',
    'packages/protocol/src/routes.ts',
    'packages/testkit/src/invariants/index.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: 'reports/mutation/protocol.json' },
  thresholds: { high: 90, low: 80, break: 80 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
  ignorePatterns: ['.claude', 'notes', 'node_modules', '**/fixtures/**'],
}
