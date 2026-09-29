import { defineConfig } from '@gtkx/config'

// GTKX codegen + build configuration. See docs/gtkx.md.
export default defineConfig({
  applicationId: 'org.gnome.Gnomeola.App',
  // Gtk-4.0 and Adw-1 are bound by v2DefaultLibraries; `libraries` names only the extras (an empty
  // array is rejected). GtkSource-5 is the notes editor (M7). Its GIR XML is vendored in ./gir
  // (from Fedora's gtksourceview5-devel 5.20.0, LGPL-2.1-or-later): Fedora ships the typelib and the
  // library in gtksourceview5, but the GIR codegen reads only in -devel. See docs/gtkx.md §3.
  libraries: ['GtkSource-5'],
  girPath: ['./gir'],
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
