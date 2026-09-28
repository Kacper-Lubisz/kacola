/// <reference types="@gtkx/cli/env" />
/// <reference path="../node_modules/.gtkx/env.d.ts" />

// Vite's `?raw` imports (THIRD_PARTY_NOTICES.md is bundled into the About dialog).
declare module '*?raw' {
  const text: string
  export default text
}
