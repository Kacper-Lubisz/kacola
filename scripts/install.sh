#!/usr/bin/env bash
# gnomeola user-level installer (non-Flatpak; the plan's S-2 ships this first).
#
#   scripts/install.sh [--prefix DIR] [--node PATH] [--no-service] [--no-skill] [--no-extension] [--dry-run] [--force]
#   scripts/install.sh --uninstall [--prefix DIR] [--purge]
#
# Installs, per user and without root:
#   $PREFIX/share/gnomeola/app/          the daemon + CLI runtime (this repo minus dev-only files, with node_modules)
#   $PREFIX/share/gnomeola/desktop/      the window: the packaged Electron app (scripts/build-desktop.ts)
#   $PREFIX/bin/gnomeola                 the CLI
#   $PREFIX/bin/gnomeolad                the daemon launcher
#   $PREFIX/bin/gnomeola-ui              the window launcher
#   ~/.config/systemd/user/gnomeolad.service
#   $PREFIX/share/applications/org.gnome.Gnomeola.desktop   (shown as "kacola")
#   $PREFIX/share/icons/hicolor/*/apps/org.gnome.Gnomeola*  the brand icons
#   ~/.claude/skills/meeting-context/    the Claude Code skill (unless --no-skill)
#   ${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions/gnomeola@gnomeola.org/
#                                        the top-bar extension: installed, NEVER enabled (unless --no-extension)
#
# Recordings, the database and models live in ${XDG_DATA_HOME:-~/.local/share}/gnomeola and are never touched
# by install or a plain uninstall; --purge removes them too.
#
# The window attaches to the systemd daemon (GNOMEOLA_URL, default http://127.0.0.1:8787); with --no-service it
# starts its own bundled daemon instead. GNOMEOLA_DESKTOP_APP_DIR=<linux-unpacked> installs that build instead
# of building one (dist/desktop/linux-unpacked is rebuilt when any package source is newer than it).
#
# A meeting being recorded is never interrupted: if the running daemon (asked at GNOMEOLA_URL) is recording,
# install refuses — exit 3, nothing replaced — unless --force. Afterwards the daemon is asked to restart on the
# new version once nothing is recording (`gnomeola daemon restart`, at once if idle); it is never restarted
# under a recording.
set -euo pipefail

PREFIX="${HOME}/.local"
NODE=""
SERVICE=1
SKILL=1
EXTENSION=1
DRY=0
UNINSTALL=0
PURGE=0
FORCE=0
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
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    *) echo "install.sh: unknown option $1" >&2; exit 2 ;;
  esac
done

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP="${PREFIX}/share/gnomeola/app"
DESKTOP_APP="${PREFIX}/share/gnomeola/desktop"
BIN="${PREFIX}/bin"
ICONS="${PREFIX}/share/icons/hicolor"
APP_ID="org.gnome.Gnomeola"
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
DESKTOP_DIR="${PREFIX}/share/applications"
DATA="${XDG_DATA_HOME:-${HOME}/.local/share}/gnomeola"
SKILLS="${HOME}/.claude/skills"
EXT_UUID="gnomeola@gnomeola.org"
EXT_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/gnome-shell/extensions/${EXT_UUID}"
DAEMON_URL="${GNOMEOLA_URL:-http://127.0.0.1:8787}"

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
    "${DESKTOP_DIR}/${APP_ID}.desktop"
  run rm -rf "${PREFIX}/share/gnomeola"
  for icon in "${ICONS}"/*/apps/"${APP_ID}".png "${ICONS}"/*/apps/"${APP_ID}".svg "${ICONS}"/*/apps/"${APP_ID}"-symbolic.svg; do
    [ -e "$icon" ] || continue
    run rm -f "$icon"
    run rmdir "$(dirname "$icon")" "$(dirname "$(dirname "$icon")")" 2>/dev/null || true
  done
  run rmdir "$ICONS" "$(dirname "$ICONS")" 2>/dev/null || true
  # what the installed window wrote itself: its autostart entry (Preferences) and its CLI shim (first run),
  # each only when it is ours (the window's marker) and points into this install
  AUTOSTART="${XDG_CONFIG_HOME:-${HOME}/.config}/autostart/${APP_ID}.desktop"
  if [ -f "$AUTOSTART" ] && grep -q '^X-Gnomeola-Autostart=1' "$AUTOSTART" && grep -qF "$DESKTOP_APP/" "$AUTOSTART"; then run rm -f "$AUTOSTART"; fi
  SHIM="${HOME}/.local/bin/gnomeola"
  if [ -f "$SHIM" ] && grep -q '^# gnomeola-cli-shim' "$SHIM" && grep -qF "$DESKTOP_APP/" "$SHIM"; then run rm -f "$SHIM"; fi
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

# Is a meeting being recorded right now? Asked of the running daemon itself (`gnomeola daemon idle`, with this
# checkout's CLI: it understands older daemons too) — never inferred. Exit 0 idle or no daemon, 5 recording.
daemon_cli() { "$NODE" "${SRC}/packages/cli/src/main.ts" "$@" --url "$DAEMON_URL"; }
set +e
BUSY="$(daemon_cli daemon idle --text 2>&1)"
IDLE_CODE=$?
set -e
if [ "$IDLE_CODE" != 0 ]; then
  if [ "$IDLE_CODE" = 5 ]; then
    WHY="the gnomeola daemon at ${DAEMON_URL} is ${BUSY#gnomeola: }"
  else
    WHY="could not tell whether the gnomeola daemon at ${DAEMON_URL} is recording (${BUSY})"
  fi
  if [ "$FORCE" != 1 ]; then
    echo "install.sh: refusing to install: ${WHY}." >&2
    echo "install.sh: installing now would replace the files it runs from in the middle of the meeting. Run this" >&2
    echo "install.sh: again when the meeting has ended, or pass --force (the daemon then restarts on the new version" >&2
    echo "install.sh: only once the recording has finished)." >&2
    exit 3
  fi
  say "warning: ${WHY}; installing anyway (--force): the daemon restarts only once the recording has finished"
fi
say "installing to ${PREFIX} with node $("$NODE" -v) at ${NODE}"

# ---- build ------------------------------------------------------------------------------------------
# The window is the packaged Electron app (electron-builder `dir`, executable `gnomeola`, the daemon/CLI runtime
# bundled for when no daemon answers). Built from source unless a current build exists: any package source,
# brand asset or extension file newer than its app.asar means stale.
LINUX_APP="${GNOMEOLA_DESKTOP_APP_DIR:-${SRC}/dist/desktop/linux-unpacked}"
stale_app() {
  [ -f "${LINUX_APP}/resources/app.asar" ] || return 0
  [ -n "$(find "${SRC}/packages" "${SRC}/brand" "${SRC}/extensions" \
    \( -name node_modules -o -name out -o -name dist -o -name test -o -name __artifacts__ \) -prune \
    -o -type f -newer "${LINUX_APP}/resources/app.asar" -print -quit)" ]
}
if [ "${GNOMEOLA_INSTALL_NO_BUILD:-0}" != 1 ] && [ -z "${GNOMEOLA_DESKTOP_APP_DIR:-}" ] && stale_app; then
  say "building the desktop app (node scripts/build-desktop.ts)"
  if [ "$DRY" = 1 ]; then echo "+ node scripts/build-desktop.ts"; else (cd "$SRC" && PATH="$(dirname "$NODE"):$PATH" "$NODE" scripts/build-desktop.ts >/dev/null); fi
fi
[ "$DRY" = 1 ] || [ -x "${LINUX_APP}/gnomeola" ] || { echo "install.sh: desktop app missing at ${LINUX_APP} (node scripts/build-desktop.ts)" >&2; exit 1; }

# ---- runtime ----------------------------------------------------------------------------------------
# Copy the repo runtime for the daemon and the CLI. TypeScript runs directly on Node 24 (type stripping), which
# Node refuses to do inside node_modules, so workspace packages must stay under packages/ — hence a tree copy,
# not a bundle. The window is installed on its own below, so its sources, builds and Electron stay out.
run mkdir -p "$APP" "$BIN" "$DESKTOP_DIR"
if [ "$DRY" = 1 ]; then echo "+ copy runtime ${SRC} -> ${APP}"; else
  tar -C "$SRC" \
    --exclude=./.git --exclude=./.claude --exclude=./extensions/dist --exclude=./notes --exclude=./reports --exclude=./.stryker-tmp \
    --exclude='./packages/*/test' --exclude='*/__artifacts__' --exclude=./.github --exclude=./packages/e2e \
    --exclude=./dist --exclude=./packages/desktop --exclude=./packaging --exclude='./node_modules/.pnpm/electron@*' \
    -cf - . | tar -C "$APP" -xf -
fi

# ---- the window ---------------------------------------------------------------------------------------
if [ "$DRY" = 1 ]; then echo "+ copy desktop app ${LINUX_APP} -> ${DESKTOP_APP}"; else
  rm -rf "$DESKTOP_APP"
  mkdir -p "$DESKTOP_APP"
  cp -a "${LINUX_APP}/." "$DESKTOP_APP/"
fi
# the brand icons under the app id (hicolor/<size>/apps/app.png → org.gnome.Gnomeola.png, app-symbolic.svg →
# org.gnome.Gnomeola-symbolic.svg)
for dir in "${SRC}"/brand/icons/hicolor/*/apps; do
  size="$(basename "$(dirname "$dir")")"
  for f in "$dir"/*; do
    name="$(basename "$f")"
    run mkdir -p "${ICONS}/${size}/apps"
    run cp "$f" "${ICONS}/${size}/apps/${APP_ID}${name#app}"
  done
done
if [ -f "${ICONS}/icon-theme.cache" ] && command -v gtk-update-icon-cache >/dev/null; then
  run gtk-update-icon-cache -q -t -f "$ICONS" || true
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
exec "${DESKTOP_APP}/gnomeola" "\$@"
SH

# Name is the brand (kacola); the ids stay org.gnome.Gnomeola until the rename. StartupWMClass is the Wayland
# app id Electron gives the window (package.json desktopName without .desktop; install.e2e checks it).
write "${DESKTOP_DIR}/${APP_ID}.desktop" 644 <<DESKTOP
[Desktop Entry]
Type=Application
Name=kacola
Comment=Record, transcribe and search your meetings
Exec=${BIN}/gnomeola-ui %U
Icon=${APP_ID}
Terminal=false
Categories=Office;AudioVideo;Audio;Recorder;
Keywords=meeting;transcript;notes;record;granola;gnomeola;
StartupNotify=true
StartupWMClass=${APP_ID}
X-GNOME-UsesNotifications=true
Actions=background;

[Desktop Action background]
Name=Start in the Background
Exec=${BIN}/gnomeola-ui --background
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
# reload = restart once nothing is recording (SIGHUP); the daemon then exits 76, which is a restart, not a failure
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=2
RestartForceExitStatus=76
SuccessExitStatus=76
# stop/restart suspends a live recording (the next daemon resumes it) within a few seconds; never hold up a logout
TimeoutStopSec=15
# The daemon binds loopback only (and refuses anything else); no network exposure to configure.

[Install]
WantedBy=default.target
UNIT
  systemctl_user daemon-reload
  systemctl_user enable gnomeolad.service
fi

# The running daemon moves to the new version by restarting once nothing is recording — asked of the daemon at
# the moment of the restart, never decided here (`gnomeola daemon restart`, the newly installed CLI). A daemon
# from before deferred restarts is asked whether it is idle right now, and restarted only if so.
restart_daemon() {
  [ "$SERVICE" = 1 ] || return 0
  if [ "$DRY" = 1 ]; then echo "+ gnomeola daemon restart --no-wait --only-supervised (once idle)"; return 0; fi
  local code=0
  "$NODE" "${APP}/packages/cli/src/main.ts" daemon restart --no-wait --only-supervised --text --url "$DAEMON_URL" || code=$?
  case "$code" in
    0) ;;
    3) systemctl_user start gnomeolad.service ;; # nothing answers: start it
    6)
      if "$NODE" "${APP}/packages/cli/src/main.ts" daemon idle --url "$DAEMON_URL" >/dev/null 2>&1; then
        say "restarting the (older) daemon: it is idle"
        systemctl_user restart gnomeolad.service
      else
        say "the running daemon is recording and predates deferred restarts: restart it after the meeting with"
        say "  systemctl --user restart gnomeolad"
      fi
      ;;
    *) say "warning: could not ask the daemon to restart (exit ${code}); once idle: systemctl --user reload gnomeolad" ;;
  esac
}
restart_daemon

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

say "done. Open 'kacola' from Activities, or run: gnomeola status"
case ":${PATH}:" in *":${BIN}:"*) ;; *) say "note: ${BIN} is not on your PATH" ;; esac
