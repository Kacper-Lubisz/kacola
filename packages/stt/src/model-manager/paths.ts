import { homedir } from 'node:os'
import { platformPaths } from '@gnomeola/protocol'

/**
 * `$GNOMEOLA_MODELS_DIR`, else `<platform data root>/models`: `${XDG_DATA_HOME:-~/.local/share}/gnomeola/models`
 * on Linux and in the Flatpak, `~/Library/Application Support/gnomeola/models` on macOS.
 */
export function defaultModelsDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): string {
  return platformPaths({ platform, env, home: homedir() }).modelsDir
}
