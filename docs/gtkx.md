# GTKX in gnomeola

How the gnomeola window is built, run and tested. Read this before touching `packages/ui`.

GTKX (<https://gtkx.dev>, npm `@gtkx/*`, MPL-2.0) is a React reconciler that renders **real GTK 4 /
libadwaita widgets** from JSX, running on **Node** (not GJS) through a Rust native addon that calls
GTK via libffi. We pin **1.6.0** exactly (`latest` on npm). 2.0 is beta and needs Node 26.7; every
`future` flag is already on in `gtkx.config.ts`, so the 2.0 upgrade should be mechanical.

Everything below was verified on Fedora 44, GNOME 50, GTK 4.22.5, libadwaita 1.9.3, Node 24.21.
Statements marked **(e2e)** are asserted by `packages/testkit/src/ui/e2e/*.e2e.test.ts`.

---

## 1. Layout of `packages/ui`

```
packages/ui/
├─ gtkx.config.ts          application id, future flags, codegen options
├─ vite.config.ts          alias for the generated bindings (pnpm workspace fix, §3)
├─ scripts/gtkx-store-resolve.ts   Node resolve hook for `gtkx dev` (same fix, §3)
├─ src/
│  ├─ index.tsx            entry: config → data source → SessionStore → createRoot().render()
│  ├─ app.tsx              <AdwApplication> + store provider + main window
│  ├─ gallery.tsx          GNOMEOLA_UI_GALLERY=1: every widget pattern in §6, typechecked + e2e-tested
│  ├─ components/          main-window, sidebar, session-detail, record-button, status-pages, toasts
│  └─ data/                NO GTK IMPORTS — pure TS, unit-tested under plain vitest
│     ├─ source.ts         DataSource interface (load / subscribe / startRecording / stopRecording)
│     ├─ daemon-source.ts  the real thing: @gnomeola/protocol createClient()
│     ├─ demo-source.ts    GNOMEOLA_UI_DEMO=1 in-process fake with timers
│     ├─ store.ts          SessionStore: snapshot + resumable event stream, connection state
│     ├─ sessions.ts       pure fold of events into the session list
│     ├─ hooks.ts          useSessions / useSession / useEvents / useConnection / useNow
│     ├─ format.ts         relative times, durations, status text, markup escaping
│     └─ config.ts         env → config
└─ test/*.test.ts          unit tests for data/ (run by the root `unit` project)
```

**Rule of thumb:** anything that can be a pure function goes in `src/data/` (or another GTK-free module)
and gets a `*.test.ts`. Components stay thin. `@gtkx/*` imports must never appear in `src/data/`,
because the root vitest runs those tests without a display.

The UI may import **only** `@gnomeola/protocol` from this workspace (`pnpm boundaries` enforces it,
including in `test/`). That is also why the UI's e2e tests live in `packages/testkit/src/ui/e2e/`.

### Runtime configuration (environment only)

| variable | meaning |
| --- | --- |
| `GNOMEOLA_URL` | daemon base URL; default `http://127.0.0.1:8787` (`DEFAULT_BASE_URL`) |
| `GNOMEOLA_UI_TIMEOUT_MS` | per-request timeout for JSON calls (default 5000) |
| `GNOMEOLA_UI_DEMO=1` | use the in-process demo source instead of a daemon |
| `GNOMEOLA_UI_DEMO_INTERVAL_MS` | demo: a new recording every N ms (default 4000) |
| `GNOMEOLA_UI_DEMO_MAX_SESSIONS` | demo: stop churning at N sessions (default 40) |
| `GNOMEOLA_UI_GALLERY=1` | open the widget gallery instead of the app |

---

## 2. Commands

All from the repo root (`export PATH=…/node/24.21.0/bin:$PATH` first):

```sh
pnpm --filter @gnomeola/ui codegen     # (re)generate bindings; ~10 s cold, <1 s when up to date
pnpm --filter @gnomeola/ui dev         # dev server + Fast Refresh (opens a window on YOUR desktop)
GNOMEOLA_UI_DEMO=1 pnpm --filter @gnomeola/ui dev   # …with fake live data, no daemon needed
pnpm --filter @gnomeola/ui build       # → packages/ui/dist/bundle.mjs (+ dist/gtkx.node)
node packages/ui/dist/bundle.mjs       # run the production bundle
pnpm --filter @gnomeola/ui typecheck   # codegen, then tsc (also part of `pnpm run check`)
pnpm exec vitest run --project unit packages/ui          # pure-logic tests, no display
pnpm exec vitest run --project e2e packages/testkit/src/ui   # headless window tests (~50 s)
```

`build` sets `NODE_ENV=production` itself. **Do not build with `NODE_ENV=test` (vitest's default):**
the bundle then calls `jsxDEV` from React's production runtime and dies at startup with
`TypeError: (0 , $.jsxDEV) is not a function`. The e2e suite builds with `NODE_ENV=production` for
this reason.

The bundle is self-contained except for `gtkx.node` beside it and the system GTK/libadwaita.

---

## 3. Bindings: how codegen works, and the pnpm-workspace fix

`@gtkx/gi` (imperative GObject API, one subpath per namespace: `@gtkx/gi/gtk`, `@gtkx/gi/adw`,
`@gtkx/gi/glib`…) and `@gtkx/jsx` (one component per widget: `@gtkx/jsx/gtk`, `@gtkx/jsx/adw`) are
**not npm packages**. `gtkx codegen` generates them from the GIR XML on the machine
(`/usr/share/gir-1.0/*.gir`, from `gtk4-devel`, `libadwaita-devel`, `glib2-devel` on Fedora) into
`packages/ui/node_modules/.gtkx/{gi,jsx}` and symlinks them as `node_modules/@gtkx/{gi,jsx}`.

- Which libraries: `Gtk-4.0` and `Adw-1` come from the `v2DefaultLibraries` flag. Add others
  (e.g. `"GtkSource-5"`) to `libraries` in `gtkx.config.ts`; an empty array is a config error.
- When it runs: `gtkx dev`, `gtkx build` and our `typecheck` script all run it; when nothing changed
  it prints `bindings up to date` and takes under a second. Changing `future` flags or the GTKX
  version invalidates the store. Run it by hand after upgrading GTK/libadwaita.
- **CI needs the `-devel` GIR packages** or codegen (and therefore typecheck) fails.
- It also writes an element reference to `packages/ui/.gtkx/reference/**` (gitignored). It is the
  authority on props, signals and methods for *our* GTK version: `adw/navigation-split-view.md`,
  `gtk/list-box.md`… `cat` it before guessing a prop name. `agents.rules` is off so codegen does not
  write `AGENTS.md`/`CLAUDE.md` into the package.
- `tsconfig.json` maps `@gtkx/gi/*` and `@gtkx/jsx/*` to the store via `paths`, as the GTKX
  scaffold does. `tsc` genuinely checks props: a typo like `titleX` on `AdwActionRow` is an error.

### pnpm workspaces (why `vite.config.ts` and `scripts/gtkx-store-resolve.ts` exist)

In a single-package GTKX app this just works. In our pnpm workspace it does not, out of the box:

1. `gtkx codegen` first fails with `Cannot resolve @gtkx/native from the project` — pnpm does not
   hoist the addon. **Fix:** `@gtkx/native` is a direct dependency of `@gnomeola/ui`.
2. `gtkx build` then fails with `Cannot resolve "@gtkx/gi/gio": the generated store … is not on the
   module resolution path of …/node_modules/.pnpm/@gtkx+react…`. The real files of `@gtkx/react`
   and `@gtkx/runtime` live in the **root** `node_modules/.pnpm`, and walking up from there never
   reaches `packages/ui/node_modules/@gtkx/gi`. **Fix:** `vite.config.ts` aliases
   `@gtkx/gi|jsx` to the store (`gtkx build` merges the project's Vite config).
3. `gtkx dev` fails with `ERR_MODULE_NOT_FOUND: Cannot find package '@gtkx/gi' imported from
   …/@gtkx/cli/dist/dev/runner-deps.js` — in dev, `@gtkx/*` are SSR externals loaded by Node itself,
   so a Vite alias cannot help. **Fix:** the `dev` script preloads `scripts/gtkx-store-resolve.ts`
   through `NODE_OPTIONS=--import`, a `module.registerHooks` resolve hook that re-resolves
   `@gtkx/gi|jsx` as if imported from `packages/ui`. **(e2e: `gtkx dev inside the pnpm workspace`)**

If you add another GTKX runtime package (`@gtkx/components`, `@gtkx/navigation`…), it will need the
same treatment, and it must be a direct dependency of `@gnomeola/ui`.

`@gtkx/cli` pulls `@gtkx/vitest`, which declares a peer of `vitest >=4`; the root has vitest 3.
That warning is harmless because we do not use GTKX's vitest plugin (§8).

---

## 4. Running it headless (never on your desktop)

`packages/testkit/src/ui` (`@gnomeola/testkit/ui`) starts a throwaway GNOME session and drives apps
through AT-SPI. Use it for any automated UI run; `pnpm dev` is the only thing that should ever open
a window on a developer's real desktop.

```ts
import { startHeadlessDisplay } from '@gnomeola/testkit/ui'

const d = await startHeadlessDisplay({ size: '1280x800' })
try {
  const app = d.launchApp({
    command: process.execPath,
    args: ['packages/ui/dist/bundle.mjs'],
    env: { GNOMEOLA_UI_DEMO: '1' },
  })
  const row = await d.findOne({ app: 'gnomeola', role: 'list item', name: 'Weekly product sync' })
  await d.click(row)
  await d.findOne({ app: 'gnomeola', role: 'heading', name: 'Weekly product sync' })
  await d.screenshot('packages/ui/test/__artifacts__/after-click.png')
} finally {
  await d.close() // kills everything it started, removes its temp dir
}
```

Host requirements: `gnome-shell` (50), `dbus-daemon` (the reference implementation, not only
dbus-broker), `/usr/libexec/at-spi2-registryd` (`at-spi2-core`), `python3` with PyGObject and the
`Atspi-2.0` typelib, and `setpriv` (`util-linux`). A GPU is not needed but is used if present. Startup
takes about half a second; a missing piece fails `startHeadlessDisplay()` loudly with the logs of every
process it started — tests never skip.

What `startHeadlessDisplay()` starts, all inside a fresh `/tmp/gnomeola-ui-*` dir:

| process | why |
| --- | --- |
| `dbus-daemon` ×3 | private **session**, **system** and **accessibility** buses. The private system bus matters: without it the Shell talks to the real logind and GDM ("Registering session with GDM", "Will monitor session 3" — observed). No service activation is configured, so nothing gets spawned behind our back. |
| `at-spi2-registryd` | the AT-SPI registry, started explicitly. Fedora's `at-spi-bus-launcher` starts `dbus-broker`, which activates the registry through **systemd** and fails ("unit failed"); a plain `dbus-daemon` with the service dir fails with "Permission denied". |
| `gnome-shell --headless --virtual-monitor WxH --wayland --no-x11` | the compositor. Chosen over bare `mutter` because it exports `org.gnome.Shell.Screenshot` (screenshots with no PipeWire/ScreenCast pipeline) as well as mutter's `RemoteDesktop` (real keyboard input). |
| `python3 atspi-driver.py` | AT-SPI client (`gi.repository.Atspi`) speaking JSON lines over stdio. |

Isolation: `XDG_RUNTIME_DIR`, `HOME`, every `XDG_*_HOME` point into the temp dir;
`GSETTINGS_BACKEND=keyfile` with a pre-seeded keyfile (no welcome dialog, no animations, no lock
screen banner, no notification banners), so nothing touches your dconf. The environment is built
from scratch, not inherited, so `DISPLAY`/`WAYLAND_DISPLAY`/`DBUS_SESSION_BUS_ADDRESS` from your
session cannot leak in **(e2e: checked in the Shell's `/proc/<pid>/environ`)**.

Teardown: every child runs under `setpriv --pdeathsig SIGKILL` (dies if the test runner dies) and
carries `GNOMEOLA_HEADLESS_ID=<id>` in its environment; `close()` stops them in reverse order and then
SIGKILLs anything in `/proc` still carrying the marker — which catches things the Shell spawned
itself (ibus, glycin image loaders). **(e2e: no marked pid and no temp dir survive `close()`)**

Details worth knowing:

- The Shell starts in a custom session mode (`hasOverview: false`, written to a private
  `XDG_DATA_DIRS` entry — modes are only read from system data dirs) because the stock `user` mode
  starts in the Activities overview, which covers every window.
- **Screenshots:** `org.gnome.Shell.Screenshot` only answers callers that own one of a few
  well-known names; on our private bus the driver simply owns `org.gnome.SettingsDaemon.MediaKeys`.
  `screenshot(path)` = whole monitor, `screenshot(path, { kind: 'window' })` = focused window with
  its frame. Always look at them — the level-bar layout bug in this package was found that way.
- **Keyboard:** `typeText()`/`pressKeys()` go through mutter's `RemoteDesktop` API, i.e. through the
  compositor and GTK's input method, like a real keyboard. The first event on a new virtual
  keyboard is swallowed, so the driver burns a Shift press first. The top bar then shows the orange
  "remote desktop" indicator in screenshots; that is expected.
- **Focus:** GTK 4 does not implement AT-SPI `Component.GrabFocus`; `focus()` falls back to real
  Tab presses until the node reports `focused`.
- **Clicking:** `click()` uses the node's AT-SPI action (`click` for buttons, `toggle` for
  switches), else — for selectable list rows — `Selection.select_child` on the parent list (the
  same selection a pointer click makes), else an action on a descendant (composite rows such as
  `AdwSwitchRow`). It returns which one it used. There is no pointer injection (mutter's absolute
  pointer needs a ScreenCast stream); anything else goes through the keyboard.
- AT-SPI role names are the at-spi 2.60 ones (`button`, not "push button"). What our widgets look
  like from a test, all observed in the e2e runs:

  | widget | role · name | how the harness drives it |
  | --- | --- | --- |
  | `AdwApplicationWindow` | `frame` · window title | — |
  | `AdwNavigationPage` | `grouping` · page title | `extents()` to check layout |
  | `GtkButton` (label or `AdwButtonContent`) | `button` · its label | `click()` → action `click` |
  | icon-only `GtkButton` | `button` · its `accessibleLabel` | same |
  | `GtkListBox` | `list` · `accessibleLabel` | — |
  | `AdwActionRow` in a list | `list item` · row title | `click()` → `Selection.select_child` (state `selected`) |
  | `GtkLabel` | `label` · its text (`heading` with `accessibleRole`) | `describe().text` |
  | `GtkSearchEntry` | `entry` · `accessibleLabel` | `focus()` + `typeText()` |
  | `GtkEntry` | `text` · `accessibleLabel` | `focus()` + `typeText()`, or `setText()` |
  | `GtkTextView` | `text` · `accessibleLabel` | `describe().text` is the buffer contents |
  | `GtkSwitch` | `switch` · `accessibleLabel` | `click()` → action `toggle` |
  | `AdwSwitchRow` | `switch` · title (the row has no action; the inner `GtkSwitch` does) | `click()` → descendant `toggle` |
  | `AdwComboRow` | `combo box` · title | `focus()`, `Return`, `Down`, `Return` |
  | `AdwEntryRow` | `list item` named "Title Title" (sic), containing `text` · title | `focus()` the `text`, type, `Return` applies |
  | `GtkLevelBar` | `level bar` · `accessibleLabel` | `describe().value` |
  | `AdwAboutDialog` | `dialog` · "About" | `pressKeys('Escape')` closes it |
  | `AdwAlertDialog` | heading/body are `label`s, responses `button`s | `click()` a response |
  | `AdwToast` | a `label` with the toast title | — |
  | `AdwBanner` | `grouping` · title | see the gotcha in §5 |
- The app's AT-SPI application name comes from `GLib.setApplicationName()` — see `src/index.tsx`;
  without it the app is registered as `node`.

---

## 5. JSX model in 60 seconds

- **Element name = GObject type name.** `<AdwNavigationSplitView>`, `<GtkListBox>`. Anything in the
  GTK/Adwaita docs exists. Import from `@gtkx/jsx/adw` / `@gtkx/jsx/gtk`.
- **Props = GObject properties in camelCase** (`show-title-buttons` → `showTitleButtons`).
  Construct-only props work too (`<GtkStringList strings={[…]}/>`).
- **Signals = `on` + PascalCase**, handler gets the signal args then `self`:
  `onClicked={(self) => …}`, `onRowSelected={(row, self) => …}`, `onSearchChanged={(self) => …}`.
- **Property changes = `onNotify<Prop>`**, called with `(value, self)`: `onNotifyActive`,
  `onNotifySelected`, `onNotifyShowContent`. Use it to mirror a widget-owned value back into React
  (controlled-widget pattern). GTKX suppresses the notify its *own* write causes.
- **Slots:** a property typed as a widget accepts an element: `topBar=`, `sidebar=`, `start=`,
  `end=`, `titleWidget=`, `prefix=`, `suffix=`, `breakpoints=`, `model=`. Children go to the
  widget's default slot (for `AdwNavigationSplitView` that is `content`; for `GtkTextView` it is the
  buffer).
- **`ref`** gives the `@gtkx/gi` instance for imperative calls (`overlay.addToast(…)`).
- **Enums/classes** come from `@gtkx/gi/*`: `import * as Gtk from '@gtkx/gi/gtk'` →
  `Gtk.Orientation.VERTICAL`, `Gtk.PolicyType.NEVER`, `Adw.BreakpointCondition.parse('max-width: 560sp')`.
- **Windows and dialogs portal themselves:** rendering an `AdwApplicationWindow` or any `AdwDialog`
  presents it; unmounting closes it. Keep "is the dialog open" in React state and clear it in
  `onClosed`.
- Useful hooks from `@gtkx/react`: `useApplication`, `useParentWindow`, `useProperty(ref, 'prop')`,
  `useSignal(ref, 'signal', handler)`, `useSetting`/`useBindSetting` (GSettings), plus `quit`,
  `createPortal`, `rootElement`.

### Accessible names (a testability requirement here)

Every interactive widget needs an accessible name or the AT-SPI tests cannot find it; the e2e suite
has an audit that **fails on any showing button/entry/list/list item/level bar/switch without a name**.

- Any widget: `accessibleLabel="…"`, `accessibleDescription="…"`, `accessibleRole={Gtk.AccessibleRole.HEADING}`
  (+ `accessibleLevel={1}`), and the rest of the ARIA-like set (`accessibleHidden`,
  `accessibleValueText`…). These are GTKX props mapped onto `GtkAccessible`.
- A label's name is its text; a `GtkButton`'s is its label; an `AdwActionRow` / list row is named
  by its `title` **(e2e)**; an `AdwNavigationPage` is a `grouping` named by its `title` **(e2e)**.
- **Gotcha:** `AdwButtonContent` inside a `GtkButton` sets the button's *labelled-by* relation to its
  own label, and labelled-by beats `accessibleLabel` — our Record button is named `Record`/`Stop`, not
  whatever `accessibleLabel` said **(e2e)**. Use `accessibleDescription` for the longer text.
- **Gotcha:** `AdwPreferencesGroup`'s internal `GtkListBox` is an anonymous `list` and you cannot
  reach it to name it. Outside preference dialogs we use a heading label + `<GtkListBox
  cssClasses={['boxed-list']} accessibleLabel=…>` instead (`Section` in `session-detail.tsx`).
- **Gotcha:** an *unrevealed* `AdwBanner` is still a showing, named node in the tree, so a screen
  reader (and a test) sees a stale warning. We mount the banner only while it should show.
- **Known exception:** `AdwComboRow` exposes its current-value display as an unnamed `list` /
  `list item` inside the named `combo box`. That is libadwaita's, not ours; if you add the audit to a
  screen with a combo row, skip descendants of `combo box`.

---

## 6. Widget patterns we use (all compiled and exercised in `src/gallery.tsx` / the app)

Every snippet below exists in `src/components/*` or `src/gallery.tsx`, so it typechecks against our
bindings, and the e2e suite drives it: the split view, list, status pages, Record button and level
bars in the app; switch/switch row/combo row/entry row/entry/text view/toast/alert/preferences/about
in the gallery (`GNOMEOLA_UI_GALLERY=1 pnpm --filter @gnomeola/ui dev` to look at it).

### Window, split view, header bars

```tsx
<AdwApplication>
  <AdwApplicationWindow
    title="gnomeola" defaultWidth={1024} defaultHeight={700}
    widthRequest={360} heightRequest={294}          // GNOME's smallest supported size
    onCloseRequest={quit}                          // quit() returns true: we handle the close
    breakpoints={
      <AdwBreakpoint
        condition={Adw.BreakpointCondition.parse('max-width: 560sp')}
        onApply={() => setCollapsed(true)} onUnapply={() => setCollapsed(false)} />
    }>
    <AdwNavigationSplitView
      collapsed={collapsed}
      showContent={showContent}
      onNotifyShowContent={(v) => setShowContent(Boolean(v))}  // back button / swipe / Esc
      sidebar={
        <AdwNavigationPage title="Sessions" tag="sidebar">
          <AdwToolbarView topBar={<AdwHeaderBar start={<RecordButton />} />}>…</AdwToolbarView>
        </AdwNavigationPage>
      }>
      {/* children = the content page */}
      <AdwNavigationPage title={title} tag="content">
        <AdwToolbarView topBar={<AdwHeaderBar />}>…</AdwToolbarView>
      </AdwNavigationPage>
    </AdwNavigationSplitView>
  </AdwApplicationWindow>
</AdwApplication>
```

Each page gets its own `AdwToolbarView` + `AdwHeaderBar`; the split view hides the inner window
buttons and adds a back button when collapsed. `AdwWindowTitle` gives a title + subtitle
(`titleWidget={<AdwWindowTitle title="gnomeola" subtitle="Demo data" />}`).
`@gtkx/navigation` offers a React-Navigation-style wrapper (`Split.Navigator`); we use the raw
widgets to keep the dependency surface small.

### Lists with dynamic rows

```tsx
<GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
  <GtkListBox
    cssClasses={['navigation-sidebar']}
    accessibleLabel="Sessions"
    selectedIndex={shown.findIndex((s) => s.id === selectedId)}  // controlled; -1 = none
    onRowSelected={(row) => { if (row) onSelect(shown[row.getIndex()]!.id) }}>
    {shown.map((s) => (
      <AdwActionRow key={s.id} useMarkup={false} title={s.title} subtitle={subtitle(s)} activatable
        prefix={<GtkImage iconName="audio-x-generic-symbolic" accessibleLabel="Recorded session" />} />
    ))}
  </GtkListBox>
</GtkScrolledWindow>
```

- Keyed children are inserted/moved/removed like DOM nodes; new rows at the top keep the selection
  on the right session because `selectedIndex` is drift-correcting **(e2e)**.
- **`useMarkup={false}`** on every row that shows user text: `AdwPreferencesRow.use-markup` defaults
  to **true**, so a title like `Q&A <draft>` would be parsed as Pango markup. The same is true for
  `AdwStatusPage.description` (no prop to turn it off — escape with `escapeMarkup()` from
  `data/format.ts`), `AdwBanner.title` and `Adw.Toast` titles.
- **Row widgets go in `prefix`/`suffix`. Children of an `AdwActionRow` replace the row's whole
  content** (title and subtitle disappear) — seen in a screenshot of the level meters, fixed by moving
  them to `suffix`.
- For long lists (hundreds+) prefer `GtkListView` (model + factory); `@gtkx/components` has a
  `ListView` wrapper taking `items` + `renderItem`. The sidebar is fine with `GtkListBox`.
- libadwaita 1.9 also has `AdwSidebar`/`AdwSidebarItem`; not evaluated yet.

### Status pages (empty/error/loading)

```tsx
<AdwStatusPage vexpand iconName="network-offline-symbolic" title="Can’t Reach gnomeola"
  description={escapeMarkup(`The gnomeola daemon is not answering at ${url}.`)}>
  <GtkButton label="Try Again" cssClasses={['pill', 'suggested-action']} halign={Gtk.Align.CENTER}
    onClicked={retry} />
</AdwStatusPage>
```

Children appear under the description. `AdwSpinner` as a child makes a loading page.

### Toasts

`AdwToastOverlay` has no declarative toast prop; keep a ref and call `addToast`:

```tsx
const overlay = useRef<Adw.ToastOverlay | null>(null)
const toast = Adw.Toast.new(text); toast.setUseMarkup(false)
overlay.current?.addToast(toast)
// <AdwToastOverlay ref={overlay}>{content}</AdwToastOverlay>
```

`components/toasts.tsx` wraps this as `<ToastHost>` + `useToast()`. (`@gtkx/components/adw` has an
equivalent `ToastProvider`.)

### Text: labels, entries, search, transcript text

```tsx
<GtkLabel label={title} cssClasses={['title-1']} wrap xalign={0} selectable
  accessibleRole={Gtk.AccessibleRole.HEADING} accessibleLevel={1} />
<GtkSearchEntry placeholderText="Search sessions" accessibleLabel="Search sessions"
  onSearchChanged={(self) => setQuery(self.getText())} />       // debounced by GTK (150 ms)
<GtkEntry placeholderText="Speaker name" accessibleLabel="Speaker name" text={v}
  onChanged={(self) => setV(self.getText())} />
<GtkScrolledWindow minContentHeight={120} hasFrame>
  <GtkTextView editable={false} wrapMode={Gtk.WrapMode.WORD_CHAR} accessibleLabel="Transcript">
    <GtkTextBuffer text={transcript} />                          // the buffer is the child
  </GtkTextView>
</GtkScrolledWindow>
```

Not yet verified (T-6 should check): for a live transcript, re-setting the buffer's `text` on every
partial will likely reset scroll position and selection; appending through a `GtkTextBuffer` ref is
the usual GTK approach.

### Buttons, switches, rows, combo rows

```tsx
<GtkButton accessibleDescription="Start recording a new session" cssClasses={['suggested-action']}
  onClicked={start}>
  <AdwButtonContent iconName="media-record-symbolic" label="Record" />  // icon + label
</GtkButton>
<GtkButton iconName="help-about-symbolic" accessibleLabel="About gnomeola" />  // icon-only: label it!
<GtkSwitch accessibleLabel="Private" active={on} onNotifyActive={(v) => setOn(Boolean(v))} />
<GtkListBox cssClasses={['boxed-list']} selectionMode={Gtk.SelectionMode.NONE} accessibleLabel="Settings">
  <AdwSwitchRow title="Auto-record meetings" active={auto} onNotifyActive={(v) => setAuto(Boolean(v))} />
  <AdwComboRow title="Live model" model={<GtkStringList strings={MODELS} />}
    selected={i} onNotifySelected={(v) => setI(Number(v))} />
  <AdwEntryRow title="Daemon URL" text={url} showApplyButton onApply={(self) => setUrl(self.getText())} />
</GtkListBox>
<GtkLevelBar minValue={0} maxValue={1} value={rms} accessibleLabel="Microphone level" />
```

Style classes: `suggested-action`, `destructive-action`, `pill`, `flat`, `boxed-list`,
`navigation-sidebar`, `title-1`…`title-4`, `heading`, `caption`, `dim-label`, `error`.

### Dialogs: preferences, about, alert

Mounting presents the dialog, unmounting closes it; the user closing it (Escape, the close button)
fires `onClosed`, where we clear the state — reopening then works **(e2e)**. `AdwAlertDialog`
reports the chosen response id to `onResponse` **(e2e)**. Inside `AdwPreferencesDialog`,
`AdwPreferencesGroup` is the right container (the dialog's search and layout expect it).

```tsx
{open === 'prefs' ? (
  <AdwPreferencesDialog title="Preferences" onClosed={() => setOpen(null)}>
    <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
      <AdwPreferencesGroup title="Recording" description="Applies to new sessions">
        <AdwSwitchRow title="Record system audio" active onNotifyActive={…} />
      </AdwPreferencesGroup>
    </AdwPreferencesPage>
  </AdwPreferencesDialog>
) : null}
{open === 'about' ? (
  <AdwAboutDialog applicationName="gnomeola" version="0.1.0" licenseType={Gtk.License.GPL_3_0}
    developerName="The gnomeola contributors" onClosed={() => setOpen(null)} />
) : null}
{open === 'confirm' ? (
  <AdwAlertDialog heading="Delete Session?" body="…" closeResponse="cancel" defaultResponse="cancel"
    responses={[{ id: 'cancel', label: 'Cancel' },
                { id: 'delete', label: 'Delete', appearance: Adw.ResponseAppearance.DESTRUCTIVE }]}
    onResponse={(id) => { if (id === 'delete') remove(); setOpen(null) }} />
) : null}
```

---

## 7. Data flow

```
DataSource (daemon-source | demo-source)
   └─ SessionStore.start():  load() = health.lastSeq + listSessions(includePrivate)
                             subscribe(since = lastSeq)  → applyEvent() per durable event
                             connection: connecting → live ⇄ reconnecting | unreachable (+ retry timer)
         └─ React: useSyncExternalStore via useSessions() / useSession(id) / useConnection()
                   useEvents(handler) for every event incl. ephemeral (audio.level → level bars)
```

- Snapshot first, then events from the snapshot's cursor: nothing between the two is lost, and
  replaying upserts past the cursor converges on the latest state **(unit + e2e: after a dropped
  stream the client reconnects with `since=<last seq>` and the missed session appears)**.
- An unreachable daemon is a whole-window `AdwStatusPage` with the URL, the error, a Try Again button
  and a 5 s auto-retry — never a hang **(e2e)**.
- The demo source speaks the same event vocabulary, so the demo exercises exactly the code the
  daemon path does. It seeds three finished sessions, starts a new recording every interval, ticks
  durations and emits `audio.level` once a second, and goes quiet at `maxSessions`.

---

## 8. Testing

| tier | where | what |
| --- | --- | --- |
| unit | `packages/ui/test/*.test.ts` | formatters, the event fold, the store (fake source, demo source with hand-driven timers, daemon source over a fake `fetch`), config |
| e2e | `packages/testkit/src/ui/e2e/harness.e2e.test.ts` | the harness itself, against a 60-line PyGObject app |
| e2e | `packages/testkit/src/ui/e2e/gnomeola-ui.e2e.test.ts` | the real bundle: split view, live list, selection → detail, keyboard search, Record/Stop + meters, a11y audit, screenshots, unreachable daemon + Try Again, SSE resume via a schema-validated stub daemon, `gtkx dev` starting, the widget gallery |

Screenshots land in `packages/testkit/src/ui/e2e/__artifacts__/` (gitignored). Look at them.

**GTKX's own testing library (`@gtkx/testing`: `render`, `screen.findByRole`, `userEvent`) is not
used yet.** It is good (React-Testing-Library-style queries over GTK's in-process accessibility
tree, much faster than AT-SPI), but its supported setup is the `@gtkx/cli/vitest-plugin`, which
(a) needs vitest ≥ 4 while the repo is on 3.2, and (b) starts **sway** or **weston** per worker,
neither of which is installed here. Running it under our gnome-shell harness would need a
package-level vitest config whose global setup imports `@gnomeola/testkit/ui` — which the boundary
rule forbids from `packages/ui`. Worth revisiting when the root moves to vitest 4.

`gtkx mcp` (an MCP server exposing a running dev app's widget tree and screenshots to an agent) also
exists; not wired up.

---

## 9. Gotchas (all hit during G-1)

1. **pnpm workspace resolution** — §3. Symptoms: `Cannot resolve @gtkx/native`, `Cannot resolve
   "@gtkx/gi/gio": … not on the module resolution path`, `ERR_MODULE_NOT_FOUND … '@gtkx/gi'`.
2. **`NODE_ENV` at build time** — build with `production` or get `jsxDEV is not a function`.
3. **GTK criticals kill the app.** GTKX turns every `Gtk-CRITICAL` into an uncaught exception: an
   app started with an AT-SPI bus but no registry died at startup with `Gtk-CRITICAL: Unable to
   register the application: … org.a11y.atspi.Registry`. Treat criticals as bugs, and when the app
   "just exits", read its stderr first.
4. **Markup by default** — `AdwActionRow`/`AdwPreferencesRow` titles, `AdwStatusPage.description`,
   `AdwBanner.title`, `Adw.Toast` titles are Pango markup unless told otherwise.
5. **`AdwActionRow` children replace its content** — use `prefix`/`suffix`.
6. **`AdwButtonContent` owns the button's accessible name** (labelled-by beats `accessibleLabel`).
7. **`AdwPreferencesGroup`'s list is unnamed**; **unrevealed `AdwBanner` is still "showing"**.
8. `libraries: []` in `gtkx.config.ts` is rejected; omit the key.
9. The `Gdk-WARNING … Vulkan … VK_ERROR_INCOMPATIBLE_DRIVER` line at startup is harmless (GTK
   probes Vulkan and falls back to GL).
10. The application id is `org.gnome.Gnomeola.App`, deliberately *not* `org.gnome.Gnomeola`,
    which the plan reserves for the daemon's D-Bus interface (C-4): a GApplication owns its id as a
    bus name, so the two would collide.
