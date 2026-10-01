import { defineConfig } from 'vitest/config'

// Mutation testing runs only the tests that target the mutated packages (see stryker.protocol.config.mjs).
// Running every project there would drag the real-audio and UI e2e suites into Stryker's sandbox, which
// neither needs them nor copies their fixtures.
export default defineConfig({
  test: {
    include: [
      'packages/protocol/test/**/*.test.ts',
      'packages/testkit/test/invariants.test.ts',
      'packages/testkit/test/invariants-agenda.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/*.int.test.ts', '**/*.e2e.test.ts', '**/*.eval.test.ts'],
    testTimeout: 10_000,
  },
})
