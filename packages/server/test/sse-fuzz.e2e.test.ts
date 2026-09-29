import { sseFuzz } from './sse-fuzz.ts'

// V-8, the longer run: more seeds and more raw reconnections per dialect.
sseFuzz([2026, 31337, 4242], 120)
