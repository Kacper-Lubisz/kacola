import { defineConfig } from 'vitest/config'

// Test tiers (see the plan's Verification section):
//   unit  — T0 unit + T1 contract. Hermetic, fast, blocking on every commit.
//   int   — T2 integration: real daemon + real SQLite + fake capture + LLM cassettes.
//   e2e   — T3: real PipeWire rig, real models, real UI via AT-SPI. Slow.
//   eval  — T4: accuracy baselines and live-LLM evals. Opt-in, tracked against baselines.
const common = { exclude: ['**/node_modules/**', '**/dist/**'] }
/** The hermetic tiers (not eval): live-provider keys stripped, XDG data/config/state in a temp home. */
const hermetic = { setupFiles: ['scripts/test-env.ts'] }

export default defineConfig({
  test: {
    projects: [
      {
        // React component tests (*.test.tsx) opt into a DOM with `// @vitest-environment jsdom`.
        esbuild: { jsx: 'automatic' },
        // the desktop renderer's brand-asset alias (packages/desktop/electron.vite.config.ts)
        resolve: { alias: { '@brand': new URL('./brand', import.meta.url).pathname } },
        test: {
          ...common,
          ...hermetic,
          name: 'unit',
          include: [
            'packages/*/src/**/*.test.{ts,tsx}',
            'packages/*/test/**/*.test.{ts,tsx}',
            'scripts/**/*.test.ts',
            'brand/**/*.test.ts',
          ],
          exclude: [...common.exclude, '**/*.int.test.ts', '**/*.e2e.test.ts', '**/*.eval.test.ts'],
          testTimeout: 10_000,
        },
      },
      {
        test: {
          ...common,
          ...hermetic,
          name: 'int',
          include: ['packages/*/**/*.int.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          ...common,
          ...hermetic,
          name: 'e2e',
          include: ['packages/*/**/*.e2e.test.ts'],
          testTimeout: 300_000,
          hookTimeout: 300_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          ...common,
          name: 'eval',
          include: ['packages/*/**/*.eval.test.ts'],
          setupFiles: ['scripts/eval-env.ts'],
          testTimeout: 900_000,
          hookTimeout: 900_000,
          fileParallelism: false,
        },
      },
    ],
  },
})
