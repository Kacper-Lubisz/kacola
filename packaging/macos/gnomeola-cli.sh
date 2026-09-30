#!/bin/sh
# gnomeola(1) inside gnomeola.app (Contents/Resources/bin/gnomeola): the bundled CLI on the app's own
# Electron binary running as Node. Symlink it onto your PATH, or let the app (or `gnomeola install-cli`)
# write a shim to /usr/local/bin or ~/.local/bin that also starts the app when its daemon is down.
self=$0
while [ -L "$self" ]; do
  link=$(readlink "$self")
  case "$link" in /*) self=$link ;; *) self=$(dirname "$self")/$link ;; esac
done
resources=$(cd "$(dirname "$self")/.." && pwd)
ELECTRON_RUN_AS_NODE=1 exec "$resources/../MacOS/gnomeola" "$resources/runtime/cli.mjs" "$@"
