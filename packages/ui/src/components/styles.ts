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
    .speaker-chip { padding: 1px 8px; border-radius: 9px; }
    /* the user: an outlined chip in the accent colour, unlike any far-end speaker's filled one */
    .speaker-me { color: var(--accent-color); box-shadow: inset 0 0 0 1px alpha(var(--accent-color), 0.6); }
    .speaker-them { color: alpha(currentColor, 0.7); background: alpha(currentColor, 0.06); }
    /* M3: far-end speakers, by the daemon's palette slot (Speaker.colour mod 8, never the list order) */
    .speaker-c0 { color: @blue_4; background: alpha(@blue_3, 0.14); }
    .speaker-c1 { color: @orange_5; background: alpha(@orange_3, 0.16); }
    .speaker-c2 { color: @green_5; background: alpha(@green_3, 0.14); }
    .speaker-c3 { color: @purple_3; background: alpha(@purple_3, 0.14); }
    .speaker-c4 { color: @red_3; background: alpha(@red_3, 0.12); }
    .speaker-c5 { color: @brown_2; background: alpha(@brown_2, 0.16); }
    .speaker-c6 { color: @yellow_5; background: alpha(@yellow_3, 0.18); }
    .speaker-c7 { color: @dark_1; background: alpha(@light_5, 0.5); }
    image.speaker-swatch { padding: 6px; border-radius: 50%; }
    .speakers-error { color: @red_3; }
    .line-actions { padding: 6px 18px 6px 12px; border-top: 1px solid alpha(currentColor, 0.1); }
    .transcript-text.provisional { font-style: italic; opacity: 0.72; }
    .transcript-text.partial { font-style: italic; opacity: 0.55; }
    .transcript > row:selected .transcript-line {
      box-shadow: inset 3px 0 var(--accent-bg-color);
    }
    .jump-to-live { margin: 12px; }
    popover.menu button.menu-entry { padding: 6px 12px; margin: 0 6px; font-weight: normal; }
    .qa-question { font-weight: bold; }
    .qa-answer { padding-top: 2px; }
    .citation-chip { min-height: 24px; padding: 0 8px; border-radius: 12px; font-size: smaller; }
    .qa-notice { padding: 6px 10px; border-radius: 8px; background: alpha(currentColor, 0.06); }
    .qa-notice.qa-refusal { background: alpha(@orange_3, 0.18); }
    .qa-notice.qa-error { background: alpha(@red_3, 0.12); }
    .qa-notice.qa-info { background: alpha(@blue_3, 0.12); }
    .notes-editor { font-size: 1.05em; }
    .notes-editor, .notes-editor > text { background: transparent; }
    .review-change { padding: 12px; }
    .review-side { padding: 8px; border-radius: 6px; }
    .review-side.chosen { background: alpha(var(--accent-bg-color), 0.12); }
    .review-side:not(.chosen) label:not(.caption-heading) { opacity: 0.6; }
    .review-same { padding: 0 12px; }
  `)
}
