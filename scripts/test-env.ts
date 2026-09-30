// Setup for the unit, int and e2e tiers: those tiers are hermetic and free, so a real OpenAI key in the
// developer's shell must never reach them — not the test process, and not the daemons, CLIs and UIs it
// spawns (they inherit this environment). Live calls belong to the eval tier, which keeps the key.
delete process.env.OPENAI_API_KEY
delete process.env.OPENAI_BASE_URL
delete process.env.TYPESAFE_API_KEY
delete process.env.TYPESAFE_BASE_URL
