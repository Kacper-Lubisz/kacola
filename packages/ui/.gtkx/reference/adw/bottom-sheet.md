---
description: "A bottom sheet with an optional bottom bar."
---

# AdwBottomSheet

A bottom sheet with an optional bottom bar.



`AdwBottomSheet` has three child widgets. `BottomSheet.content` is
shown persistently. `BottomSheet.sheet` is displayed above it when
it's open, and `BottomSheet.bottomBar` is displayed when it's not.

Bottom sheet and bottom bar are attached to the bottom edge of the widget.
They take the full width by default, but can only take a portion of it if
`BottomSheet.fullWidth` is set to `FALSE`. In this case,
`BottomSheet.align` determines where along the bottom edge they are
placed.

Bottom bar can be hidden using the `BottomSheet.revealBottomBar`
property.

`AdwBottomSheet` can be useful for applications such as music players, that
want to have a persistent bottom bar that expands into a bottom sheet when
clicked. It's meant for cases where a bottom sheet is tightly integrated into
the UI. For more transient bottom sheets, see `Dialog`.

To open or close the bottom sheet, use the `BottomSheet.open`
property.

By default, the bottom sheet has an overlaid drag handle. It can be disabled
by setting `BottomSheet.showDragHandle` to `FALSE`. Note that the
handle also controls whether the sheet can be dragged using a pointer.

Bottom sheets are modal by default, meaning that the content is dimmed and
cannot be accessed while the sheet is open. Set `BottomSheet.modal`
to `FALSE` if this behavior is unwanted.

To disable user interactions for opening or closing the bottom sheet (such as
swipes or clicking the bottom bar or close button), set
`BottomSheet.canOpen` or `BottomSheet.canClose` to
`FALSE`.

In some cases, particularly when using a full-width bottom bar, it may be
necessary to shift `BottomSheet.content` upwards. Use the
`BottomSheet.bottomBarHeight` and
`BottomSheet.sheetHeight` for that.

`AdwBottomSheet` is not adaptive, and for larger window sizes applications
may want to replace it with another UI, such as a sidebar. This can be done
using `MultiLayoutView`.

### Sizing

Unlike `Dialog` presented as a bottom sheet, `AdwBottomSheet` just
follows the content's natural size, and it's up to the applications to make
sure their content provides one. For example, when using
`Gtk.ScrolledWindow`, make sure to set
`Gtk.ScrolledWindow.propagateNaturalHeight` to `TRUE`.

### Header Bar Integration

When placed inside an `AdwBottomSheet`, `HeaderBar` will not show the
title when `BottomSheet.showDragHandle` is `TRUE`, regardless of
`HeaderBar.showTitle`. This only applies to the default title,
titles set with `HeaderBar.titleWidget` will still be shown.

### `AdwBottomSheet` as `GtkBuildable`:

The `AdwBottomSheet` implementation of the `Gtk.Buildable` interface
supports setting the sheet widget by specifying “sheet” as the “type”
attribute of a `<child>` element, and the bottom bar by specifying
“bottom-bar”. Specifying “content” or omitting the child type results in
setting the content child.

_Available since 1.6._

```tsx
import { AdwBottomSheet } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwBottomSheet**

Implements `AdwSwipeable`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.BottomSheet` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `align`

`number` · default `0.500000`

Horizontal alignment of the bottom sheet.

0 means the bottom sheet is flush with the start edge, 1 means it's flush
with the end edge. 0.5 means it's centered.

Only used when `BottomSheet.fullWidth` is set to `FALSE`.

_Available since 1.6._

### `bottomBar`

`Gtk.Widget | ReactElement`

The bottom bar widget.

Shown when `BottomSheet.open` is `FALSE`. When open, morphs into
the `BottomSheet.sheet`.

Bottom bar can be temporarily hidden using the
`BottomSheet.revealBottomBar` property.

_Available since 1.6._

### `bottomBarHeight`

`number` · default `0` · read-only, observe with `onNotifyBottomBarHeight`

The current bottom bar height.

It can be used to shift the content upwards permanently to accommodate for
the bottom bar.

_Available since 1.6._

### `canClose`

`boolean` · default `true`

Whether the bottom sheet can be closed by user.

It can be closed via the close button, swiping down, pressing
<kbd>Escape</kbd> or clicking the content dimming (when modal).

Bottom sheet can still be closed using `BottomSheet.open`.

_Available since 1.6._

### `canOpen`

`boolean` · default `true`

Whether the bottom sheet can be opened by user.

It can be opened via clicking or swiping up from the bottom bar.

Does nothing if `BottomSheet.bottomBar` is not set.

Bottom sheet can still be opened using `BottomSheet.open`.

_Available since 1.6._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `fullWidth`

`boolean` · default `true`

Whether the bottom sheet takes the full width.

When full width, `BottomSheet.align` is ignored.

_Available since 1.6._

### `modal`

`boolean` · default `true`

Whether the bottom sheet is modal.

When modal, `BottomSheet.content` will be dimmed when the bottom
sheet is open, and clicking it will close the bottom sheet. It also cannot
be focused with keyboard.

Otherwise, the content is accessible even when the bottom sheet is open.

_Available since 1.6._

### `open`

`boolean` · default `false`

Whether the bottom sheet is open.

_Available since 1.6._

### `revealBottomBar`

`boolean` · default `true`

Whether to reveal the bottom bar.

The transition will be animated.

See `BottomSheet.bottomBar` and
`BottomSheet.bottomBarHeight`.

_Available since 1.7._

### `sheet`

`Gtk.Widget | ReactElement`

The bottom sheet widget.

Only shown when `BottomSheet.open` is `TRUE`.

_Available since 1.6._

### `sheetHeight`

`number` · default `0` · read-only, observe with `onNotifySheetHeight`

The current bottom sheet height.

It can be used to shift the content upwards when the bottom sheet is open.

_Available since 1.6._

### `showDragHandle`

`boolean` · default `true`

Whether to overlay a drag handle in the bottom sheet.

The handle will be overlaid over `BottomSheet.sheet`.

When the handle is shown, `HeaderBar` will hide its default title,
and `ToolbarView` will reserve space if there are no top bars.

Showing drag handle also allows to swipe the bottom sheet down (and to
swipe the bottom bar up) with a pointer, instead of just touchscreen.

_Available since 1.6._

## Signals

### `onCloseAttempt`

```ts
(self: Adw.BottomSheet) => void
```

Emitted when the close button or shortcut is used while
`Dialog.canClose` is set to `FALSE`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.6._

## Methods

Methods are called on the `Adw.BottomSheet` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAlign`

```ts
getAlign(): number
```

Gets horizontal alignment of the bottom sheet.

**Returns** the horizontal alignment

_Available since 1.6._

### `getBottomBar`

```ts
getBottomBar(): Gtk.Widget | null
```

Gets the bottom bar widget for `self`.

**Returns** the bottom bar widget

_Available since 1.6._

### `getBottomBarHeight`

```ts
getBottomBarHeight(): number
```

Gets the current bottom bar height.

It can be used to shift the content upwards permanently to accommodate for
the bottom bar.

**Returns** the bottom bar height

_Available since 1.6._

### `getCanClose`

```ts
getCanClose(): boolean
```

Gets whether the bottom sheet can be closed by user.

**Returns** whether the sheet can be closed by user

_Available since 1.6._

### `getCanOpen`

```ts
getCanOpen(): boolean
```

Gets whether the bottom sheet can be opened by user.

**Returns** whether the sheet can be opened by user.

_Available since 1.6._

### `getContent`

```ts
getContent(): Gtk.Widget | null
```

Gets the content widget for `self`.

**Returns** the content widget

_Available since 1.6._

### `getFullWidth`

```ts
getFullWidth(): boolean
```

Gets whether the bottom sheet takes the full width.

**Returns** whether the sheet takes up the full width

_Available since 1.6._

### `getModal`

```ts
getModal(): boolean
```

Gets whether the bottom sheet is modal.

**Returns** whether the sheet is modal

_Available since 1.6._

### `getOpen`

```ts
getOpen(): boolean
```

Gets whether the bottom sheet is open.

**Returns** whether the sheet is open

_Available since 1.6._

### `getRevealBottomBar`

```ts
getRevealBottomBar(): boolean
```

Gets whether the bottom bar is revealed.

**Returns** whether the bottom bar is revealed

_Available since 1.7._

### `getSheet`

```ts
getSheet(): Gtk.Widget | null
```

Gets the bottom sheet widget for `self`.

**Returns** the sheet widget

_Available since 1.6._

### `getSheetHeight`

```ts
getSheetHeight(): number
```

Gets the current bottom sheet height.

It can be used to shift the content upwards when the bottom sheet is open.

**Returns** the sheet height

_Available since 1.6._

### `getShowDragHandle`

```ts
getShowDragHandle(): boolean
```

Gets whether to show a drag handle in the bottom sheet.

**Returns** whether to show the drag handle

_Available since 1.6._

### `setAlign`

```ts
setAlign(align: number): void
```

Sets horizontal alignment of the bottom sheet.

0 means the bottom sheet is flush with the start edge, 1 means it's flush
with the end edge. 0.5 means it's centered.

Only used when `BottomSheet.fullWidth` is set to `FALSE`.

**Parameters**

- `align`: the new alignment

_Available since 1.6._

### `setBottomBar`

```ts
setBottomBar(bottomBar: Gtk.Widget | null): void
```

Sets the bottom bar widget for `self`.

Shown when `BottomSheet.open` is `FALSE`. When open, morphs into
the `BottomSheet.sheet`.

Bottom bar can be temporarily hidden using the
`BottomSheet.revealBottomBar` property.

**Parameters**

- `bottomBar`: the bottom bar widget

_Available since 1.6._

### `setCanClose`

```ts
setCanClose(canClose: boolean): void
```

Sets whether the bottom sheet can be closed by user.

It can be closed via the close button, swiping down, pressing
<kbd>Escape</kbd> or clicking the content dimming (when modal).

Bottom sheet can still be closed using `BottomSheet.open`.

**Parameters**

- `canClose`: whether the sheet can be closed by user

_Available since 1.6._

### `setCanOpen`

```ts
setCanOpen(canOpen: boolean): void
```

Sets whether the bottom sheet can be opened by user.

It can be opened via clicking or swiping up from the bottom bar.

Does nothing if `BottomSheet.bottomBar` is not set.

Bottom sheet can still be opened using `BottomSheet.open`.

**Parameters**

- `canOpen`: whether the sheet can be opened by user.

_Available since 1.6._

### `setContent`

```ts
setContent(content: Gtk.Widget | null): void
```

Sets the content widget for `self`.

It's always shown, and the bottom sheet is overlaid over it.

**Parameters**

- `content`: the content widget

_Available since 1.6._

### `setFullWidth`

```ts
setFullWidth(fullWidth: boolean): void
```

Sets whether the bottom sheet takes the full width.

When full width, `BottomSheet.align` is ignored.

**Parameters**

- `fullWidth`: whether the sheet takes up the full width

_Available since 1.6._

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the bottom sheet is modal.

When modal, `BottomSheet.content` will be dimmed when the bottom
sheet is open, and clicking it will close the bottom sheet. It also cannot be
focused with keyboard.

Otherwise, the content is accessible even when the bottom sheet is open.

**Parameters**

- `modal`: whether the sheet is modal

_Available since 1.6._

### `setOpen`

```ts
setOpen(open: boolean): void
```

Sets whether the bottom sheet is open.

**Parameters**

- `open`: whether to open the sheet

_Available since 1.6._

### `setRevealBottomBar`

```ts
setRevealBottomBar(reveal: boolean): void
```

Sets whether to reveal the bottom bar.

The transition will be animated.

See `BottomSheet.bottomBar` and
`BottomSheet.bottomBarHeight`.

**Parameters**

- `reveal`: whether to reveal the bottom bar

_Available since 1.7._

### `setSheet`

```ts
setSheet(sheet: Gtk.Widget | null): void
```

Sets the bottom sheet widget for `self`.

Only shown when `BottomSheet.open` is `TRUE`.

**Parameters**

- `sheet`: the sheet widget

_Available since 1.6._

### `setShowDragHandle`

```ts
setShowDragHandle(showDragHandle: boolean): void
```

Sets whether to show a drag handle in the bottom sheet.

The handle will be overlaid over `BottomSheet.sheet`.

When the handle is shown, `HeaderBar` will hide its default title, and
`ToolbarView` will reserve space if there are no top bars.

Showing drag handle also allows to swipe the bottom sheet down (and to swipe
the bottom bar up) with a pointer, instead of just touchscreen.

**Parameters**

- `showDragHandle`: whether to show the drag handle

_Available since 1.6._
