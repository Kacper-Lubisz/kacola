import { homedir } from 'node:os'
import { platformPaths } from '@kacola/protocol'

/**
 * `$KACOLA_MODELS_DIR`, else `<platform data root>/models`: `${XDG_DATA_HOME:-~/.local/share}/kacola/models`
 * on Linux and in the Flatpak, `~/Library/Application Support/kacola/models` on macOS.
 */
export function defaultModelsDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): string {
  return platformPaths({ platform, env, home: homedir() }).modelsDir
}
