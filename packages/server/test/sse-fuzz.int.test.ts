import { sseFuzz } from './sse-fuzz.ts'

// V-8 in the blocking tier: one seed per dialect (the e2e tier runs more).
sseFuzz([7], 40)
