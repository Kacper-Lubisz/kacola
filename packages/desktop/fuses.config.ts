import { type FuseConfig, FuseV1Options, FuseVersion, flipFuses } from '@electron/fuses'

// Electron fuses for packaged builds (flipped into the binary by packaging; see docs/desktop-app.md).
//
//   RunAsNode ON — deliberately: the one bundled runtime also runs the daemon and the CLI
//     (ELECTRON_RUN_AS_NODE=1 electron daemon.mjs), the way VS Code runs its helpers. The price is that
//     anyone who can exec the binary can run Node with it — which they could with the node they
//     already have; it grants no privilege the user lacks.
//   NodeOptions env var and --inspect OFF — no attaching a debugger or preloading code into the app.
//   ASAR integrity + only-load-from-asar ON — the app code cannot be swapped on disk (enforced where
//     Electron supports it: macOS and Windows; a no-op on Linux today).
//   Cookie encryption ON, file:// extra privileges OFF (we serve from app://).
export const FUSES = {
  version: FuseVersion.V1,
  strictlyRequireAllFuses: true,
  [FuseV1Options.RunAsNode]: true,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  [FuseV1Options.WasmTrapHandlers]: true,
} as const satisfies FuseConfig

/** Flip the fuses of a packaged Electron binary in place. */
export function applyFuses(electronBinary: string, resetAdHocDarwinSignature = false): Promise<number> {
  return flipFuses(electronBinary, { ...FUSES, resetAdHocDarwinSignature })
}
