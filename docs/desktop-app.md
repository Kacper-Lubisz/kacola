# The Electron window (packages/desktop)

The window is Electron. It replaced the GTK 4 / libadwaita app (`packages/ui`, GTKX), which was deleted
at the cut-over (E-12) once every behaviour of its suites was asserted here (the checklist at the end).
This page is the contract for everyone building screens in `packages/desktop`.

```
packages/ui-core/          the data layer, DOM-free, Node-free (moved from the GTK app's src/data)
  src/{sessions,transcript,qa,notes,speakers,settings,format}.ts   pure folds, feeds + view logic
  src/hooks.ts                                                     useNow()
  src/i18n.ts                                                      _(), ngettext(), fmt()
  import as '@gnomeola/ui-core/<file>' (subpath exports, no barrel)

packages/desktop/
  electron.vite.config.ts   main (ESM) · preload (sandboxed CJS) · renderer (React SPA)
  fuses.config.ts           Electron fuses for packaged builds (applyFuses(binary))
  src/shared/               types + constants shared by all three processes (no runtime imports)
    bridge.ts               IPC channel names, the window.gnomeola API type, TUNNEL_ORIGIN
    tunnel-port.ts          the preload half of the fetch tunnel (runtime-free)
  src/main/                 Node + electron
    index.ts                single instance, --background, app:// protocol, IPC, window, quit
    security.ts             window options, CSP, navigation/permission decisions (pure, unit-tested)
    tunnel.ts               fetch tunnel: route check, header allow-list, token, streamed frames
    supervisor.ts           DaemonSupervisor: attach / spawn / restart with backoff
    config.ts theme.ts resources.ts   env + token, portal theme, ui-state / notices / catalogues
    integration.ts          "Install command-line tool and Claude skill" (runs `gnomeola install-cli --json`)
    extension.ts            "Install top-bar extension" (a copy into the user's extensions dir, never enabled)
    autostart.ts tray.ts    background mode: autostart entry / Background portal; the macOS Tray menu model
    capture.ts              in-app capture: CaptureController (daemon's waiting list → capture window → ingest)
    deep-link.ts            kacola:// links: argv parsing, scheme registration rule, DeepLinkQueue (pure)
  src/preload/index.ts      contextBridge.exposeInMainWorld('gnomeola', …) — one function per capability
  src/preload/capture.ts    the capture window's bridge only (start/stop in, frames and state out)
  src/renderer/capture.html + capture/   the hidden capture window: getUserMedia / getDisplayMedia, AudioWorklet
  src/renderer/             React 19, no Node, no network
    main.tsx                boot: theme + catalogue from main, client, QueryClient, EventBridge, router
    styles.css              Tailwind v4: brand/tokens (fonts, --k-* tokens, @theme) + semantic aliases
    design/tokens.css       semantic (libadwaita-named) variables mapped onto the kacola brand tokens
    design/primitives/      the brand primitives (index.ts lists them; every state on #/gallery)
    design/icon.tsx         the Lucide icon registry (ISC): <Icon name="mic" />
    routes/                 router.tsx (the tree), main-layout.tsx (the shell), gallery.tsx
    data/                   client, queries, keys, event-bridge, ephemeral (Zustand), mutations, streams
    features/shell/         dialogs context, keyboard shortcuts (+ help dialog)
    features/sessions/      sidebar, record flow (recorder.ts), session page + tabs, Details
    features/{transcript,ask,notes}/   the session page's panes (PaneProps, features/sessions/pane.ts)
    features/preferences/   Preferences, settings mutations, CLI / extension install rows
    features/onboarding/    first run: models, capture, calendar, CLI + skill
    features/about/         About (Granola credit, licence, notices)
  test/                     unit + jsdom component tests (vitest `unit` project)
  translations/             gnomeola.pot + LINGUAS (scripts/i18n-pot.ts; see "Translations")
packages/testkit/src/desktop/   Playwright-for-Electron harness + footprint probes
packages/e2e/test/desktop-*.{int,e2e}.test.ts   tunnel/supervisor against the real daemon; window e2e
```

Scripts: `pnpm --filter @gnomeola/desktop dev` (HMR; the renderer is served by Vite), `build` (to `out/`),
`start` (preview the build). `pnpm check` typechecks (`tsconfig.json` = main/preload/tests,
`tsconfig.web.json` = renderer), lints and unit-tests the package.

## Process model

- **Main supervises the daemon** (`supervisor.ts`). If `GNOMEOLA_URL` (default `http://127.0.0.1:8787`)
  answers `/health` it attaches (systemd install, a remote host). Otherwise, for a loopback URL only, it
  spawns the daemon entry on Electron's own runtime (`ELECTRON_RUN_AS_NODE=1 electron <entry> --host
  --port …`) and waits for `/health`; a crash restarts it with backoff (1 s doubling to 30 s, reset
  after 60 s up); if something else takes the port meanwhile it attaches instead. A remote URL that does
  not answer is reported unreachable and polled, never replaced by a local daemon.
- **Entry**: `GNOMEOLA_DAEMON_ENTRY`, else `resources/runtime/daemon.mjs` (packaged), else
  `packages/daemon/dist/daemon.mjs`, else `packages/daemon/src/main.ts` (dev; Electron 44's Node 24.21
  strips types). `GNOMEOLA_DAEMON_ARGS` (JSON array) adds arguments (tests pass `--data-dir`).
- **Window close keeps running** (main + daemon). Quit is explicit (Ctrl+Q, `app.quit()`, SIGTERM, the
  macOS Tray's Quit) and stops the daemon we spawned — never one we attached to.
  `app.requestSingleInstanceLock()`: a second launch re-opens the first instance's window.
  `--background` starts with no window (the CLI's shim, autostart). See "Background mode".
- The daemon's status is on the bridge (`gnomeola.daemonStatus()` / `onDaemonStatus`) and on main's
  stdout as `{"event":"daemon","kind":…}` lines.

## Security baseline

All of it is data or pure functions in `src/main/security.ts` + `fuses.config.ts`, held by
`test/security.test.ts`; `index.ts` only wires them.

- `contextIsolation`, `sandbox`, no `nodeIntegration` (also not in workers/subframes), `webSecurity`, no
  `webviewTag`, no insecure content, no drag-drop navigation.
- Content from `app://gnomeola/` (a privileged standard scheme), not `file://`; path traversal refused.
- CSP (response header): `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  font-src 'self'; connect-src 'none'; …` — no eval, no inline anything, **no network**. Consequences:
  React Aria's injected pressable `<style>` is pre-empted (`index.html` + `styles.css`), Zod runs
  `jitless` (`renderer/zod-config.ts`), inline `style={{}}` props are fine (CSSOM), `<style>` tags are
  not. The dev server gets a relaxed CSP (inline for React Refresh, the HMR socket) and still no eval.
- `will-navigate` / `will-redirect` deny everything outside our origin; `window.open` is denied and a
  validated http(s) URL goes to `shell.openExternal`.
- Permission requests are all denied, except `media` with audio only (and `display-capture`, whose
  video the page drops) for the window registered as the capture window. IPC handlers reject senders
  that are not our origin; the capture channels accept only the capture window.
- A packaged build exits at start if given `--remote-debugging-port` / `--remote-debugging-pipe` unless
  `GNOMEOLA_ALLOW_REMOTE_DEBUGGING=1` (the packaged e2e drives the window over CDP that way; the fuses
  keep `--inspect` off, so Playwright's `_electron` cannot attach to a packaged build).
- Fuses: RunAsNode **on** (one runtime runs the daemon and the CLI), NODE_OPTIONS and `--inspect` off,
  ASAR integrity + only-load-from-ASAR on, cookie encryption on, file:// privileges off; every fuse
  set explicitly (`strictlyRequireAllFuses`).

## In-app capture (macOS; Linux opt-in)

When the daemon records with the `external` capture backend (`/health` → `capture.backend`; the
default on macOS, `GNOMEOLA_CAPTURE=external` on Linux), it cannot reach the sound server itself and
lists each recording that waits for audio at `GET /capture/external`. Main makes that list true
(`src/main/capture.ts`, `CaptureController`):

- **When**: on every `session.upserted` / `session.deleted` from main's own event subscription, and a
  2 s tick. So a recording started anywhere — the window's Record button, the CLI, the top bar, the
  Tray, auto-record — is captured.
- **Capture window**: hidden, sandboxed, never throttled, `preload/capture.ts` only; the only webContents
  granted audio. `mic` = `getUserMedia` (echo cancellation / noise suppression / AGC off); `system` =
  `getDisplayMedia` answered by main's display-media handler with `audio: 'loopback'` (macOS 13+; the
  screen track is stopped at once). A 16 kHz `AudioContext` makes Chromium resample; the AudioWorklet
  (`capture/pcm-worklet.ts` over `shared/pcm-framer.ts`) cuts 40 ms s16 frames and posts them to main.
- **Streaming**: one `ingestPcm` per track (protocol `capture.ts`: rotation every 60 s). Main numbers the
  frames: one epoch per capture run, sample index within it. A failed request is retried with backoff
  and resends the last 10 s of the current epoch (the daemon drops what it has). A capture error
  (device gone, permission refused) ends the run; the next reconcile after 5 s opens a new one (new
  epoch). The daemon ending a stream (`stopped` / `superseded`) or no longer listing the recording stops
  it. Pause needs nothing: the daemon discards audio while paused. Levels in the window come from the
  daemon's `audio.level` events, as with PipeWire.
- **Linux**: Chromium has no loopback `getDisplayMedia`, so only the mic is captured
  (`GNOMEOLA_CAPTURE_TRACKS` overrides); the system track waits unfed and is recorded as a gap. PipeWire
  capture in the daemon stays the Linux default.
- **Tested** by `packages/e2e/test/desktop-capture.e2e.test.ts`: Chromium's fake device plays the
  standup-2p mic track (`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>%noloop`)
  into a recording started with the Record button; real models; mic WER within the committed baseline
  (12.0 % vs 12 % ± 5), every mic segment `me`, levels on the Microphone meter. The system-track ingest
  is the daemon-level `external-capture.e2e.test.ts`'s subject.

## Background mode

Closing the window never stops main or the daemon. To also start that way at login: Preferences →
Desktop Integration → "Start in the background at login" (`src/main/autostart.ts`):

- **Flatpak**: the Background portal (`RequestBackground`, `autostart` + `commandline: gnomeola-app
  --background`) writes the host's autostart entry; the choice is remembered in
  `$XDG_CONFIG_HOME/gnomeola/autostart.json` (the sandbox cannot see the entry). The first window close
  also asks the portal (without autostart), so GNOME lists the app under Background Apps.
- **Linux**: `$XDG_CONFIG_HOME/autostart/org.gnome.Gnomeola.desktop`, `Exec=<this binary> --background`
  (only an entry carrying our `X-Gnomeola-Autostart=1` is ever removed).
- **macOS**: a login item with `--background`, and the menu-bar **Tray** (`src/main/tray.ts`, a pure menu
  model: status line, Record — or Pause/Resume + Stop —, Open, Quit; private meetings stay "Private
  meeting"). The Dock icon re-opens the window.

## Desktop integration installs

- **CLI + skill** (`integration.ts`): the bundled `gnomeola install-cli --json`. Packaged Linux (outside
  Flatpak) passes `--launch '<binary>' --background`, so the shim starts this app when the daemon is
  down. In the Flatpak the CLI detects `FLATPAK_ID` and writes the host shim (`flatpak run
  --command=gnomeola org.gnome.Gnomeola`) through `--filesystem=~/.local/bin:create`. macOS: when
  `/usr/local/bin` needs an administrator, one `osascript … with administrator privileges` prompt installs
  the shim there and the `~/.local/bin` fallback is removed; declining keeps the fallback. Uninstall
  reports admin-only removals (`needsAdmin`) and removes them with one prompt.
- **Top-bar extension** (`extension.ts`): copies `resources/extension/gnomeola@gnomeola.org` (schema
  compiled at build time; the checkout's `extensions/` in dev, compiled at install) to
  `${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions/` — in the Flatpak the host's
  (`HOST_XDG_DATA_HOME`, else `~/.local/share`, via `--filesystem=xdg-data/gnome-shell/extensions:create`).
  Never enabled: that stays the user's call, and on Wayland the Shell sees it after the next login.

## Deep links

`kacola://agenda/<id>` and `kacola://meeting/<uid>[?start=<iso>]` (docs/agendas.md, "Deep links") open the
app (`src/main/deep-link.ts`, pure and unit-tested; wired in `index.ts`):

- **Registered**: macOS — `CFBundleURLTypes` in Info.plist (electron-builder `protocols` in
  `packaging/macos/electron-builder.yml`) and `app.setAsDefaultProtocolClient('kacola')` when packaged.
  Flatpak — `MimeType=x-scheme-handler/kacola;` + `Exec=gnomeola-app %U` in
  `packaging/flatpak/org.gnome.Gnomeola.desktop` (the wrapper forwards `"$@"`). `build-desktop.ts` passes
  the same `protocols`, so any desktop entry electron-builder writes carries the MimeType (the `dir`
  target writes none). Packaged Linux never calls `setAsDefaultProtocolClient`: the desktop file is the
  registration. Dev (unpackaged) registers Electron + the main script on macOS (unless
  `GNOMEOLA_REGISTER_SCHEME=0`) and on Linux **only** with `GNOMEOLA_REGISTER_SCHEME=1` — there it runs
  `xdg-settings` and changes the user's real default handler, which tests and CI must never do.
- **Arrival**: the first argv entry that `parseKacolaLink` accepts (≤ 4000 chars, any case of the
  scheme; anything else is ignored) on a cold start; a second launch's argv via `'second-instance'` (a
  link shows the window even with `--background`); macOS `'open-url'`, registered before ready. Links are
  normalised to the canonical `formatAgendaLink` / `formatMeetingLink` form — the renderer never sees
  anything else.
- **Handshake**: `DeepLinkQueue` holds one pending link (a newer one replaces it; the same link twice
  within 1 s counts once). The renderer subscribes with `gnomeola.onDeepLink(cb)` and then calls
  `gnomeola.takeDeepLink()` (`IPC.deepLinkTake`, trusted senders only), which returns and clears the
  pending link and marks that webContents ready. Only a ready window gets links pushed
  (`IPC.deepLink`); a reload (main-frame navigation) or a new window must take again, so a link is never
  pushed before anyone listens.
- **Logs** (main's stdout): `{"event":"deep-link","url":…}` when a link is accepted,
  `{"event":"deep-link-delivered","url":…}` when the renderer has it (take or push). Tests:
  `test/deep-link.test.ts`, `desktop-deeplink.e2e` (cold argv, a second instance —
  `launchSecondInstance()` in the testkit —, invalid arguments, a closed window re-opened by a link).

## Packaging

```sh
node scripts/build-desktop.ts   # dist/desktop/linux-unpacked (electron-builder dir), ~326 MiB
node scripts/build-flatpak.ts   # dist/flatpak: repo/ + gnomeola.flatpak (builds the above first)
node scripts/build-macos.ts     # dist/macos/out/gnomeola-<v>-mac-{arm64,x64}.zip (unsigned)
```

- `build-desktop.ts` stages `package.json` (no dependencies: main, preload and renderer are complete
  bundles — zod is bundled into main too) + `packages/desktop/out`, and runs electron-builder with
  `executableName: gnomeola`, app id `org.gnome.Gnomeola`, the brand icons, the installed Electron as
  `electronDist`, and extraResources `runtime/` (`scripts/build-runtime.ts`: daemon.mjs, cli.mjs,
  natives), `icon.png`, `THIRD_PARTY_NOTICES.md`, `extension/`. afterPack copies the runtime's
  `node_modules` (electron-builder drops them from extraResources) and flips the fuses from
  `fuses.config.ts`. The macOS build stages the same app (+ tray icons, `brand/icons/kacola.icns`).
- The Flatpak installs `linux-unpacked` as `/app/main` and the brand hicolor icons renamed to the app id;
  `gnomeola-app` runs it through `zypak-wrapper` (Chromium's renderer sandboxes are spawned through the
  Flatpak portal).
- macOS from Linux: no code signing (no `codesign` / notarisation off a Mac). Flipping fuses changes the
  Electron framework binary after Electron's own ad-hoc signature was made, and Apple silicon refuses
  arm64 code without a valid signature — so expect the arm64 zip to need `codesign --force --deep -s -
  gnomeola.app` (or a real identity) on a Mac before it runs. Not verified: nothing here can run a
  Mach-O; the zips are inspected (`macos-zip.e2e`) and need a Mac-side signing step until CI has a Mac.
- Tests: `desktop-packaged.e2e` (the Linux app, windowed over CDP), `flatpak.e2e` (headless + windowed
  under zypak), `macos-zip.e2e` (Mach-O natives, Info.plist usage strings, fuses, shims).

## Fetch tunnel

The renderer's protocol client is the ordinary `createClient` with `baseUrl: TUNNEL_ORIGIN` and a
`fetch` from `data/tunnel-fetch.ts`. A request becomes a `TunnelRequest` sent with a `MessagePort` over
`ipcRenderer.postMessage`; main (`tunnel.ts`) checks method + path against the protocol route table
(403 otherwise, without touching the network), keeps only `accept` / `content-type` / `last-event-id`,
adds `Authorization: Bearer <token>` (GNOMEOLA_TOKEN or `~/.config/gnomeola/hosts.json`), fetches with
`redirect: 'error'`, and streams `head` / `chunk` / `end` / `error` frames back. The renderer sees a
real `Response` with a streaming body, so SSE, `ask` and enhance work unchanged; aborting cancels in
main. Node sends no `Origin`, so the daemon's CSRF / DNS-rebinding guard is untouched. The token never
enters the renderer (asserted by `packages/e2e/test/desktop-tunnel.int.test.ts` against a daemon with
pairing auth on).

## Files and clipboard

The renderer has no file system: `gnomeola.copyText(text)` and `gnomeola.saveTextFile({ title,
defaultName, text })` go to main (`src/main/files.ts`: size-checked text, the suggested name reduced to
one path component, `dialog.showSaveDialog` starting in Documents, then the write). An e2e stands in for
the native dialog by replacing `dialog.showSaveDialog` through `app.evaluateMain` (it is looked up per
call) and reads the clipboard back with `clipboard.readText()`.

## Data flow (renderer)

- **Server state = React Query**, keyed by `data/keys.ts` (`['sessions']`, `['session', id]`,
  `['transcript', id]`, `['qa', id]`, `['speakers', id]`, `['notes', id]`, `['settings']`, …). Query
  definitions live in `data/queries.ts` (`createQueries(api)` → `queries.transcript(id)` …); folded
  resources hold ui-core states (`SessionsState`, `TranscriptState`, …) and use
  `structuralSharing: false` + `staleTime: Infinity`.
- **One EventBridge** (`data/event-bridge.ts`) owns the single `client.subscribe()`: snapshot (cursor
  first, then the list), durable events folded into every cached query they concern with ui-core's
  folds (idempotent, revision-checked; duplicates and replays dropped by seq), recent events re-folded
  into queries that finished fetching late, `session.deleted` removes all of that session's queries, a
  gap or a daemon whose cursor went backwards → invalidate everything and resnapshot. Its connection
  state drives `onlineManager` (queries/mutations pause while the stream is down).
- **Ephemeral state = Zustand** (`data/ephemeral.ts`): connection, audio levels, transcript partials,
  streaming tokens, model progress, `meeting.starting`. Never written back to the daemon.
- **Mutations** use `optimistic(qc, vars => [{ key, update }])` (`data/mutations.ts`): the optimistic
  value shows at once; the daemon's durable echo replaces it (the response is not written — it may be
  older than an event); on error the old value comes back only if nobody wrote the key meanwhile, else
  the key is refetched. `renameSessionMutation` is the reference.
- **Streams** (`data/streams.ts`): `runAsk` / `runEnhance` fold tokens into `streams[localId]`;
  `useStream(store, run)` wraps them for components. The final message arrives via the bridge.

## Theme and brand

The look is the **kacola** brand (`brand/README.md`, spec in the lead's brand-spec): oat palette, Bricolage
Grotesque headings and buttons, Instrument Sans text, Fraunces italic for editorial moments (empty
states), JetBrains Mono for times and shortcuts, Lucide icons. `styles.css` imports `brand/tokens/`
(fonts.css — the woff2 files are bundled by Vite, the CSP allows no network fonts —, tokens.css,
tailwind.css); `design/tokens.css` maps the semantic names (`--window-bg-color`, `--accent-bg-color`,
`--dim-fg-color` …) onto the `--k-*` brand tokens. Tailwind utilities: brand names (`bg-bg-surface`,
`text-text-secondary`, `border-border-default`, `font-display`, `type-title2`, `rounded-lg`,
`shadow-e1`, `record-pulse`) and the semantic aliases (`bg-window`, `text-dim`, `bg-accent`). The
default Tailwind palette is cleared (`design/theme-reset.css`).

Main reads `org.freedesktop.appearance` (`color-scheme`, `contrast`) from the portal with gdbus,
follows changes with `gdbus monitor`, falls back to `nativeTheme`, and pushes a `Theme`; the renderer
sets `<html data-theme data-scheme data-contrast>` — attributes, not `prefers-color-scheme`, which
Chromium on Linux does not reliably map from `nativeTheme.themeSource`. **The accent is fixed** (record
red): the portal's accent colour is ignored. Tests and screenshots: `GNOMEOLA_COLOR_SCHEME=light|dark`,
`GNOMEOLA_CONTRAST=high`.

Deviations forced by the axe gate (4.5:1 for our 13–15px text), all brand tokens now (brand/README.md,
held by `brand/scripts/tokens.test.ts`): filled record-red surfaces that carry white text (the Record
button, a confirming destructive button) use `accent.recordFill` / `recordFillHover` (#C93D22 / #B3341B
light, #D0401F / #C93D22 dark: white text 5.0 / 4.7:1), which `--record-fill-color` maps onto, instead of
accent.record (4.09 / 3.26:1) — dots, rings and the live indicator stay accent.record; status *text* uses
the `status.*Text` tokens; `text.tertiary` is the corrected #70675A / #978C7B (4.5:1 on every
background). No colour in the renderer is a literal: everything is a `--k-*` token or a semantic alias.

The window icon on Linux is `brand/icons/png/512.png` (packaged: `resources/icon.png`). Linux has no
application menu (so Electron's default Ctrl+R / Ctrl+Shift+I accelerators are gone); the window's
shortcuts are `features/shell/shortcuts.tsx` (one table drives the handler and the Ctrl+? help).

## Conventions for phase 2

**Add a route.** In `routes/router.tsx`: `createRoute({ getParentRoute: () => mainRoute, path, loader,
component })`; the loader `await context.queryClient.ensureQueryData(context.queries.x(...))` for what
the screen shows (so navigation waits for data instead of flashing empty); add it to `routeTree`. The
screen itself goes in `features/<area>/`, not in `routes/`. Hash history: links are `#/sessions/$id`.

**Add a query.** Add a key to `data/keys.ts` (resource name first, session id second for per-session
data — `isSessionScoped` relies on it, add the name to `SESSION_SCOPED`), a `queryOptions` to
`createQueries`, and — if events change it — a fold in `EventBridge.foldSession` / `foldDurable`
(prefer a ui-core fold; add one there if missing, with a unit test). A unit test in
`test/event-bridge.test.ts` with the fake daemon (`test/helpers.ts: fakeDaemon`) covering the event
kinds, a duplicate and a gap.

**Add a mutation.** `useMutation(renameSessionMutation(api, qc))`-style factory next to its feature:
`mutationFn` over `api.call(...)`, plus `...optimistic(qc, vars => targets)`. Test optimistic → echo and
optimistic → error as in `test/mutations.test.ts`.

**Add a primitive.** `design/primitives/<name>.tsx`: behaviour from React Aria, looks from Tailwind
utilities over tokens only (the palette is cleared: `bg-blue-500` does not exist), every interactive
element with an accessible name. Export it from `design/primitives/index.ts`, show every state in
`routes/gallery.tsx` (hover / pressed / focus as static aria-hidden copies carrying React Aria's
`data-*` attributes), and screens import from the index — never `react-aria-components` or
`lucide-react` directly. The visual e2e screenshots the gallery (light / dark, 360 / 800 / 1280 and
full height) and runs axe over it in light, dark and high contrast. Icons: import the Lucide icon in
`design/icon.tsx` and give it a name in `ICONS`.

**Add a session pane.** The session page renders `TranscriptPane` / `AskPane` / `NotesPane` from
`features/<area>/<area>-pane.tsx` with `PaneProps = { session }`; the tab is the route's `?tab=`
(`navigate({ to: '/sessions/$sessionId', params, search: { tab: 'transcript', segment } })`).
Dialogs: `useDialogs().open('preferences')`; toasts: `useToast()(text, { tone: 'error' })`.

**Strings.** Every user-visible string through `_()` / `ngettext()` from `@gnomeola/ui-core/i18n`,
the literal msgid as the first argument (never a variable). Catalogues are JSON from main
(`gnomeola.catalogue()`); see "Translations".

**Tests.**
- Pure logic, data layer: `packages/desktop/test/*.test.ts` (unit project, Node).
- Components: `packages/desktop/test/*.test.tsx` starting with `// @vitest-environment jsdom`; Testing
  Library role + name queries. `test/app-harness.tsx: renderApp({ sessions, handlers, bridge, path })`
  renders the whole window (real router, React Query, EventBridge) over `fakeDaemon` (route handlers)
  and `fakeBridge()` (vi.fn per bridge method); `test/primitives.test.tsx` and `test/screens.test.tsx`
  are the examples.
- Real daemon, no window: `packages/e2e/test/desktop-*.int.test.ts` (`int` project) — the tunnel via
  `packages/desktop/test/tunnel-harness.ts`, the supervisor on Electron's runtime.
- The window: `packages/e2e/test/desktop-*.e2e.test.ts` with `@gnomeola/testkit/desktop`:
  `buildDesktop()` once, `startHeadlessDisplay()`, `launchDesktop({ display, env: { GNOMEOLA_URL } })`,
  then `app.window.getByRole(...)` (Playwright), `app.axe()` → `[]`, `app.problems()` → `[]` (console
  errors, page errors, CSP violations), `app.screenshot(path)`, `waitForDaemon(app, 'attached')`,
  `app.evaluateMain(({ BrowserWindow }) => …)`, `app.close()` (explicit quit). Screenshot baselines:
  `baseline(app, name)` from `packages/e2e/src/desktop.ts` compares with
  `test/__screenshots__/desktop/<name>.png` (a missing one is recorded; `GNOMEOLA_UPDATE_SCREENSHOTS=1`
  re-records after a deliberate design change; a mismatch writes `<name>.diff.png` in `__artifacts__`).
  A first-run window opens onboarding: tests about something else call `markOnboarded(display)`. Test code compiled by
  `packages/e2e` has no DOM lib: pass page-side code to `evaluate` as a string.
- Baselines of one pane (the notes suite): an element screenshot of the pane (not the frame, which
  shows live times) through `matchBaseline(png, baselinePng)` from `@gnomeola/testkit/desktop`. Blur
  focus and park the pointer first, and `emulateMedia({ reducedMotion: 'reduce' })` for still spinners — Playwright's
  `animations: 'disabled'` injects a `<style>` the CSP refuses.
- **Baselines are deterministic, and every threshold is ≤ 1%** (`expectScreenshot` default `maxDiff`
  0.01, `baseline()` 0.005). A live screen is frozen, not tolerated: the fake pipeline's
  `deterministic: true` advances audio a fixed step per tick (finals due in audio time), and
  `hold: { atMs, releaseFile }` freezes every recording at `atMs` — still recording, re-sending its open
  partial lines and a steady level — until the test writes `releaseFile`
  (`desktop-transcript.e2e.test.ts`); a provider stream is held with `api.holdAfter(n)` from
  `packages/e2e/src/fake-anthropic.ts` (`desktop-ask`, `desktop-notes`). Then reduced motion (no caret
  blink, pulse or spinner), blur the focus and park the pointer before the shot. A baseline that needs
  more than 1% has something live in it: freeze that instead of raising the threshold.
- Third-party widgets that inject `<style>` (CodeMirror's style-mod) must be mounted in a shadow root,
  where they fall back to constructable stylesheets.
- The client packages may not import testkit (`pnpm boundaries`), which is why window tests live in
  `packages/e2e`.

## Transcript, Ask, Speakers (phase 2B)

- **Transcript** (`features/transcript/`): `rows.ts` turns the transcript query + the store's partials +
  the session's recorded gaps into display rows (pure, unit-tested); `transcript-list.tsx` is a
  listbox over `@tanstack/react-virtual` — options named `"<Speaker> at <m:ss>: <text>"` (+
  ` (provisional)` / ` (in progress)`, the GTK app's names), one Tab stop, arrows/Page/Home/End move the
  selection (`aria-activedescendant`), and the selection is the highlight. Follow mode is intent-based
  (wheel/keys up or a scrollbar drag detach, reaching the bottom re-attaches), "Jump to Live" re-attaches.
- **Citations** are URLs: `#/sessions/<id>?tab=transcript&segment=<seg>` or `&t=<seconds>`; the pane
  scrolls to, selects and flashes the line once per navigation (the router's per-navigation key), so
  following the same link twice re-scrolls. Anything may link to a line this way.
- **Ask** (`features/ask/`): history = the qa query; this window's own asks live in `own-asks.ts` (they
  survive the tab unmounting), tokens stream into `streams[localId]`, and `mergeTurns` lays them over the
  history until the durable answer arrives. A cross-meeting ask (`since: '30d'`) is shown from its
  stream's answer (no session history holds it); its chips open the cited session.
- **Speakers** (`features/speakers/`): rename / merge fold the very event the daemon will echo through
  ui-core's folds, so the echo is a no-op; split shows a provisional "New speaker" until
  `speaker.upserted` + `segments.attributed` name it. Chips: daemon slot n → `speaker.((n mod 6)+1)`.
- **Perf**: the pane records `performance.measure('transcript.first-paint')` (snapshot in hand → first
  painted frame); `desktop-transcript.e2e.test.ts` reads it and times End / ten Page Downs on the
  1,350-line fixture (`__artifacts__/desktop-transcript-perf.json`). 2026-09-30: first paint 11–12 ms,
  End 9–18 ms, ten Page Downs 15–44 ms (GTK: commit ~7 ms, End ~320 ms, ten Page Downs ~350 ms).
- Timestamps use text.tertiary, as the spec says (the corrected tertiary is 4.5:1 on every background).
  The selected line is the exception: on its bg.selected tint tertiary is 4.2:1 (light) / 4.3:1 (dark),
  so that one line's time uses text.secondary.

## Agendas (kacola wave 2)

Contracts: docs/agendas.md (agenda core, drafting) and the agent channel's owner routes in
`packages/protocol/src/agendas.ts`. Code: `features/agendas/`, folds in `@gnomeola/ui-core/agendas`.

- **Data.** `['agenda', id]` holds an `AgendaView`, `['agendaHistory', id]` its `StatusChange`s — both
  folded by `EventBridge.foldAgenda` with ui-core's `applyAgendaEvent` / `applyHistoryEvent`
  (version-checked: an event not newer than the view is a replay; suggestions upsert by id). `['agendas']`
  (summaries) and `['sessionAgenda', sessionId]` (the linked agenda's id) are refetched when an agenda
  appears, changes its header or goes. `['leases', sessionId]` / `['agentAccess', sessionId]` are the
  agent channel's; `agent.presence` lands in the ephemeral store (`presence[sessionId][leaseId]`) and
  invalidates the leases; `settings.updated` invalidates the access (it rides `agents.allowPrivate`).
- **Mutations** (`features/agendas/mutations.ts`) write the optimistic value WITHOUT bumping the view's
  version, so the echo always folds over it. An add shows `tmp_…` rows until the response (folded only if
  the echo has not already brought that version); the temporary ids live in a module-wide WeakMap keyed
  by the call's variables (a hook rebuilds its options every render).
- **Screens.** `#/agendas/<id>` (`agenda-page.tsx`): title, meeting line, "This meeting is happening now"
  → Join and Record (`joinMeeting`, opens the join URL, goes to the session's Agenda tab), Plan with
  Claude (the draft route; proposals are the dialog's own state), Add Link to Invite (written, or the
  calendar's reason + the block to copy), the actions menu (export through the save dialog, copy, import
  with `baseVersion`, delete), Items (goals, `SortableList` of items: status menu, edit dialog, history
  popover, Move Up / Down) and Context (private by default, "Shared with attendees"). The session page's
  **Agenda** tab (`agenda-pane.tsx` → `live-panel.tsx`): counts, "Not covered yet" from T-5 min, one
  Next talking point card, suggestions (Accept for looks-covered / agent proposals, Turn into Item,
  Dismiss), items with attribution ("auto", "checked by Claude") + Undo (an override) and evidence chips
  (→ `?tab=transcript&segment=`), the Interview view (Told / Not told yet), compact mode, the context
  panel (cards, agents' first; search past meetings → Add as Card); after the recording the recap
  (`recap.tsx`: outcome / decisions / actions parsed from the item's outcome, evidence, carry-over + Open
  Next Agenda). The header's **presence chip** (`presence.tsx`): "Claude · connected|reading", the
  record-pulse ring while reading (none under reduced motion), recent actions in its tooltip, a popover
  with the mode (observe / suggest / act), activity, Disconnect, and the private-meeting allow switch.
  The sidebar's **Coming up** (`upcoming.tsx`, calendar on only): the next three meetings, Plan / Agenda.
- **Deep links** (`deep-links.tsx`): subscribe to `onDeepLink`, then `takeDeepLink()` once;
  `resolveAgendaLink {link, create: true, includePrivate: true}` → navigate to the agenda.
- **Tests.** `test/agendas.test.tsx` (screens over a one-agenda fake daemon that echoes every write),
  `test/event-bridge.test.ts` (folds, late fetch, presence), `packages/ui-core/test/agendas.test.ts`;
  `packages/e2e/test/desktop-agenda.e2e.test.ts` against the real daemon + calendar file + fake Anthropic,
  and the real agent channel (a lease for "Claude" in act mode whose writes carry its token; presence from
  its heartbeats; mode change and Disconnect through the owner routes), the live tracker off for
  determinism; baselines `agenda-{editor,planning,live,live-items,interview,presence-popover,recap}-{light,dark}`
  and `agenda-presence-{connected,reading}-light` (the popover's activity times masked).
  `desktop-tracker.e2e` follows the REAL tracker (`src/tracker-daemon.ts`: the manager-1on1 fixture
  replayed, on-device decisions, a scripted text LLM): its status line, auto check-offs with evidence, its
  next-point card, the T-5 list, then the recap per item — behaviour, not pixels.
  `desktop-deeplink.e2e` asserts the agenda screen.
- **Tracker status** (`tracker-status.tsx`): `['agendaTracker', id]` from `GET /agendas/:id/tracker`,
  replaced by each ephemeral `agenda.tracker` event. Running: "Following the meeting · decisions <provider>";
  degraded: a warning banner with the reason; after the recording: "Writing the recap…", or why there is
  none / it failed. A next-point card the tracker replaced arrives dismissed by `tracker` and is simply
  hidden (only open cards show); it is never treated as the user's dismissal.

## Headless test display

Every window e2e runs inside a throwaway GNOME session from `@gnomeola/testkit/ui`
(`startHeadlessDisplay()`), never on the developer's desktop:

| process | why |
| --- | --- |
| `dbus-daemon` ×3 | private **session**, **system** and **accessibility** buses. The private system bus keeps the Shell away from the real logind / GDM. No service activation is configured, so nothing is spawned behind our back. |
| `at-spi2-registryd` | the AT-SPI registry, started explicitly (Fedora's bus launcher would activate it through systemd, which fails here). |
| `gnome-shell --headless --virtual-monitor WxH --wayland --no-x11` | the compositor, in a custom session mode without the overview. Chosen over bare mutter for `org.gnome.Shell.Screenshot` and `RemoteDesktop` (real keyboard input). No GPU: Chromium falls back to SwiftShader. |
| `python3 atspi-driver.py` | AT-SPI client (`gi.repository.Atspi`), JSON lines over stdio — what `desktop-atspi` reads Chromium's tree with. |

Host requirements: `gnome-shell` 50, `dbus-daemon` (the reference implementation), `at-spi2-core`,
`python3` with PyGObject and the `Atspi-2.0` typelib, and `setpriv` (util-linux). A missing piece fails
`startHeadlessDisplay()` loudly with every process's log — tests never skip.

Isolation: `XDG_RUNTIME_DIR`, `HOME` and every `XDG_*_HOME` point into a fresh `/tmp/gnomeola-ui-*` dir;
`GSETTINGS_BACKEND=keyfile` with a seeded keyfile (no welcome dialog, animations, lock or notification
banners); the environment is built from scratch, so `DISPLAY` / `WAYLAND_DISPLAY` / the session bus
cannot leak in. Every child runs under `setpriv --pdeathsig SIGKILL` and carries
`GNOMEOLA_HEADLESS_ID=<id>`; `close()` stops them in reverse order, then kills anything in `/proc` still
carrying the marker (`markedPids(id)` → `[]` is how suites assert a clean teardown).
`startHeadlessDisplay({ extensions: [dir] })` installs and enables Shell extensions in that session only
(the extension suites and `install.e2e`). The harness's own e2e (`packages/testkit/src/ui/e2e/
harness.e2e.test.ts`) drives a 60-line PyGObject app (`fixture-app.py`).

## Translations

Every user-visible string goes through `_()` / `ngettext()` from `@gnomeola/ui-core/i18n`, with `fmt()` for
named placeholders *after* translation (`fmt(_('{speaker} at {time}: {text}'), {…})`, so translators can
reorder). Module-level label tables are functions (`providers()`, `statusLabel()`), so they translate
when used, not at import time.

- `packages/desktop/translations/gnomeola.pot` is generated by `pnpm --filter @gnomeola/desktop i18n:pot`
  (GNU xgettext ≥ 0.23 reads TSX) from `src/renderer` and `packages/ui-core/src`, deterministically (no
  creation date). `test/i18n.test.ts` (unit, no xgettext) fails when a wrapped string is missing from the
  template, when the template has stale entries, or when `_()` is called with a non-literal.
- At run time main loads `<lang>.json` for the first preferred language (`LANGUAGE`, then `LC_ALL` /
  `LC_MESSAGES` / `LANG`, then the system's) from `resources/locale` (packaged) or `GNOMEOLA_LOCALE_DIR`,
  and the renderer installs it with `setTranslator` before the first paint; English is the source strings.
  Asserted by desktop-shell's translation test with a catalogue in a temp dir.
- Only English exists. Adding a language: `msginit -i translations/gnomeola.pot -l de -o
  translations/de.po`, list it in `translations/LINGUAS`; compiling `.po` → `<lang>.json` into the
  packaged `resources/locale` is not wired yet (E-10).

## Footprint (E-1 gate, 2026-09-30)

Measured inside the headless GNOME Shell 50.4 (Wayland, `--virtual-monitor 1280x800`,
`startHeadlessDisplay()`), Fedora 44, 3 runs each, figures stable to ±1%. Idle = 15 s after the first
paint. Memory is summed over the app's whole process tree from `/proc/<pid>/smaps_rollup`.

| | cold start: ready | cold start: first pixels | idle RSS (sum) | idle PSS (sum) | idle USS (sum) | processes |
| --- | --- | --- | --- | --- | --- | --- |
| GTK app (`node packages/ui/dist/bundle.mjs`, real test daemon, empty) | 975–1006 ms | 995–1027 ms | 361 MB | 197 MB | 172 MB | 1 |
| Electron 44.5.1 minimal window (sandboxed, data: page with sidebar) | 562–585 ms | 742–751 ms | 844–852 MB | 345–348 MB | 195 MB | 11 |
| same, `--disable-gpu --disable-software-rasterizer` | 263 ms | 402 ms | 700 MB | 259 MB | 138 MB | 11 |
| **the real app** (phase 1 first screen, 3 sessions) | 891 ms | 700–890 ms | 861 MB | **377 MB** | 226 MB | 9 |
| real app, `--in-process-gpu` | | 702 ms | 712 MB | 347 MB | 239 MB | 7 |
| real app, `--disable-gpu` | | 360 ms | 712 MB | 287 MB | 165 MB | 9 |
| **phase 3 re-measure, 2026-09-30** (same machine, 3 runs each): | | | | | | |
| GTK app, as above | 999–1011 ms | 1021–1033 ms | 362 MB | 191–194 MB | 171–173 MB | 1 |
| Electron minimal window, as above | 566–585 ms | 747–750 ms | 822–823 MB | 332–333 MB | 188 MB | 11 |
| **the real app, phases 2A–2C in** (brand fonts, every pane; `desktop-perf.e2e`, 3 sessions) | 779–913 ms | 779–913 ms | 886–891 MB | **404–406 MB** | 252–253 MB | 9 |

- *ready*: GTK = "No Session Selected" label on the AT-SPI bus; Electron = `ready-to-show`.
- *first pixels*: first Shell screenshot that differs from the empty desktop (both apps, same probe).
- Electron per-process (real app, PSS): main 118, GPU 118 (no GPU in the headless Shell → SwiftShader),
  renderer 66, network 28, broker 19, zygotes 12+12+4 MB.
- **Summed RSS double-counts** the pages every Chromium process shares (libelectron / V8 snapshot /
  ICU are mapped into all of them). PSS divides shared pages among their sharers, so it is the fair
  "sum of all processes" figure; USS is what quitting the app would free.

Phase 3 per-process PSS (real app): main 127, GPU 118, renderer 85 (was 66: the four bundled variable
brand faces and the screens), network 28, broker 19, zygotes 12+11+4 MB. *Ready* for the real app is
main's `window-ready` line, which it prints after the first paint, so it equals first pixels.

**Gate: idle PSS ≤ 350 MB (decided 2026-09-30).** The minimal window passed (345–348 MB: about +150 MB
PSS / +23 MB USS over GTK, faster first pixels). **The real app's first screen is at 377 MB** on the
headless Shell, where the GPU process runs SwiftShader; `--in-process-gpu` (347) or `--disable-gpu`
(287, software compositing) bring it under — an open decision (see the phase-1 report), not applied.
**Phase 3: the finished screens are at 404–406 MB, 55 MB over the gate** (the GPU flags above are
still not applied; the renderer grew 19 MB and main 9 MB since phase 1). Cold start still beats GTK:
first pixels 779–913 ms against 1021–1033 ms.

### Memory investigation (E-12, 2026-09-30)

A/B in the same session, `desktop-perf.e2e` 3 runs each (PSS, MB):

| | total | main | GPU | renderer | network | broker | zygotes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before | 402–405 | 120–123 | 115–116 | 88 | 29 | 20 | 12+12+5 |
| after | **392–393** | 115–116 | 115–116 | 83 | 29 | 20 | 12+12+5 |

(Absolute figures move by a few MB with whatever else is running on the machine; a separate copy of the
tree, run alone, measured 397–399 → 386–387, with main 123 → 115–116 and the renderer 85–87 → 81–82.)

What main holds, from its smaps and V8 heap snapshots (via `--inspect`): about 50 MB is its share of the
Electron binary's pages and 40–56 MB is anonymous memory. Its V8 heap is small, about 13 MB committed and
10 MB used. A bare Electron window's main (a sandboxed `data:` page) sits at 101 MB, and 108 MB once it
uses Node's `fetch` (undici's JS and llhttp wasm: +7 MB). The app's main has no big dependency: its
bundle is 282 kB (zod + the protocol route table included), and Node's built-ins dominate its strings.
The extra ~10 MB was **garbage**. At start-up the app:// handler streams the renderer bundle and fonts
through JS `Response` bodies, and V8 collects on allocation, never on idleness: the main isolate gets
no idle-time GC. So after start-up about 7 MB of dead buffers (V8 `external` 11.7 → 4.4 MB) plus dead
heap objects stayed resident indefinitely. One forced full GC took main from 123 to 113 MB.

Changes:
- `src/main/memory.ts` `IdleCollector`: a full GC of main (a few ms on a ~10 MB heap, `gc` exposed at
  runtime) 10 s after the first paint, after the window closes (background mode) and every 5 minutes, so
  the garbage from the tunnel's streams doesn't pile up to V8's external-memory trigger (~64 MB) either.
  Main: −5 to −7 MB. `--js-flags=--max-semi-space-size=1` had the same effect on the command line.
  Setting it from main with `v8.setFlagsFromString` does nothing (the heap is already configured), and
  every launcher would have to pass it, so the GC was chosen instead.
- The renderer bundle is minified, and the renderer, main and preload bundles are ASCII-only
  (`asciiOnly()` in `electron.vite.config.ts` escapes every non-ASCII unit). V8 keeps a script's
  source for as long as it runs. Unminified, with a few em-dashes and CLDR symbols in it, the 3.1 MB
  renderer bundle was a two-byte 6 MB string. It is now 1.4 MB of one-byte source. esbuild's
  `charset: 'ascii'` leaves regex literals alone (protocol's action-item regexes carry `—–`), hence the
  plugin. Renderer: −5 MB; its V8 heap went from 13.8 to 12.4 MB used.

What remains (392 against the 350 gate, all measured, none cheap):
- **GPU process, 115 MB**: SwiftShader / the GL stack in the headless Shell, the same as a bare window
  (112). Only GPU flags move it (see above), and those are out of scope here.
- **Chromium's fixed processes**: zygotes, broker and the network service come to about 77 MB. A bare
  window has the same.
- **Main, ~115 MB**: about 101 MB is what any Electron main costs, plus undici for Node `fetch`
  (+7 MB). Moving main's HTTP (the supervisor's health checks, the tunnel, main's protocol client) to
  Electron's `net.fetch` would drop undici. But it changes the tunnel's request semantics (Chromium's
  stack may add `Origin`, which the daemon's CSRF guard reads), so it wasn't done as a cheap win.
- **Renderer, ~83 MB against 42 for a bare page**: +13 MB of Electron binary pages (Blink paths a
  data: page never touches), about 12 MB of V8 heap for React + React Aria + TanStack + CodeMirror, and
  Blink's style/layout for the screens. Code-splitting CodeMirror or the `#/gallery` route would save
  1–2 MB at most.

Reproduce: `node packages/testkit/src/desktop/e1-spike/measure.ts` (`RUNS=n`, `ONLY=1` for Electron only,
`EXTRA="--flags"`). The real app is tracked by the non-blocking perf e2e
(`packages/e2e/test/desktop-perf.e2e.test.ts`): it writes `__artifacts__/desktop-perf.json` and warns
above 350 MB PSS without failing.

## Verification (phase 3)

Everything below is in `pnpm test:e2e` (the vitest `e2e` project globs `packages/*/**/*.e2e.test.ts`, so
every `packages/e2e/test/desktop-*.e2e.test.ts` is in it) and so in `scripts/release-gate.sh` (step T3).
CI's `e2e` job (`.github/workflows/ci.yml`) runs it headless in the Fedora 44 container: each window opens
in a private headless GNOME Shell, Chromium's shared libraries and tesseract are installed, and the suites
run as an unprivileged user (Chromium's sandbox refuses root).

| suite | what it holds |
| --- | --- |
| `desktop-a11y` | **The accessibility gate**: axe over every screen and state — main window, main menu, search with no matches, Keyboard Shortcuts, About + notices, each Preferences page and an open select, transcript (+ its search), Details, a private session, Ask empty / answered / refused, Notes editor, template menu, templates dialog + form, Version History, enhancing mid-stream, review, the enhance-refused banner, Speakers dialog + rename field + merge menu, a far-end line's actions, recording (live transcript, timer, meters), Ask while recording, paused, stopped, first-run onboarding, the empty window + missing-model banner, the daemon-unreachable screen — each in light, dark, light + high contrast and dark + high contrast. A planted 1.24:1 probe proves the gate fails when it should. `A11Y_INCOMPLETE=1` also lists what axe could not decide (today: one-character "·" separators, and the Version History preview, which overlaps its scroller). |
| `desktop-keyboard` | A keyboard-only walkthrough (only `keyboard.press` / `type`): Ctrl+R record and stop; Ctrl+F, type, Tab to the meeting, Enter; Ctrl+2 / Ctrl+1 and the arrows on the tab list; Tab to the Question field, ask; Shift+Tab back to a citation chip, Enter (the cited line selected); Ctrl+3, Tab into the editor, type; Shift+Tab to Enhance Notes, Enter; Tab to a change's switch, Space; Shift+Tab to Apply, Enter. The focus is asserted by role and name at every stop; each step is checked against the daemon. |
| `desktop-atspi` | What Orca sees: with accessibility support on, Chromium's AT-SPI tree on the headless session's private a11y bus (read with the testkit driver the GTK suites used) has the named frame, the Record and Main menu buttons, the Search entry, the Sessions list box with named items, the selected session's `selected` state, the page tabs, the transcript lines — and no unnamed visible control. Not covered: the platform `focused` state (neither CDP nor RemoteDesktop keys give the window a platform focus that Chromium reports in the headless Shell). |
| `desktop-voiceprints` | The Preferences speaker switches round-trip (and follow changes made elsewhere; Escape closes, it reopens); Record / Pause / Resume / Stop with the window's buttons (paused means the pipeline says nothing); a far-end speaker named in the Speakers dialog becomes a voiceprint; the next meeting recorded from the window names them by voice (the fake pipeline's `diarize`, as in the daemon's speakers.int test); voiceprints off forgets them. |
| `desktop-calendar` | A file calendar fixture (`GNOMEOLA_CALENDAR=file:`): the auto-record rule switched on in Preferences records a meeting when it begins, linked and titled; the session's Notes suggest the Interview template "suggested by the calendar event" even after a rename that matches nothing, and Enhance defaults to it. |
| `desktop-dialogs` (added) | The Ask "Questions aren't available right now" and Notes "Enhancing needs a language model provider" notices, each with Open Preferences, nothing sent to the provider; then a key typed into Preferences reaches the provider from the Ask button while the earlier notice stays. |

**Screenshot thresholds** (the share of differing pixels tolerated): before phase 3, `transcript-live-*`
0.35 and `ask-streaming-*` 0.30; now every baseline is at the 1% default (`expectScreenshot`) or 0.5%
(`baseline()`), the live ones frozen as described under *Tests* above.

### GTK → desktop checklist

Every behavioural assertion of the GTK window's suites (deleted with `packages/ui` at the cut-over, E-12)
and where the Electron window asserts it, so nothing was dropped. ✓ = asserted by a desktop e2e against the real daemon
(or the protocol stub where the GTK test used one); n/a = GTK plumbing with no Electron meaning.

| GTK test (file › test) | desktop equivalent | status |
| --- | --- | --- |
| ui-ask › streams an answer; citation chips jump to and highlight the line | desktop-ask › streams an answer… | ✓ |
| ui-ask › a refusal replaces the partial text | desktop-ask › shows a refusal as a notice… | ✓ |
| ui-ask › questions from another client live; history reloads | desktop-ask › shows questions asked by another client live… | ✓ |
| ui-ask › answers during a live recording (UI Record … Stop) | desktop-ask › answers during a live recording… (window Record and Stop) | ✓ |
| ui-dialogs › no key: the notice, nothing sent, Open Preferences, values shown, nothing written back | desktop-dialogs › explains that questions and enhancing need a provider… + opening Preferences shows the daemon's values… | ✓ |
| ui-dialogs › a key typed into Preferences: masked, saved, never shown, reaches the provider from the Ask button, the earlier notice kept | desktop-dialogs › stores an API key… + asks with the Ask button once a key is stored… | ✓ |
| ui-dialogs › settings persist from Preferences (keyboard); remote changes show live; Storage page | desktop-dialogs › persists settings changed in Preferences… | ✓ |
| ui-dialogs › About from the main menu: version, Granola credit, legal + notices, Escape | desktop-dialogs › About (from the main menu)… | ✓ (AdwAboutDialog sub-page navigation: n/a) |
| ui-dialogs › every screen keyboard reachable (Record, Main menu, Search, Ask tab, Question) | desktop-shell › is keyboard reachable… + desktop-keyboard (Question field, chips, Enhance, Apply) | ✓ |
| ui-dialogs › removing the key says Not configured | desktop-dialogs › removing the key… | ✓ |
| ui-dialogs › first-run onboarding: models, calendar, live download progress, remembered | desktop-dialogs › opens on first run… | ✓ |
| ui-dialogs › onboarding skipped: remembered, the banner reopens it | desktop-dialogs › remembers the skip… | ✓ |
| ui-i18n › strings from a catalogue; untranslated ones fall back | desktop-shell › translations › shows strings from a catalogue… | ✓ (gettext `.mo` loading: n/a, JSON catalogues) |
| ui-notes › types notes, autosaves a version | desktop-notes › types notes into the markdown editor… | ✓ |
| ui-notes › enhances through the real LLM chain without touching the notes | desktop-notes › enhances through the real LLM chain… | ✓ |
| ui-notes › accepts some blocks, reverts others, applies the exact merge | desktop-notes › accepts some blocks… | ✓ |
| ui-notes › never lost a word | desktop-notes › never lost a word… | ✓ |
| ui-notes › action items with owners | desktop-notes › lists the action items… (+ live update, copy) | ✓ |
| ui-notes › copies as markdown | desktop-notes › copies the notes to the clipboard… | ✓ |
| ui-notes › exports through the file dialog | desktop-notes › exports the notes… (the save dialog stubbed in main) | ✓ (the native chooser's own UI: n/a) |
| ui-notes › a refusal leaves the notes as they were | desktop-notes › a refusal leaves the notes… | ✓ |
| ui-notes › saves when the session is left before the autosave | desktop-notes › saves what was typed even when the session is left… | ✓ |
| ui-speakers › every line with its speaker chip and colour | desktop-speakers › shows every line with its speaker chip… | ✓ |
| ui-speakers › rename inline; the colour stays; the mic is me | desktop-speakers › renames a speaker inline… | ✓ |
| ui-speakers › refusals shown (reserved, duplicate) | desktop-speakers › shows the daemon's refusal… | ✓ |
| ui-speakers › merge from the dialog | desktop-speakers › merges two speakers… | ✓ |
| ui-speakers › split one line off; a mic line cannot be | desktop-speakers › splits one line off… | ✓ |
| ui-speakers › the Preferences speaker switches reach the daemon | desktop-voiceprints › Preferences: the speaker switches… | ✓ |
| ui-speakers › nothing unexpected in the log | every desktop suite ends with `app.problems()` → `[]` | ✓ |
| ui-transcript › a seeded transcript as labelled, timestamped lines | desktop-transcript › renders a seeded transcript… | ✓ |
| ui-transcript › the 1,350-line meeting fast; End / Page Down | desktop-transcript › renders the 1,350-line meeting quickly… | ✓ |
| ui-transcript › live recording: partials, provisional → final in place | desktop-transcript › shows a live recording… (started over HTTP so the pipeline can be held; the window's Record button starts recordings in desktop-voiceprints, -keyboard, -ask and -shell) | ✓ |
| ui-transcript › follows live output; Jump to Live | desktop-transcript › follows live output… | ✓ |
| ui-transcript › stops (UI Stop): every line final, matching the daemon | desktop-transcript › stops… (window Stop) | ✓ |
| gnomeola-ui › split view, named rows, search, Record, nothing selected | desktop-shell › shows a split view… + desktop-smoke | ✓ |
| gnomeola-ui › the list grows live | desktop-smoke / desktop-shell › shows a session started over HTTP live… | ✓ |
| gnomeola-ui › selecting replaces the detail; the selection survives the list growing | desktop-shell › selecting a row shows that session… (sessions created above it) | ✓ |
| gnomeola-ui › filters from real keyboard input | desktop-shell › filters the list… | ✓ |
| gnomeola-ui › records and stops from the header button; meters move | desktop-shell › records… | ✓ |
| gnomeola-ui › a screenshot of the running window | desktop-smoke › captures a screenshot… | ✓ |
| gnomeola-ui › unreachable daemon, Try Again | desktop-shell › explains an unreachable daemon… | ✓ |
| gnomeola-ui › the event stream resumes from its cursor, drives recording | desktop-shell › follows the event stream… | ✓ |
| gnomeola-ui › narrow screen: collapse and navigate back | desktop-shell › the main window on a narrow screen | ✓ |
| gnomeola-ui › Preferences / About close with Escape and reopen | desktop-voiceprints (Preferences), desktop-dialogs (About) | ✓ |
| gnomeola-ui › widget gallery (switch, entry, combo, toasts, alert dialog) | `packages/desktop/test/primitives.test.tsx` (jsdom) + the desktop-visual gallery | ✓ (component level) |
| gnomeola-ui › the `gtkx dev` dev server with HMR | — | n/a (GTKX tooling; `electron-vite dev` has no e2e) |
| gnomeola-ui › demo mode (`GNOMEOLA_UI_DEMO`) | — | n/a (no demo mode: the real daemon or the stub instead) |
| harness.e2e (private session, AT-SPI queries, real keystrokes, screenshots, cleanup) | tests of `startHeadlessDisplay` itself, which the desktop suites still use; desktop-atspi uses its AT-SPI driver | keep with the harness (needs PyGObject) |
