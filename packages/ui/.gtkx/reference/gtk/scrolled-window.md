---
description: "Makes its child scrollable."
---

# GtkScrolledWindow

Makes its child scrollable.



It does so using either internally added scrollbars or externally
associated adjustments, and optionally draws a frame around the child.

Widgets with native scrolling support, i.e. those whose classes implement
the `Gtk.Scrollable` interface, are added directly. For other types
of widget, the class `Gtk.Viewport` acts as an adaptor, giving
scrollability to other widgets. `Gtk.ScrolledWindow.setChild()`
intelligently accounts for whether or not the added child is a `GtkScrollable`.
If it isn’t, then it wraps the child in a `GtkViewport`. Therefore, you can
just add any child widget and not worry about the details.

If `Gtk.ScrolledWindow.setChild()` has added a `GtkViewport` for you,
it will be automatically removed when you unset the child.
Unless `Gtk.ScrolledWindow.hscrollbarPolicy` and
`Gtk.ScrolledWindow.vscrollbarPolicy` are `GTK_POLICY_NEVER` or
`GTK_POLICY_EXTERNAL`, `GtkScrolledWindow` adds internal `GtkScrollbar` widgets
around its child. The scroll position of the child, and if applicable the
scrollbars, is controlled by the `Gtk.ScrolledWindow.hadjustment`
and `Gtk.ScrolledWindow.vadjustment` that are associated with the
`GtkScrolledWindow`. See the docs on `Gtk.Scrollbar` for the details,
but note that the “step_increment” and “page_increment” fields are only
effective if the policy causes scrollbars to be present.

If a `GtkScrolledWindow` doesn’t behave quite as you would like, or
doesn’t have exactly the right layout, it’s very possible to set up
your own scrolling with `GtkScrollbar` and for example a `GtkGrid`.

## Touch support

`GtkScrolledWindow` has built-in support for touch devices. When a
touchscreen is used, swiping will move the scrolled window, and will
expose 'kinetic' behavior. This can be turned off with the
`Gtk.ScrolledWindow.kineticScrolling` property if it is undesired.

`GtkScrolledWindow` also displays visual 'overshoot' indication when
the content is pulled beyond the end, and this situation can be
captured with the `Gtk.ScrolledWindow.edge-overshot` signal.

If no mouse device is present, the scrollbars will overlaid as
narrow, auto-hiding indicators over the content. If traditional
scrollbars are desired although no mouse is present, this behaviour
can be turned off with the `Gtk.ScrolledWindow.overlayScrolling`
property.

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.ScrolledWindow.scroll-child`

## CSS nodes

`GtkScrolledWindow` has a main CSS node with name scrolledwindow.
It gets a .frame style class added when `Gtk.ScrolledWindow.hasFrame`
is `true`.

It uses subnodes with names overshoot and undershoot to draw the overflow
and underflow indications. These nodes get the .left, .right, .top or .bottom
style class added depending on where the indication is drawn.

`GtkScrolledWindow` also sets the positional style classes (.left, .right,
.top, .bottom) and style classes related to overlay scrolling
(.overlay-indicator, .dragging, .hovering) on its scrollbars.

If both scrollbars are visible, the area where they meet is drawn
with a subnode named junction.

## Accessibility

Until GTK 4.10, `GtkScrolledWindow` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkScrolledWindow` uses the `Gtk.AccessibleRole.generic`
role.

```tsx
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkScrolledWindow**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ScrolledWindow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `hadjustment`

`Gtk.Adjustment | ReactElement`

The `GtkAdjustment` for the horizontal position.

### `hasFrame`

`boolean` · default `false`

Whether to draw a frame around the contents.

### `hscrollbarPolicy`

`Gtk.PolicyType` · default `GTK_POLICY_AUTOMATIC`

When the horizontal scrollbar is displayed.

Use `Gtk.ScrolledWindow.setPolicy()` to set
this property.

### `kineticScrolling`

`boolean` · default `true`

Whether kinetic scrolling is enabled or not.

Kinetic scrolling only applies to devices with source `GDK_SOURCE_TOUCHSCREEN`.

### `maxContentHeight`

`number` · default `-1`

The maximum content height of `scrolled_window`.

### `maxContentWidth`

`number` · default `-1`

The maximum content width of `scrolled_window`.

### `minContentHeight`

`number` · default `-1`

The minimum content height of `scrolled_window`.

### `minContentWidth`

`number` · default `-1`

The minimum content width of `scrolled_window`.

### `overlayScrolling`

`boolean` · default `true`

Whether overlay scrolling is enabled or not.

If it is, the scrollbars are only added as traditional widgets
when a mouse is present. Otherwise, they are overlaid on top of
the content, as narrow indicators.

Note that overlay scrolling can also be globally disabled, with
the `Gtk.Settings.gtkOverlayScrolling` setting.

### `propagateNaturalHeight`

`boolean` · default `false`

Whether the natural height of the child should be calculated and propagated
through the scrolled window’s requested natural height.

This is useful in cases where an attempt should be made to allocate exactly
enough space for the natural size of the child.

### `propagateNaturalWidth`

`boolean` · default `false`

Whether the natural width of the child should be calculated and propagated
through the scrolled window’s requested natural width.

This is useful in cases where an attempt should be made to allocate exactly
enough space for the natural size of the child.

### `vadjustment`

`Gtk.Adjustment | ReactElement`

The `GtkAdjustment` for the vertical position.

### `vscrollbarPolicy`

`Gtk.PolicyType` · default `GTK_POLICY_AUTOMATIC`

When the vertical scrollbar is displayed.

Use `Gtk.ScrolledWindow.setPolicy()` to set
this property.

### `windowPlacement`

`Gtk.CornerType` · default `GTK_CORNER_TOP_LEFT`

Where the contents are located with respect to the scrollbars.

## Signals

### `onEdgeOvershot`

```ts
(pos: Gtk.PositionType, self: Gtk.ScrolledWindow) => void
```

Emitted whenever user initiated scrolling makes the scrolled
window firmly surpass the limits defined by the adjustment
in that orientation.

A similar behavior without edge resistance is provided by the
`Gtk.ScrolledWindow.edge-reached` signal.

Note: The `pos` argument is LTR/RTL aware, so callers should be
aware too if intending to provide behavior on horizontal edges.

**Parameters**

- `pos`: edge side that was hit
- `self`: The instance the signal was emitted on.

### `onEdgeReached`

```ts
(pos: Gtk.PositionType, self: Gtk.ScrolledWindow) => void
```

Emitted whenever user-initiated scrolling makes the scrolled
window exactly reach the lower or upper limits defined by the
adjustment in that orientation.

A similar behavior with edge resistance is provided by the
`Gtk.ScrolledWindow.edge-overshot` signal.

Note: The `pos` argument is LTR/RTL aware, so callers should be
aware too if intending to provide behavior on horizontal edges.

**Parameters**

- `pos`: edge side that was reached
- `self`: The instance the signal was emitted on.

### `onMoveFocusOut`

```ts
(directionType: Gtk.DirectionType, self: Gtk.ScrolledWindow) => void
```

Emitted when focus is moved away from the scrolled window by a
keybinding.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>Tab</kbd> to move forward and
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd>` to move backward.

**Parameters**

- `directionType`: either `GTK_DIR_TAB_FORWARD` or `GTK_DIR_TAB_BACKWARD`
- `self`: The instance the signal was emitted on.

### `onScrollChild`

```ts
(scroll: Gtk.ScrollType, horizontal: boolean, self: Gtk.ScrolledWindow) => boolean | undefined
```

Emitted when a keybinding that scrolls is pressed.

This is a [keybinding signal](class.SignalAction.html).

The horizontal or vertical adjustment is updated which triggers a
signal that the scrolled window’s child may listen to and scroll itself.

**Parameters**

- `scroll`: a `GtkScrollType` describing how much to scroll
- `horizontal`: whether the keybinding scrolls the child horizontally or not
- `self`: The instance the signal was emitted on.

**Returns** whether the scroll happened

## Methods

Methods are called on the `Gtk.ScrolledWindow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `scrolled_window`.

If the scrolled window automatically added a `Gtk.Viewport`, this
function will return the viewport widget, and you can retrieve its child
using `Gtk.Viewport.getChild()`.

**Returns** the child widget of `scrolled_window`

### `getHadjustment`

```ts
getHadjustment(): Gtk.Adjustment
```

Returns the horizontal scrollbar’s adjustment.

This is the adjustment used to connect the horizontal scrollbar
to the child widget’s horizontal scroll functionality.

**Returns** the horizontal `GtkAdjustment`

### `getHasFrame`

```ts
getHasFrame(): boolean
```

Gets whether the scrolled window draws a frame.

**Returns** `true` if the `scrolled_window` has a frame

### `getHscrollbar`

```ts
getHscrollbar(): Gtk.Widget
```

Returns the horizontal scrollbar of `scrolled_window`.

**Returns** the horizontal scrollbar of the scrolled window.

### `getKineticScrolling`

```ts
getKineticScrolling(): boolean
```

Returns the specified kinetic scrolling behavior.

**Returns** the scrolling behavior flags.

### `getMaxContentHeight`

```ts
getMaxContentHeight(): number
```

Returns the maximum content height set.

**Returns** the maximum content height, or -1

### `getMaxContentWidth`

```ts
getMaxContentWidth(): number
```

Returns the maximum content width set.

**Returns** the maximum content width, or -1

### `getMinContentHeight`

```ts
getMinContentHeight(): number
```

Gets the minimal content height of `scrolled_window`.

**Returns** the minimal content height

### `getMinContentWidth`

```ts
getMinContentWidth(): number
```

Gets the minimum content width of `scrolled_window`.

**Returns** the minimum content width

### `getOverlayScrolling`

```ts
getOverlayScrolling(): boolean
```

Returns whether overlay scrolling is enabled for this scrolled window.

**Returns** `true` if overlay scrolling is enabled

### `getPlacement`

```ts
getPlacement(): Gtk.CornerType
```

Gets the placement of the contents with respect to the scrollbars.

**Returns** the current placement value.

### `getPolicy`

```ts
getPolicy(): [Gtk.PolicyType, Gtk.PolicyType]
```

Retrieves the current policy values for the horizontal and vertical
scrollbars.

See `Gtk.ScrolledWindow.setPolicy()`.

**Returns** Tuple of:

- `hscrollbarPolicy`: location to store the policy for the horizontal scrollbar
- `vscrollbarPolicy`: location to store the policy for the vertical scrollbar

### `getPropagateNaturalHeight`

```ts
getPropagateNaturalHeight(): boolean
```

Reports whether the natural height of the child will be calculated
and propagated through the scrolled window’s requested natural height.

**Returns** whether natural height propagation is enabled.

### `getPropagateNaturalWidth`

```ts
getPropagateNaturalWidth(): boolean
```

Reports whether the natural width of the child will be calculated
and propagated through the scrolled window’s requested natural width.

**Returns** whether natural width propagation is enabled.

### `getVadjustment`

```ts
getVadjustment(): Gtk.Adjustment
```

Returns the vertical scrollbar’s adjustment.

This is the adjustment used to connect the vertical
scrollbar to the child widget’s vertical scroll functionality.

**Returns** the vertical `GtkAdjustment`

### `getVscrollbar`

```ts
getVscrollbar(): Gtk.Widget
```

Returns the vertical scrollbar of `scrolled_window`.

**Returns** the vertical scrollbar of the scrolled window.

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `scrolled_window`.

If `child` does not implement the `Gtk.Scrollable` interface,
the scrolled window will add `child` to a `Gtk.Viewport` instance
and then add the viewport as its child widget.

**Parameters**

- `child`: the child widget

### `setHadjustment`

```ts
setHadjustment(hadjustment: Gtk.Adjustment | null): void
```

Sets the `GtkAdjustment` for the horizontal scrollbar.

**Parameters**

- `hadjustment`: the `GtkAdjustment` to use, or `null` to create a new one

### `setHasFrame`

```ts
setHasFrame(hasFrame: boolean): void
```

Changes the frame drawn around the contents of `scrolled_window`.

**Parameters**

- `hasFrame`: whether to draw a frame around scrolled window contents

### `setKineticScrolling`

```ts
setKineticScrolling(kineticScrolling: boolean): void
```

Turns kinetic scrolling on or off.

Kinetic scrolling only applies to devices with source
`GDK_SOURCE_TOUCHSCREEN`.

**Parameters**

- `kineticScrolling`: `true` to enable kinetic scrolling

### `setMaxContentHeight`

```ts
setMaxContentHeight(height: number): void
```

Sets the maximum height that `scrolled_window` should keep visible.

The `scrolled_window` will grow up to this height before it starts
scrolling the content.

It is a programming error to set the maximum content height to a value
smaller than `Gtk.ScrolledWindow.minContentHeight`.

**Parameters**

- `height`: the maximum content height

### `setMaxContentWidth`

```ts
setMaxContentWidth(width: number): void
```

Sets the maximum width that `scrolled_window` should keep visible.

The `scrolled_window` will grow up to this width before it starts
scrolling the content.

It is a programming error to set the maximum content width to a
value smaller than `Gtk.ScrolledWindow.minContentWidth`.

**Parameters**

- `width`: the maximum content width

### `setMinContentHeight`

```ts
setMinContentHeight(height: number): void
```

Sets the minimum height that `scrolled_window` should keep visible.

Note that this can and (usually will) be smaller than the minimum
size of the content.

It is a programming error to set the minimum content height to a
value greater than `Gtk.ScrolledWindow.maxContentHeight`.

**Parameters**

- `height`: the minimal content height

### `setMinContentWidth`

```ts
setMinContentWidth(width: number): void
```

Sets the minimum width that `scrolled_window` should keep visible.

Note that this can and (usually will) be smaller than the minimum
size of the content.

It is a programming error to set the minimum content width to a
value greater than `Gtk.ScrolledWindow.maxContentWidth`.

**Parameters**

- `width`: the minimal content width

### `setOverlayScrolling`

```ts
setOverlayScrolling(overlayScrolling: boolean): void
```

Enables or disables overlay scrolling for this scrolled window.

**Parameters**

- `overlayScrolling`: whether to enable overlay scrolling

### `setPlacement`

```ts
setPlacement(windowPlacement: Gtk.CornerType): void
```

Sets the placement of the contents with respect to the scrollbars
for the scrolled window.

The default is `GTK_CORNER_TOP_LEFT`, meaning the child is
in the top left, with the scrollbars underneath and to the right.
Other values in `Gtk.CornerType` are `GTK_CORNER_TOP_RIGHT`,
`GTK_CORNER_BOTTOM_LEFT`, and `GTK_CORNER_BOTTOM_RIGHT`.

See also `Gtk.ScrolledWindow.getPlacement()` and
`Gtk.ScrolledWindow.unsetPlacement()`.

**Parameters**

- `windowPlacement`: position of the child window

### `setPolicy`

```ts
setPolicy(hscrollbarPolicy: Gtk.PolicyType, vscrollbarPolicy: Gtk.PolicyType): void
```

Sets the scrollbar policy for the horizontal and vertical scrollbars.

The policy determines when the scrollbar should appear; it is a value
from the `Gtk.PolicyType` enumeration. If `GTK_POLICY_ALWAYS`, the
scrollbar is always present; if `GTK_POLICY_NEVER`, the scrollbar is
never present; if `GTK_POLICY_AUTOMATIC`, the scrollbar is present only
if needed (that is, if the slider part of the bar would be smaller
than the trough — the display is larger than the page size).

**Parameters**

- `hscrollbarPolicy`: policy for horizontal bar
- `vscrollbarPolicy`: policy for vertical bar

### `setPropagateNaturalHeight`

```ts
setPropagateNaturalHeight(propagate: boolean): void
```

Sets whether the natural height of the child should be calculated
and propagated through the scrolled window’s requested natural height.

**Parameters**

- `propagate`: whether to propagate natural height

### `setPropagateNaturalWidth`

```ts
setPropagateNaturalWidth(propagate: boolean): void
```

Sets whether the natural width of the child should be calculated
and propagated through the scrolled window’s requested natural width.

**Parameters**

- `propagate`: whether to propagate natural width

### `setVadjustment`

```ts
setVadjustment(vadjustment: Gtk.Adjustment | null): void
```

Sets the `GtkAdjustment` for the vertical scrollbar.

**Parameters**

- `vadjustment`: the `GtkAdjustment` to use, or `null` to create a new one

### `unsetPlacement`

```ts
unsetPlacement(): void
```

Unsets the placement of the contents with respect to the scrollbars.

If no window placement is set for a scrolled window,
it defaults to `GTK_CORNER_TOP_LEFT`.
