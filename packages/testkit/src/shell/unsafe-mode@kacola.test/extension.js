// TEST-ONLY. Never installed outside a throwaway nested Shell (packages/testkit/src/shell).
//
// GNOME Shell 50 answers org.gnome.Shell.Eval only in "unsafe mode", and the only built-in way to enter it
// is Looking Glass. This companion extension flips the flag when enabled, so a test can introspect the
// real extension's actors in the nested instance through Eval — without the production extension
// carrying any test hook of its own.

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'

export default class UnsafeModeForTests extends Extension {
  enable() {
    global.context.unsafe_mode = true
  }

  disable() {
    global.context.unsafe_mode = false
  }
}
