# kacola brand

Logo, app icons, fonts and design tokens for **kacola**. Everything here is generated from upstream fonts and `tokens/tokens.json`
— regenerate with:

```sh
pnpm brand           # fonts + logos + icons (python3 brand/scripts/build.py), then tokens
pnpm brand:tokens    # just tokens.css / tailwind.css from tokens.json
```

`build.py` needs `pip install --user fonttools brotli uharfbuzz` and Inkscape. Fonts are fetched from
google/fonts at a pinned commit (cached in `~/.cache/kacola-brand`); rebuilds are byte-identical. `pnpm check`
runs `brand/scripts/tokens.test.ts`: WCAG contrast of every text pair in every mode, and that the generated CSS
is current.

The live reference is **`preview.html`** (open it straight from disk; it makes no network requests): logos,
icon sizes, both palettes read live from `tokens.css`, the type scale, and every core component in light, dark
and high contrast.

## Using it in the app (Electron renderer)

```css
/* renderer entry stylesheet */
@import "tailwindcss";
@import "../../../brand/tokens/fonts.css";    /* @font-face for the bundled woff2 (relative urls) */
@import "../../../brand/tokens/tokens.css";   /* --k-* custom properties, themes, contrast, reduced motion */
@import "../../../brand/tokens/tailwind.css"; /* Tailwind v4 @theme mapping + type-* utilities */
```

- **Theme**: follows `prefers-color-scheme` by default. Set `data-theme="light"` or `"dark"` on `<html>` to
  force one (an explicit light theme beats a dark OS). The attribute also works on any subtree.
- **High contrast**: `data-contrast="high"` on `<html>`, or automatically under `prefers-contrast: more`
  unless `data-contrast="normal"`. Borders become text.secondary, text.secondary becomes text.primary, the focus
  ring turns solid record red at 2px.
- **Reduced motion**: every `--k-duration-*` becomes `0ms`; components must also drop the record pulse
  (`animation: none`) under `prefers-reduced-motion`.

Custom properties are named after the token path, with mode groups removed: `color.dark.bg.window` →
`--k-color-bg-window`, `typography.title2` → `--k-typography-title2-{family,size,line-height,weight,tracking}`,
`radius.md` → `--k-radius-md`, `shadow.light.e2` → `--k-shadow-e2`, `easing.out` → `--k-easing-out`,
`focus.ringWidth` → `--k-focus-ring-width`.

Tailwind utilities keep the full token name, so they read predictably: `bg-bg-surface`, `text-text-secondary`,
`border-border-default`, `bg-accent-record`, `bg-speaker-3/15`, `font-display` / `font-sans` / `font-editorial`
/ `font-mono`, `text-title2` (size + line height + tracking + weight), `type-overline` (the full style incl.
family and case), `rounded-md` / `rounded-pill`, `shadow-e1..e3`, `ease-out`, `animate-record-pulse`. Spacing is
the 4px grid: `p-3` = 12px, `gap-4` = 16px. Tailwind's default palette is left in place; don't use it in the app.

Speaker chips are a 14% tint of the speaker colour: `color-mix(in srgb, var(--k-color-speaker-1) 14%,
var(--k-color-bg-surface))` (Tailwind: `bg-speaker-1/14`).

## Logo usage

- **Clear space**: two dot-diameters on every side of the wordmark or lockup.
- **Minimum sizes**: icon 16px (use `icon-small.svg` at 32px and below — it is a separate drawing), wordmark
  64px wide.
- Dot is record red (`#E0482B`, `#F0603F` on dark) or the mono colour — nothing else.
- Never set the wordmark in Fraunces; never stretch, skew, outline or add effects; never put the bare k on a
  busy photo — use the icon with its tile.
- `symbolic.svg` is for tray / menu bar only (single colour, `currentColor`).

## Files

| path | what |
| --- | --- |
| `logo/icon.svg`, `icon-dark.svg` | app icon (tile + k + dot), light / dark, 1px tile edge |
| `logo/icon-mono.svg` | one-colour tile with the k and dot knocked out (print, stamps) |
| `logo/icon-small.svg` | the ≤32px drawing: Fraunces opsz 9 / wght 800, bigger k, dot on the 16px pixel grid |
| `logo/symbolic.svg` | glyph-only k + dot, 16×16, `currentColor` |
| `logo/wordmark{,-dark,-mono,-white}.svg` | "kacola." outlined; ink + red, dark, mono ink, mono white |
| `logo/lockup.svg`, `lockup-dark.svg`, `lockup-stacked.svg` | icon + wordmark (76 : 64 : gap 18), stacked |
| `icons/png/{16…1024}.png` | rasters (16/24/32 from `icon-small.svg`) |
| `icons/hicolor/<n>x<n>/apps/app.png`, `scalable/apps/app.svg`, `symbolic/apps/app-symbolic.svg` | freedesktop icon theme tree; rename `app` to the final app id at install time (e.g. `io.github.….kacola.png`) |
| `icons/kacola.icns` | macOS icon (icp4…ic14 PNG entries, body on the 824/1024 macOS grid) |
| `icons/favicon.ico` (16/32/48), `favicon.svg` | favicons; the SVG switches to the dark tile under `prefers-color-scheme: dark` |
| `fonts/*.woff2` + `*-OFL.txt` | Bricolage Grotesque, Instrument Sans (+ italic), Fraunces Italic, JetBrains Mono — variable, unsubset, SIL OFL 1.1 |
| `tokens/tokens.json` | source of truth (W3C Design Tokens) |
| `tokens/tokens.css`, `tokens/tailwind.css` | generated — do not edit |
| `tokens/fonts.css` | `@font-face` rules |
| `preview.html` | the design-language reference page |
| `scripts/build.py`, `scripts/tokens.ts`, `scripts/tokens.test.ts` | generators and the token test |

## Deviations from the spec

- `accent.recordHover` (dark) is `#E4553A`, not `#F2745A`: white label text on the spec colour is 2.83:1,
  under the 3:1 needed for bold button text. The new value (3.71:1) darkens on hover, like light mode.
- Primary (ink) buttons can't get a darker fill, so hover/pressed mix the ink 14% / 24% toward the window
  colour (in both themes) — shown in `preview.html`.
- `text.tertiary` is `#70675A` light / `#978C7B` dark (spec `#8A7F6E` / `#857A69`, 3.2–3.9:1): adjusted to 4.5:1
  on every background so hints, placeholders and timestamps meet AA.
- Added text-safe status colours `status.{success,warning,danger,info}Text` (4.5:1 on every background). The plain
  `status.*` colours are for fills, icons and marks (3:1 on window and surface; light `status.warning` is 2.99:1 on
  `bg.sidebar`, so don't put warning marks on the sidebar without a label). Destructive button text and error
  messages use `status.dangerText`.
- Added `accent.recordFill` / `accent.recordFillHover` (#C93D22 / #B3341B light, #D0401F / #C93D22 dark) for
  filled record-red surfaces that carry regular-size white text — the Record button's 15px label, a confirming
  destructive button. White on `accent.record` is 4.09:1 light / 3.26:1 dark, enough for large or bold text
  (the 3:1 the token test asks of it) but not for AA body text; the fill is darkened just enough for 5.0 / 4.7:1
  (tested at 4.5:1, and 3:1 against the window so it still reads as record red). Dots, rings, the live
  indicator and the brand dot stay `accent.record`. Tailwind: `bg-accent-record-fill`.
- Added `typography.emptyState` (Fraunces Italic 28/34, 600) so the empty-state headline has a token.
