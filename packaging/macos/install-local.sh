#!/usr/bin/env bash
# Builds kacola.app on this Mac and installs it in ~/Applications, replacing the one there (once nothing
# is recording), and starts it in the background. Signed with this Mac's local identity (made here the
# first time), so macOS keeps kacola's permissions from one build to the next.
#
#   packaging/macos/install-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

packaging/macos/signing-identity.sh

if command -v fnm >/dev/null; then
  eval "$(fnm env --shell bash)"
  fnm use --install-if-missing 24 >/dev/null
fi
node scripts/build-macos.ts --arch arm64
APP=dist/macos/out/mac-arm64/kacola.app

# checked after the build: a meeting may have started recording during it
if command -v kacola >/dev/null && ! kacola daemon idle >/dev/null; then
  echo "kacola is recording; run this again when it is done" >&2
  exit 1
fi

osascript -e 'quit app "kacola"' 2>/dev/null || true
while pgrep -f "kacola.app/Contents/MacOS" >/dev/null; do sleep 1; done
rm -rf "$HOME/Applications/kacola.app"
ditto "$APP" "$HOME/Applications/kacola.app"
open -g "$HOME/Applications/kacola.app"
echo "kacola: installed in ~/Applications and started"
