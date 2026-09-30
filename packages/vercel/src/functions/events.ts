// Vercel function: GET /events — the cursor-resumable SSE stream, ended by the server itself shortly
// before this function's maxDuration so a client always sees a clean end and reconnects with its cursor.
import { vercelHandler } from '../app.ts'

declare const __MAX_DURATION__: number | undefined
export default vercelHandler('events', typeof __MAX_DURATION__ === 'number' ? __MAX_DURATION__ : undefined)
