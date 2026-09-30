import { z } from 'zod'

// Imported first by main.tsx. Zod probes for `new Function` to JIT its object parsers; our CSP has no
// 'unsafe-eval', so the probe would only log a violation. Say up front that there is no eval.
z.config({ jitless: true })
