# The Electron window (packages/desktop)

The window is moving from GTK (`packages/ui`, GTKX) to Electron. Both run until the cut-over (E-12): the
GTK app and the Electron app share `packages/ui-core`. This page is the contract for everyone building
screens in `packages/desktop`.

```
packages/ui-core/          the data layer, GTK-free, DOM-free, Node-free (moved from packages/ui/src/data)
  src/{sessions,transcript,qa,notes,speakers,settings,format,follow,list-diff}.ts   pure folds + view logic
  src/{store,hooks,source,daemon-source,demo-source}.ts                            the GTK app's store/feeds
  src/i18n.ts                                                                      _(), ngettext(), fmt()
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
  src/preload/index.ts      contextBridge.exposeInMainWorld('gnomeola', …) — one function per capability
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
- **Entry**: `GNOMEOLA_DAEMON_ENTRY`, else `resources/daemon/daemon.mjs` (packaged), else
  `packages/daemon/dist/daemon.mjs`, else `packages/daemon/src/main.ts` (dev; Electron 44's Node 24.21
  strips types). `GNOMEOLA_DAEMON_ARGS` (JSON array) adds arguments (tests pass `--data-dir`).
- **Window close keeps running** (main + daemon). Quit is explicit (Ctrl+Q, `app.quit()`, SIGTERM) and
  stops the daemon we spawned — never one we attached to. `app.requestSingleInstanceLock()`: a second
  launch re-opens the first instance's window. `--background` starts with no window (the CLI's shim).
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
- Permission requests are all denied, except `media` with audio only for a window registered as the
  capture window (macOS in-app capture, later). IPC handlers reject senders that are not our origin.
- Fuses: RunAsNode **on** (one runtime runs the daemon and the CLI), NODE_OPTIONS and `--inspect` off,
  ASAR integrity + only-load-from-ASAR on, cookie encryption on, file:// privileges off; every fuse
  set explicitly (`strictlyRequireAllFuses`).

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

Deviations forced by the axe gate (4.5:1 for our 13–15px text): filled record-red surfaces that carry
white text (the Record button, a confirming destructive button) use `--record-fill-color` (#C93D22
light / #D0401F dark, 5.0 / 4.7:1) instead of accent.record (4.09 / 3.26:1) — dots, rings and the live
indicator stay accent.record; status *text* uses the `status.*Text` tokens.

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
reusing the GTK app's msgids where the meaning is the same. Catalogues are JSON from main
(`gnomeola.catalogue()`); compiling `translations/*.po` to JSON is E-10.

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
- The client packages may not import testkit (`pnpm boundaries`), which is why window tests live in
  `packages/e2e`.

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

- *ready*: GTK = "No Session Selected" label on the AT-SPI bus; Electron = `ready-to-show`.
- *first pixels*: first Shell screenshot that differs from the empty desktop (both apps, same probe).
- Electron per-process (real app, PSS): main 118, GPU 118 (no GPU in the headless Shell → SwiftShader),
  renderer 66, network 28, broker 19, zygotes 12+12+4 MB.
- **Summed RSS double-counts** the pages every Chromium process shares (libelectron / V8 snapshot /
  ICU are mapped into all of them). PSS divides shared pages among their sharers, so it is the fair
  "sum of all processes" figure; USS is what quitting the app would free.

**Gate: idle PSS ≤ 350 MB (decided 2026-09-30).** The minimal window passed (345–348 MB: about +150 MB
PSS / +23 MB USS over GTK, faster first pixels). **The real app's first screen is at 377 MB** on the
headless Shell, where the GPU process runs SwiftShader; `--in-process-gpu` (347) or `--disable-gpu`
(287, software compositing) bring it under — an open decision (see the phase-1 report), not applied.

Reproduce: `node packages/testkit/src/desktop/e1-spike/measure.ts` (`RUNS=n`, `ONLY=1` for Electron only,
`EXTRA="--flags"`). The real app is tracked by the non-blocking perf e2e
(`packages/e2e/test/desktop-perf.e2e.test.ts`): it writes `__artifacts__/desktop-perf.json` and warns
above 350 MB PSS without failing.
