#!/usr/bin/env bash
# kacola user-level installer (non-Flatpak; the plan's S-2 ships this first).
#
#   scripts/install.sh [--prefix DIR] [--node PATH] [--no-service] [--no-skill] [--no-extension] [--dry-run] [--force]
#   scripts/install.sh --uninstall [--prefix DIR] [--purge]
#
# Installs, per user and without root:
#   $PREFIX/share/kacola/app/          the daemon + CLI runtime (this repo minus dev-only files, with node_modules)
#   $PREFIX/share/kacola/desktop/      the window: the packaged Electron app (scripts/build-desktop.ts)
#   $PREFIX/bin/kacola                 the CLI
#   $PREFIX/bin/kacolad                the daemon launcher
#   $PREFIX/bin/kacola-ui              the window launcher
#   ~/.config/systemd/user/kacolad.service
#   $PREFIX/share/applications/com.kacperlubisz.Kacola.desktop
#   $PREFIX/share/icons/hicolor/*/apps/com.kacperlubisz.Kacola*  the brand icons
#   ~/.claude/skills/meeting-context/    the Claude Code skill (unless --no-skill)
#   ${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions/kacola@kacperlubisz.com/
#                                        the top-bar extension: installed, NEVER enabled (unless --no-extension)
#
# Recordings, the database and models live in ${XDG_DATA_HOME:-~/.local/share}/kacola and are never touched
# by install or a plain uninstall; --purge removes them too.
#
# The window attaches to the systemd daemon (KACOLA_URL, default http://127.0.0.1:8787); with --no-service it
# starts its own bundled daemon instead. KACOLA_DESKTOP_APP_DIR=<linux-unpacked> installs that build instead
# of building one (dist/desktop/linux-unpacked is rebuilt when any package source is newer than it).
#
# A meeting being recorded is never interrupted: if the running daemon (asked at KACOLA_URL) is recording,
# install refuses — exit 3, nothing replaced — unless --force. Afterwards the daemon is asked to restart on the
# new version once nothing is recording (`kacola daemon restart`, at once if idle); it is never restarted
# under a recording.
#
# Upgrading from gnomeola (the name before 0.2): the old install is found by its unit, launchers or app dir.
# The new one is installed beside it first; then, only if the old daemon says it is idle (`daemon idle`,
# asked again right before — a recording refuses with exit 3 even with --force, since the old service has to
# stop rather than restart), the switch: the old window's files, launchers and desktop entry go, the old
# gnomeolad.service is stopped, disabled and removed (its gnomeolad.service.d overrides are copied to
# kacolad.service.d), the old daemon runtime goes, and kacolad starts — and on its first start moves
# ~/.local/share/gnomeola to ~/.local/share/kacola. `gnomeola` stays as a forwarding alias for kacola that
# prints a deprecation note. The old top-bar extension keeps working (the daemon still answers its D-Bus name)
# until the new one is switched on from the window, which retires the old one.
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
    -h|--help) sed -n '2,42p' "$0"; exit 0 ;;
    *) echo "install.sh: unknown option $1" >&2; exit 2 ;;
  esac
done

# Compatibility (one release): GNOMEOLA_* variables from before the rename are read as KACOLA_*, here and in
# everything this starts.
LEGACY_ENV=""
for var in $(compgen -e); do
  case "$var" in
    GNOMEOLA_*)
      new="KACOLA_${var#GNOMEOLA_}"
      if [ -z "${!new+x}" ]; then export "$new=${!var}"; LEGACY_ENV="${LEGACY_ENV} ${var}"; fi
      ;;
  esac
done
[ -z "$LEGACY_ENV" ] || echo "kacola: deprecated:${LEGACY_ENV} — rename to KACOLA_* (the old names are read for one more release)" >&2

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP="${PREFIX}/share/kacola/app"
DESKTOP_APP="${PREFIX}/share/kacola/desktop"
BIN="${PREFIX}/bin"
ICONS="${PREFIX}/share/icons/hicolor"
APP_ID="com.kacperlubisz.Kacola"
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
DESKTOP_DIR="${PREFIX}/share/applications"
DATA="${XDG_DATA_HOME:-${HOME}/.local/share}/kacola"
SKILLS="${HOME}/.claude/skills"
EXT_ROOT="${XDG_DATA_HOME:-${HOME}/.local/share}/gnome-shell/extensions"
EXT_UUID="kacola@kacperlubisz.com"
EXT_DIR="${EXT_ROOT}/${EXT_UUID}"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/autostart"
DAEMON_URL="${KACOLA_URL:-http://127.0.0.1:8787}"

# The gnomeola install this one replaces (compatibility, one release): same layout under the old names.
LEGACY_SHARE="${PREFIX}/share/gnomeola"
LEGACY_APP="${LEGACY_SHARE}/app"
LEGACY_DESKTOP_APP="${LEGACY_SHARE}/desktop"
LEGACY_APP_ID="org.gnome.Gnomeola"
LEGACY_UNIT="gnomeolad.service"
LEGACY_DATA="${XDG_DATA_HOME:-${HOME}/.local/share}/gnomeola"
LEGACY_EXT_DIR="${EXT_ROOT}/gnomeola@gnomeola.org"
LEGACY=0
if [ -e "${UNIT_DIR}/${LEGACY_UNIT}" ] || [ -e "${BIN}/gnomeolad" ] ||
  { [ ! -L "$LEGACY_SHARE" ] && { [ -d "$LEGACY_APP" ] || [ -d "$LEGACY_DESKTOP_APP" ]; }; }; then
  LEGACY=1
fi

run() { if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi; }
say() { echo "kacola: $*"; }

# KACOLA_INSTALL_NO_SYSTEMCTL=1 (tests): write the unit files but never talk to the running user session — its
# systemd manager, or its GNOME settings.
SESSION=1
[ "${KACOLA_INSTALL_NO_SYSTEMCTL:-0}" = 1 ] && SESSION=0
systemctl_user() {
  # Only touch the user's systemd if there is one.
  [ "$SESSION" = 1 ] || return 0
  if [ "$SERVICE" = 1 ] && command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    run systemctl --user "$@" || true
  fi
}

remove_icons() { # app id
  for icon in "${ICONS}"/*/apps/"$1".png "${ICONS}"/*/apps/"$1".svg "${ICONS}"/*/apps/"$1"-symbolic.svg; do
    [ -e "$icon" ] || continue
    run rm -f "$icon"
    run rmdir "$(dirname "$icon")" "$(dirname "$(dirname "$icon")")" 2>/dev/null || true
  done
}

# The install dirs only: with the default prefix, ${PREFIX}/share/<name> IS the data dir, which holds the
# recordings — never removed here (that is --purge's job).
# A symlink is the migrated data dir's compatibility link (to the kacola dir): left alone.
remove_install_dirs() { # share dir
  [ -L "$1" ] && return 0
  run rm -rf "$1/app" "$1/desktop"
  [ -d "$1" ] && run rmdir "$1" 2>/dev/null || true
}

if [ "$UNINSTALL" = 1 ]; then
  systemctl_user disable --now kacolad.service
  systemctl_user disable --now "$LEGACY_UNIT"
  run rm -f "${UNIT_DIR}/kacolad.service" "${UNIT_DIR}/${LEGACY_UNIT}" \
    "${BIN}/kacola" "${BIN}/kacolad" "${BIN}/kacola-ui" "${BIN}/gnomeolad" "${BIN}/gnomeola-ui" \
    "${DESKTOP_DIR}/${APP_ID}.desktop" "${DESKTOP_DIR}/${LEGACY_APP_ID}.desktop"
  # bin/gnomeola: the forwarding alias, or an old install's launcher
  if [ -f "${BIN}/gnomeola" ] && grep -qE '^# kacola-legacy-alias|share/gnomeola/app/' "${BIN}/gnomeola"; then run rm -f "${BIN}/gnomeola"; fi
  remove_install_dirs "${PREFIX}/share/kacola"
  remove_install_dirs "$LEGACY_SHARE"
  remove_icons "$APP_ID"
  remove_icons "$LEGACY_APP_ID"
  run rmdir "$ICONS" "$(dirname "$ICONS")" 2>/dev/null || true
  # what the installed window wrote itself: its autostart entry (Preferences) and its CLI shim (first run),
  # each only when it is ours (the window's marker) and points into this install
  AUTOSTART="${AUTOSTART_DIR}/${APP_ID}.desktop"
  if [ -f "$AUTOSTART" ] && grep -q '^X-Kacola-Autostart=1' "$AUTOSTART" && grep -qF "$DESKTOP_APP/" "$AUTOSTART"; then run rm -f "$AUTOSTART"; fi
  AUTOSTART="${AUTOSTART_DIR}/${LEGACY_APP_ID}.desktop"
  if [ -f "$AUTOSTART" ] && grep -q '^X-Gnomeola-Autostart=1' "$AUTOSTART" && grep -qF "$LEGACY_DESKTOP_APP/" "$AUTOSTART"; then run rm -f "$AUTOSTART"; fi
  SHIM="${HOME}/.local/bin/kacola"
  if [ -f "$SHIM" ] && grep -q '^# kacola-cli-shim' "$SHIM" && grep -qF "$DESKTOP_APP/" "$SHIM"; then run rm -f "$SHIM"; fi
  SHIM="${HOME}/.local/bin/gnomeola"
  if [ -f "$SHIM" ] && grep -qE '^# (gnomeola-cli-shim|kacola-legacy-alias)' "$SHIM"; then run rm -f "$SHIM"; fi
  if [ -f "${SKILLS}/meeting-context/.kacola-installed" ] || [ -f "${SKILLS}/meeting-context/.gnomeola-installed" ]; then
    run rm -rf "${SKILLS}/meeting-context"
  fi
  run rm -rf "$EXT_DIR" "$LEGACY_EXT_DIR"
  systemctl_user daemon-reload
  if [ "$PURGE" = 1 ]; then
    run rm -rf "$DATA"
    # the pre-rename data dir: removed too when it holds data, or just the compatibility link
    if [ -L "$LEGACY_DATA" ]; then run rm -f "$LEGACY_DATA"; elif [ -d "$LEGACY_DATA" ]; then run rm -rf "$LEGACY_DATA"; fi
    say "removed recordings and models in $DATA"
  else
    say "kept your recordings in $DATA (use --purge to remove)"
  fi
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

# Is a meeting being recorded right now? Asked of the running daemon itself (`kacola daemon idle`, with this
# checkout's CLI: it understands older daemons too) — never inferred. Exit 0 idle or no daemon, 5 recording.
daemon_cli() { "$NODE" "${SRC}/packages/cli/src/main.ts" "$@" --url "$DAEMON_URL"; }
set +e
BUSY="$(daemon_cli daemon idle --text 2>&1)"
IDLE_CODE=$?
set -e
if [ "$IDLE_CODE" != 0 ]; then
  if [ "$IDLE_CODE" = 5 ]; then
    WHY="the kacola daemon at ${DAEMON_URL} is ${BUSY#kacola: }"
  else
    WHY="could not tell whether the kacola daemon at ${DAEMON_URL} is recording (${BUSY})"
  fi
  if [ "$LEGACY" = 1 ] && [ "$SERVICE" = 1 ]; then
    # switching from gnomeola stops the old service (a restart cannot carry it over), so it must be idle
    echo "install.sh: refusing to install: ${WHY}." >&2
    echo "install.sh: this install switches over from gnomeola, which stops the old daemon's service; that waits" >&2
    echo "install.sh: for no meeting (--force does not apply). Run this again when the meeting has ended." >&2
    exit 3
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
[ "$LEGACY" = 1 ] && say "found a gnomeola install: kacola replaces it (your recordings move over on the daemon's first start)"

# ---- build ------------------------------------------------------------------------------------------
# The window is the packaged Electron app (electron-builder `dir`, executable `kacola`, the daemon/CLI runtime
# bundled for when no daemon answers). Built from source unless a current build exists: any package source,
# brand asset or extension file newer than its app.asar means stale.
LINUX_APP="${KACOLA_DESKTOP_APP_DIR:-${SRC}/dist/desktop/linux-unpacked}"
stale_app() {
  [ -f "${LINUX_APP}/resources/app.asar" ] || return 0
  [ -n "$(find "${SRC}/packages" "${SRC}/brand" "${SRC}/extensions" \
    \( -name node_modules -o -name out -o -name dist -o -name test -o -name __artifacts__ \) -prune \
    -o -type f -newer "${LINUX_APP}/resources/app.asar" -print -quit)" ]
}
if [ "${KACOLA_INSTALL_NO_BUILD:-0}" != 1 ] && [ -z "${KACOLA_DESKTOP_APP_DIR:-}" ] && stale_app; then
  say "building the desktop app (node scripts/build-desktop.ts)"
  if [ "$DRY" = 1 ]; then echo "+ node scripts/build-desktop.ts"; else (cd "$SRC" && PATH="$(dirname "$NODE"):$PATH" "$NODE" scripts/build-desktop.ts >/dev/null); fi
fi
[ "$DRY" = 1 ] || [ -x "${LINUX_APP}/kacola" ] || { echo "install.sh: desktop app missing at ${LINUX_APP} (node scripts/build-desktop.ts)" >&2; exit 1; }

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
# the brand icons under the app id (hicolor/<size>/apps/app.png → com.kacperlubisz.Kacola.png, app-symbolic.svg →
# com.kacperlubisz.Kacola-symbolic.svg)
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

write "${BIN}/kacola" 755 <<SH
#!/bin/sh
exec "${NODE}" "${APP}/packages/cli/src/main.ts" "\$@"
SH
write "${BIN}/kacolad" 755 <<SH
#!/bin/sh
exec "${NODE}" "${APP}/packages/daemon/src/main.ts" "\$@"
SH
write "${BIN}/kacola-ui" 755 <<SH
#!/bin/sh
exec "${DESKTOP_APP}/kacola" "\$@"
SH

# `gnomeola` keeps working for one release (habits, scripts, a Claude permission rule for Bash(gnomeola:*)),
# forwarding to kacola with a one-line note on stderr. Written where the old launcher was, and over the old
# window's own ~/.local/bin/gnomeola shim, whose app is going.
legacy_alias() { # path
  write "$1" 755 <<SH
#!/bin/sh
# kacola-legacy-alias — gnomeola was renamed kacola; this forwards for one release. install.sh --uninstall removes it.
echo "gnomeola is now kacola: run 'kacola' instead (this alias goes in a later release)" >&2
exec "${BIN}/kacola" "\$@"
SH
}
legacy_alias "${BIN}/gnomeola"
OLD_SHIM="${HOME}/.local/bin/gnomeola"
if [ "$OLD_SHIM" != "${BIN}/gnomeola" ] && [ -f "$OLD_SHIM" ] && grep -q '^# gnomeola-cli-shim' "$OLD_SHIM"; then
  legacy_alias "$OLD_SHIM"
fi

# StartupWMClass is the Wayland app id Electron gives the window (package.json desktopName without .desktop;
# install.e2e checks it).
write "${DESKTOP_DIR}/${APP_ID}.desktop" 644 <<DESKTOP
[Desktop Entry]
Type=Application
Name=kacola
Comment=Record, transcribe and search your meetings
Exec=${BIN}/kacola-ui %U
Icon=${APP_ID}
Terminal=false
Categories=Office;AudioVideo;Audio;Recorder;
Keywords=meeting;transcript;notes;record;granola;kacola;
StartupNotify=true
StartupWMClass=${APP_ID}
X-GNOME-UsesNotifications=true
Actions=background;

[Desktop Action background]
Name=Start in the Background
Exec=${BIN}/kacola-ui --background
DESKTOP

# ---- service ----------------------------------------------------------------------------------------
if [ "$SERVICE" = 1 ]; then
  run mkdir -p "$UNIT_DIR"
  write "${UNIT_DIR}/kacolad.service" 644 <<UNIT
[Unit]
Description=kacola meeting recorder daemon
After=pipewire.service wireplumber.service
Wants=pipewire.service

[Service]
Type=simple
ExecStart=${BIN}/kacolad
# reload = restart once nothing is recording (SIGHUP); the daemon then exits 76, which is a restart, not a failure
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=2
RestartForceExitStatus=76
SuccessExitStatus=76
# 78: both the gnomeola and the kacola data dir hold data; starting again cannot help until one is moved aside
RestartPreventExitStatus=78
# stop/restart suspends a live recording (the next daemon resumes it) within a few seconds; never hold up a logout.
# SIGTERM goes to the daemon only: it stops its own capture children in order, flushing the audio first.
TimeoutStopSec=15
KillMode=mixed
# The daemon binds loopback only (and refuses anything else); no network exposure to configure.

[Install]
WantedBy=default.target
UNIT
  # the user's overrides for the old unit (Environment=…: GNOMEOLA_* names are still read for one release)
  if [ -d "${UNIT_DIR}/${LEGACY_UNIT}.d" ] && [ ! -e "${UNIT_DIR}/kacolad.service.d" ]; then
    run cp -a "${UNIT_DIR}/${LEGACY_UNIT}.d" "${UNIT_DIR}/kacolad.service.d"
    say "copied your ${LEGACY_UNIT}.d overrides to kacolad.service.d"
  fi
  systemctl_user daemon-reload
  systemctl_user enable kacolad.service
fi

# ---- switching over from gnomeola -----------------------------------------------------------------------
# Only once the old daemon says it is idle, asked again right now (the preflight was a while ago).
daemon_answers() { "$NODE" "${APP}/packages/cli/src/main.ts" status --url "$DAEMON_URL" >/dev/null 2>&1; }
OLD_STILL_UP=0
switch_from_gnomeola() {
  [ "$LEGACY" = 1 ] || return 0
  if [ "$DRY" != 1 ]; then
    local busy code=0
    busy="$("$NODE" "${APP}/packages/cli/src/main.ts" daemon idle --text --url "$DAEMON_URL" 2>&1)" || code=$?
    if [ "$code" != 0 ]; then
      echo "install.sh: kacola is installed, but the gnomeola daemon at ${DAEMON_URL} is ${busy#kacola: } now." >&2
      echo "install.sh: nothing of the gnomeola install was stopped or removed; run this again once the meeting" >&2
      echo "install.sh: has ended to switch over." >&2
      exit 3
    fi
  fi
  # the old window's files first, so it cannot start a daemon of its own once the old service has stopped
  [ -L "$LEGACY_SHARE" ] || run rm -rf "$LEGACY_DESKTOP_APP"
  run rm -f "${BIN}/gnomeolad" "${BIN}/gnomeola-ui" "${DESKTOP_DIR}/${LEGACY_APP_ID}.desktop"
  remove_icons "$LEGACY_APP_ID"
  if [ "$SERVICE" = 1 ]; then
    systemctl_user disable --now "$LEGACY_UNIT"
    run rm -f "${UNIT_DIR}/${LEGACY_UNIT}"
    systemctl_user daemon-reload
    if [ "$SESSION" = 1 ] && [ "$DRY" != 1 ]; then
      # it was idle: SIGTERM ends it within seconds; wait for it to let go of the port and the data dir
      for _ in $(seq 1 40); do daemon_answers || break; sleep 0.5; done
      if daemon_answers; then OLD_STILL_UP=1; fi
    fi
  fi
  remove_install_dirs "$LEGACY_SHARE"
  # the old window's autostart entry starts a binary that is gone: point it at the new one
  local old_auto="${AUTOSTART_DIR}/${LEGACY_APP_ID}.desktop" new_auto="${AUTOSTART_DIR}/${APP_ID}.desktop"
  if [ -f "$old_auto" ] && grep -q '^X-Gnomeola-Autostart=1' "$old_auto"; then
    if [ ! -e "$new_auto" ]; then
      write "$new_auto" 644 <<AUTOSTART
[Desktop Entry]
Type=Application
Name=kacola
Comment=Record, transcribe and search your meetings (in the background)
Exec=${DESKTOP_APP}/kacola --background
Icon=${APP_ID}
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
X-Kacola-Autostart=1
AUTOSTART
    fi
    run rm -f "$old_auto"
  fi
  say "switched over from gnomeola: its service, window and launchers are gone ('gnomeola' still works, as an alias)"
}
switch_from_gnomeola

# The running daemon moves to the new version by restarting once nothing is recording — asked of the daemon at
# the moment of the restart, never decided here (`kacola daemon restart`, the newly installed CLI). A daemon
# from before deferred restarts is asked whether it is idle right now, and restarted only if so.
restart_daemon() {
  [ "$SERVICE" = 1 ] || return 0
  if [ "$DRY" = 1 ]; then echo "+ kacola daemon restart --no-wait --only-supervised (once idle)"; return 0; fi
  if [ "$OLD_STILL_UP" = 1 ]; then
    say "warning: a gnomeola daemon still answers at ${DAEMON_URL} although its service has stopped — probably"
    say "  the old window's own. Quit the old kacola window, then: systemctl --user start kacolad"
    return 0
  fi
  local code=0
  "$NODE" "${APP}/packages/cli/src/main.ts" daemon restart --no-wait --only-supervised --text --url "$DAEMON_URL" || code=$?
  case "$code" in
    0) ;;
    3) systemctl_user start kacolad.service ;; # nothing answers: start it
    6)
      if "$NODE" "${APP}/packages/cli/src/main.ts" daemon idle --url "$DAEMON_URL" >/dev/null 2>&1; then
        say "restarting the (older) daemon: it is idle"
        systemctl_user restart kacolad.service
      else
        say "the running daemon is recording and predates deferred restarts: restart it after the meeting with"
        say "  systemctl --user restart kacolad"
      fi
      ;;
    *) say "warning: could not ask the daemon to restart (exit ${code}); once idle: systemctl --user reload kacolad" ;;
  esac
  # the first kacolad after a switch moves the gnomeola data dir: say how it went
  if [ "$LEGACY" = 1 ] && [ "$SESSION" = 1 ]; then
    for _ in $(seq 1 60); do daemon_answers && break; sleep 0.5; done
    if daemon_answers; then
      say "kacolad is running; your recordings are in ${DATA}"
    else
      say "warning: kacolad did not come up; see: journalctl --user -u kacolad -n 50"
    fi
  fi
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
  # The gnomeola extension (before the rename) keeps the top bar until the new one is switched on — the
  # daemon still answers its D-Bus name — and is retired by the window's one-click setup when it is. Once the
  # new one is on, a leftover copy goes here.
  if [ -d "$LEGACY_EXT_DIR" ]; then
    if [ "$SESSION" = 1 ] && command -v gsettings >/dev/null &&
      gsettings get org.gnome.shell enabled-extensions 2>/dev/null | grep -qF "'${EXT_UUID}'"; then
      run rm -rf "$LEGACY_EXT_DIR"
      say "removed the old top-bar extension (gnomeola@gnomeola.org); the new one is on"
    else
      say "the old top-bar extension (gnomeola@gnomeola.org) keeps working for now. Switch the new one on in kacola"
      say "  (the card on the home screen, or Preferences › Integration), then log out and back in: that retires the old one"
    fi
  fi
fi

# ---- skill ------------------------------------------------------------------------------------------
if [ "$SKILL" = 1 ]; then
  if [ "$DRY" = 1 ]; then echo "+ ${BIN}/kacola skill install"; else "${BIN}/kacola" skill install --text || true; fi
fi

say "done. Open 'kacola' from Activities, or run: kacola status"
case ":${PATH}:" in *":${BIN}:"*) ;; *) say "note: ${BIN} is not on your PATH" ;; esac
