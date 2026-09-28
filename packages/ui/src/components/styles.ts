import { injectGlobal } from '@gtkx/css'

// App-wide style classes, on top of libadwaita's. Colours come from the Adwaita palette and CSS
// variables so they follow light/dark and the accent colour. Loaded once, from app.tsx.

let installed = false

export function installStyles(): void {
  if (installed) return
  installed = true
  injectGlobal(`
    .transcript { background: transparent; }
    .transcript > row { padding: 0; }
    .transcript-line { padding: 3px 18px 3px 12px; }
    .transcript-line.group-start { padding-top: 12px; }
    .transcript-time { font-feature-settings: "tnum"; min-width: 4em; }
    .speaker { font-weight: bold; }
    .speaker-me { color: var(--accent-color); }
    .speaker-them { color: @purple_4; }
    .transcript-text.provisional { font-style: italic; opacity: 0.72; }
    .transcript-text.partial { font-style: italic; opacity: 0.55; }
    .transcript > row:selected .transcript-line {
      box-shadow: inset 3px 0 var(--accent-bg-color);
    }
    .jump-to-live { margin: 12px; }
    .qa-question { font-weight: bold; }
    .qa-answer { padding-top: 2px; }
    .citation-chip { min-height: 24px; padding: 0 8px; border-radius: 12px; font-size: smaller; }
    .qa-notice { padding: 6px 10px; border-radius: 8px; background: alpha(currentColor, 0.06); }
    .qa-notice.refusal { background: alpha(@orange_3, 0.18); }
    .qa-notice.error { background: alpha(@red_3, 0.15); }
  `)
}
