import { homedir } from 'node:os'
import { join } from 'node:path'

/** `$GNOMEOLA_MODELS_DIR`, else `${XDG_DATA_HOME:-~/.local/share}/gnomeola/models`. */
export function defaultModelsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GNOMEOLA_MODELS_DIR) return env.GNOMEOLA_MODELS_DIR
  const data = env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(data, 'gnomeola', 'models')
}
