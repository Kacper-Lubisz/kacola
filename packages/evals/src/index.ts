// @gnomeola/evals — the AI eval suites for agendas + live intelligence.
//
//   types.ts        runner hooks a pipeline implements (the tracker wave plugs in here)
//   runners.ts      reference runners over a DecisionProvider, extractive offline runners
//   llm-runners.ts  LLM runners for drafting and recap (text LLM layer)
//   suites.ts       dataset × runner → scorecard (graders from @gnomeola/testkit/evals)
//   providers.ts    the offline / fake / live provider matrix
//   run.ts          run every decision suite for one provider setup
export * from './baselines.ts'
export * from './llm-runners.ts'
export * from './providers.ts'
export * from './run.ts'
export * from './runners.ts'
export * from './suites.ts'
export type * from './types.ts'
