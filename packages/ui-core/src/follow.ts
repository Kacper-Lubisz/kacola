// "Follow the live end" for a scrolling view whose content grows (the live transcript, a streaming
// answer). Pure logic over the scroll adjustment's numbers, so it is unit-tested without GTK.
//
// The rule is about intent, not position:
//   - the user scrolling up (wheel/touchpad, Up/Page Up/Home, or dragging the scrollbar more than a
//     page) detaches;
//   - reaching the bottom (scrolling, End, Jump to Live) re-attaches;
//   - content growing while attached re-pins the view to the bottom.
// A position-only rule ("attached iff within N px of the bottom") fails on a GtkListView, which
// re-estimates row heights as it measures them: the scroll value drifts by a row or two with nobody
// touching anything, and the view detached itself (seen twice in the e2e run: Jump to Live never
// went away, then showed up while nobody had scrolled).

export const NEAR_BOTTOM_PX = 32

/** Keys that move a list or scrolled window up (GDK keyvals). */
export const UP_KEYS: ReadonlySet<number> = new Set([
  0xff52, // Up
  0xff55, // Page_Up
  0xff50, // Home
  0xff97, // KP_Up
  0xff9a, // KP_Page_Up
  0xff95, // KP_Home
])

export class Follow {
  following: boolean
  private last = 0

  constructor(following: boolean) {
    this.following = following
  }

  /** The adjustment's value changed (for whatever reason). */
  scrolled(value: number, upper: number, pageSize: number): boolean {
    if (value >= upper - pageSize - NEAR_BOTTOM_PX) this.following = true
    // more than a page up at once and not by a key or wheel we saw: a scrollbar drag
    else if (value < this.last - pageSize) this.following = false
    this.last = value
    return this.following
  }

  /** The content or viewport changed size: where to pin the view, or null to leave it. */
  resized(value: number, upper: number, pageSize: number): number | null {
    const bottom = Math.max(0, upper - pageSize)
    if (!this.following || value >= bottom) return null
    this.last = bottom
    return bottom
  }

  /** Wheel/touchpad delta (positive = down) or a key press on the view. */
  userScrolled(dy: number): void {
    if (dy < 0) this.following = false
  }

  userKey(keyval: number): void {
    if (UP_KEYS.has(keyval)) this.following = false
  }

  /** Jump to Live: follow again. */
  attach(): void {
    this.following = true
  }

  /** Something else took the view (a followed citation). */
  detach(): void {
    this.following = false
  }
}
