#!/usr/bin/env node
// pnpm sandbox — an isolated kacola with a mock calendar, a local sharing server and a separate
// "kacola · sandbox" window, to try every feature alone. The implementation lives in
// packages/e2e/src/sandbox/ (it reuses the e2e suites' pieces); docs/testing-kacola.md is the guide.
import { main } from '../packages/e2e/src/sandbox/cli.ts'

process.stdout.on('error', () => {}) // `pnpm sandbox scenarios | head`

process.exitCode = await main(process.argv.slice(2))
