// Vercel function: POST /sessions/:id/audio/finalize — assembles uploaded chunks and runs cloud
// transcription (full offload), so it gets the long duration budget.
import { vercelHandler } from '../app.ts'

declare const __MAX_DURATION__: number | undefined
export default vercelHandler('finalize', typeof __MAX_DURATION__ === 'number' ? __MAX_DURATION__ : undefined)
