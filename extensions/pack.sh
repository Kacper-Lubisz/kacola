#!/usr/bin/env bash
# C-9: package the GNOME Shell extension with the Shell's own tool.
#
#   extensions/pack.sh [OUT_DIR]      → OUT_DIR/gnomeola@gnomeola.org.shell-extension.zip (default extensions/dist)
#
# `gnome-extensions pack` bundles extension.js, prefs.js, metadata.json and stylesheet.css itself; every
# other module and the GSettings schema must be named here, or the packed extension fails to load.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
UUID="gnomeola@gnomeola.org"
SRC="${HERE}/${UUID}"
OUT="${1:-${HERE}/dist}"
mkdir -p "$OUT"

extra=()
for f in "$SRC"/*.js; do
  case "$(basename "$f")" in extension.js|prefs.js) ;; *) extra+=("--extra-source=$(basename "$f")") ;; esac
done

gnome-extensions pack "$SRC" --force --out-dir="$OUT" \
  --schema="schemas/org.gnome.shell.extensions.gnomeola.gschema.xml" "${extra[@]}"
echo "${OUT}/${UUID}.shell-extension.zip"
