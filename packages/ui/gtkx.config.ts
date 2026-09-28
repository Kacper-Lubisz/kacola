import { defineConfig } from '@gtkx/config'

// GTKX codegen + build configuration. See docs/gtkx.md.
export default defineConfig({
  applicationId: 'org.gnome.Gnomeola.App',
  // `libraries` is omitted: Gtk-4.0 and Adw-1 are bound by v2DefaultLibraries. Name only extra
  // namespaces here (an empty array is rejected).
  // Do not write AGENTS.md / CLAUDE.md into the package, but keep the on-disk element reference
  // (.gtkx/reference, gitignored): it is the fastest way to look up a widget's props and signals.
  agents: { rules: false, reference: true },
  future: {
    v2ByteArrays: true,
    v2ValueReturns: true,
    v2FinishResults: true,
    v2InoutReturns: true,
    v2ResourceImports: true,
    v2DefaultLibraries: true,
    v2TreeShaking: true,
  },
})
