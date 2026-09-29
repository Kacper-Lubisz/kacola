// Vercel function: every JSON route of the protocol (see ../app.ts).
import { vercelHandler } from '../app.ts'

declare const __MAX_DURATION__: number | undefined
export default vercelHandler('api', typeof __MAX_DURATION__ === 'number' ? __MAX_DURATION__ : undefined)
