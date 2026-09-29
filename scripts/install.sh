#!/usr/bin/env bash
# gnomeola user-level installer (non-Flatpak; the plan's S-2 ships this first).
#
#   scripts/install.sh [--prefix DIR] [--node PATH] [--no-service] [--no-skill] [--no-extension] [--dry-run]
#   scripts/install.sh --uninstall [--prefix DIR] [--purge]
#
# Installs, per user and without root:
#   $PREFIX/share/gnomeola/app/          the runtime (this repo minus dev-only files, with node_modules)
#   $PREFIX/bin/gnomeola                 the CLI
#   $PREFIX/bin/gnomeolad                the daemon launcher
#   $PREFIX/bin/gnomeola-ui              the GTK app launcher
#   ~/.config/systemd/user/gnomeolad.service
#   $PREFIX/share/applications/org.gnome.Gnomeola.desktop
#   ~/.claude/skills/meeting-context/    the Claude Code skill (unless --no-skill)
#   ${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions/gnomeola@gnomeola.org/
#                                        the top-bar extension: installed, NEVER enabled (unless --no-extension)
#
# Recordings, the database and models live in ${XDG_DATA_HOME:-~/.local/share}/gnomeola and are never touched
# by install or a plain uninstall; --purge removes them too.
set -euo pipefail

PREFIX="${HOME}/.local"
NODE=""
SERVICE=1
SKILL=1
EXTENSION=1
DRY=0
UNINSTALL=0
PURGE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --node) NODE="$2"; shift 2 ;;
    --no-service) SERVICE=0; shift ;;
    --no-skill) SKILL=0; shift ;;
    --no-extension) EXTENSION=0; shift ;;
    --dry-run) DRY=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --purge) PURGE=1; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "install.sh: unknown option $1" >&2; exit 2 ;;
  esac
done

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP="${PREFIX}/share/gnomeola/app"
BIN="${PREFIX}/bin"
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
DESKTOP_DIR="${PREFIX}/share/applications"
DATA="${XDG_DATA_HOME:-${HOME}/.local/share}/gnomeola"
SKILLS="${HOME}/.claude/skills"
EXT_UUID="gnomeola@gnomeola.org"
EXT_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/gnome-shell/extensions/${EXT_UUID}"

run() { if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi; }
say() { echo "gnomeola: $*"; }

systemctl_user() {
  # Only touch the user's systemd if there is one. GNOMEOLA_INSTALL_NO_SYSTEMCTL=1 (tests) writes the unit
  # file but never talks to the running user manager.
  [ "${GNOMEOLA_INSTALL_NO_SYSTEMCTL:-0}" = 1 ] && return 0
  if [ "$SERVICE" = 1 ] && command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    run systemctl --user "$@" || true
  fi
}

if [ "$UNINSTALL" = 1 ]; then
  systemctl_user disable --now gnomeolad.service
  run rm -f "${UNIT_DIR}/gnomeolad.service" "${BIN}/gnomeola" "${BIN}/gnomeolad" "${BIN}/gnomeola-ui" \
    "${DESKTOP_DIR}/org.gnome.Gnomeola.desktop"
  run rm -rf "${PREFIX}/share/gnomeola"
  if [ -f "${SKILLS}/meeting-context/.gnomeola-installed" ]; then run rm -rf "${SKILLS}/meeting-context"; fi
  run rm -rf "$EXT_DIR"
  systemctl_user daemon-reload
  if [ "$PURGE" = 1 ]; then run rm -rf "$DATA"; say "removed recordings and models in $DATA"; else say "kept your recordings in $DATA (use --purge to remove)"; fi
  say "uninstalled"
  exit 0
fi

# ---- preflight --------------------------------------------------------------------------------------
if [ -z "$NODE" ]; then
  for cand in "$(command -v node || true)" "${HOME}"/.local/share/mise/installs/node/24*/bin/node; do
    [ -x "$cand" ] || continue
    major="$("$cand" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$major" -ge 24 ]; then NODE="$cand"; break; fi
  done
fi
[ -n "$NODE" ] || { echo "install.sh: need Node 24+ (pass --node PATH)" >&2; exit 1; }
[ -d "${SRC}/node_modules" ] || { echo "install.sh: run 'pnpm install' in ${SRC} first" >&2; exit 1; }
for tool in pw-record pw-dump ffmpeg; do command -v "$tool" >/dev/null || say "warning: $tool not found — capture/archive will be unavailable"; done
say "installing to ${PREFIX} with node $("$NODE" -v) at ${NODE}"

# ---- build ------------------------------------------------------------------------------------------
# The UI is a GTKX bundle; build it from source unless a current one exists.
UI_BUNDLE="${SRC}/packages/ui/dist/bundle.mjs"
if [ "${GNOMEOLA_INSTALL_NO_BUILD:-0}" != 1 ] && { [ ! -f "$UI_BUNDLE" ] || [ -n "$(find "${SRC}/packages/ui/src" -newer "$UI_BUNDLE" -print -quit)" ]; }; then
  say "building the UI bundle"
  if [ "$DRY" = 1 ]; then echo "+ pnpm --filter @gnomeola/ui build"; else (cd "$SRC" && PATH="$(dirname "$NODE"):$PATH" pnpm --filter @gnomeola/ui build >/dev/null); fi
fi
[ "$DRY" = 1 ] || [ -f "$UI_BUNDLE" ] || { echo "install.sh: UI bundle missing at $UI_BUNDLE" >&2; exit 1; }

# ---- runtime ----------------------------------------------------------------------------------------
# Copy the repo runtime. TypeScript runs directly on Node 24 (type stripping), which Node refuses to do
# inside node_modules, so workspace packages must stay under packages/ — hence a tree copy, not a bundle.
run mkdir -p "$APP" "$BIN" "$DESKTOP_DIR"
if [ "$DRY" = 1 ]; then echo "+ copy runtime ${SRC} -> ${APP}"; else
  tar -C "$SRC" \
    --exclude=./.git --exclude=./.claude --exclude=./extensions/dist --exclude=./notes --exclude=./reports --exclude=./.stryker-tmp \
    --exclude='./packages/*/test' --exclude='*/__artifacts__' --exclude=./.github --exclude=./packages/e2e \
    -cf - . | tar -C "$APP" -xf -
fi

write() { # path mode (content on stdin)
  if [ "$DRY" = 1 ]; then echo "+ write $1"; cat >/dev/null; else cat >"$1"; chmod "$2" "$1"; fi
}

write "${BIN}/gnomeola" 755 <<SH
#!/bin/sh
exec "${NODE}" "${APP}/packages/cli/src/main.ts" "\$@"
SH
write "${BIN}/gnomeolad" 755 <<SH
#!/bin/sh
exec "${NODE}" "${APP}/packages/daemon/src/main.ts" "\$@"
SH
write "${BIN}/gnomeola-ui" 755 <<SH
#!/bin/sh
cd "${APP}/packages/ui" && exec "${NODE}" dist/bundle.mjs "\$@"
SH

write "${DESKTOP_DIR}/org.gnome.Gnomeola.desktop" 644 <<DESKTOP
[Desktop Entry]
Type=Application
Name=gnomeola
Comment=Record, transcribe and search your meetings
Exec=${BIN}/gnomeola-ui
Icon=audio-input-microphone-symbolic
Categories=GNOME;GTK;Office;AudioVideo;
Keywords=meeting;transcript;notes;record;
StartupNotify=true
DESKTOP

# ---- service ----------------------------------------------------------------------------------------
if [ "$SERVICE" = 1 ]; then
  run mkdir -p "$UNIT_DIR"
  write "${UNIT_DIR}/gnomeolad.service" 644 <<UNIT
[Unit]
Description=gnomeola meeting recorder daemon
After=pipewire.service wireplumber.service
Wants=pipewire.service

[Service]
Type=simple
ExecStart=${BIN}/gnomeolad
Restart=on-failure
RestartSec=2
# The daemon binds loopback only (and refuses anything else); no network exposure to configure.

[Install]
WantedBy=default.target
UNIT
  systemctl_user daemon-reload
  systemctl_user enable --now gnomeolad.service
fi

# ---- GNOME Shell extension (C-9) -------------------------------------------------------------------
# Packed with the Shell's own `gnome-extensions pack`, then unpacked into the user's extensions dir with
# its schemas compiled. This never talks to the running Shell and never enables anything: turning a Shell
# extension on is the user's decision (and on Wayland it only takes effect after logging in again).
if [ "$EXTENSION" = 1 ]; then
  if ! command -v gnome-extensions >/dev/null || ! command -v unzip >/dev/null; then
    say "warning: gnome-extensions or unzip not found — skipping the top-bar extension"
  elif [ "$DRY" = 1 ]; then
    echo "+ ${SRC}/extensions/pack.sh -> ${EXT_DIR}"
  else
    PACK_DIR="$(mktemp -d)"
    ZIP="$(bash "${SRC}/extensions/pack.sh" "$PACK_DIR" | tail -n 1)"
    rm -rf "$EXT_DIR"
    mkdir -p "$EXT_DIR"
    unzip -q -o "$ZIP" -d "$EXT_DIR"
    glib-compile-schemas "${EXT_DIR}/schemas"
    rm -rf "$PACK_DIR"
    say "installed the top-bar extension (not enabled); to use it: gnome-extensions enable ${EXT_UUID}"
  fi
fi

# ---- skill ------------------------------------------------------------------------------------------
if [ "$SKILL" = 1 ]; then
  if [ "$DRY" = 1 ]; then echo "+ ${BIN}/gnomeola skill install"; else "${BIN}/gnomeola" skill install --text || true; fi
fi

say "done. Open 'gnomeola' from Activities, or run: gnomeola status"
case ":${PATH}:" in *":${BIN}:"*) ;; *) say "note: ${BIN} is not on your PATH" ;; esac
