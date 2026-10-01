---
description: "An adaptive dialog container."
---

# AdwDialog

An adaptive dialog container.




`AdwDialog` is similar to a window, but is shown within another window. It
can be used with `Window` and `ApplicationWindow`, use
`Dialog.present()` to show it.

`AdwDialog` is not resizable. Use the `Dialog.contentWidth` and
`Dialog.contentHeight` properties to set its size, or set
`Dialog.followsContentSize` to `TRUE` to make the dialog track the
content's size as it changes. `AdwDialog` can never be larger than its parent
window.

`AdwDialog` can be presented as a centered floating window or a bottom sheet.
By default it's automatic depending on the available size.
`Dialog.presentationMode` can be used to change that.

`AdwDialog` can be closed via `Dialog.close()`.

When presented as a bottom sheet, `AdwDialog` can also be closed via swiping
it down.

The `Dialog.canClose` can be used to prevent closing. In that case,
`Dialog.close-attempt` gets emitted instead.

Use `Dialog.forceClose()` to close the dialog even when `can-close` is set to
`FALSE`.

`AdwDialog` is transient and doesn't integrate with the window below it, for
example it's not possible to collapse it into a bottom bar. See
`BottomSheet` for persistent and more tightly integrated bottom sheets.

### Header Bar Integration

When placed inside an `AdwDialog`, `HeaderBar` will display the dialog
title instead of window title. It will also adjust the decoration layout to
ensure it always has a close button and nothing else. Set
`HeaderBar.showStartTitleButtons` and
`HeaderBar.showEndTitleButtons` to `FALSE` to remove it if it's
unwanted.

### Breakpoints

`AdwDialog` can be used with `Breakpoint` the same way as
`BreakpointBin`. Refer to that widget's documentation for details.

Like `AdwBreakpointBin`, if breakpoints are used, `AdwDialog` doesn't have a
minimum size, and `Gtk.Widget.widthRequest` and
`Gtk.Widget.heightRequest` properties must be set manually.

_Available since 1.5._

```tsx
import { AdwDialog } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.Dialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `breakpoints`

`ReactNode | null`

`Adw.Breakpoint` elements added to the element, each applying while its condition holds.

### `canClose`

`boolean` · default `true`

Whether the dialog can be closed.

If set to `FALSE`, the close button, shortcuts and
`Dialog.close()` will result in `Dialog.close-attempt` being
emitted instead, and bottom sheet close swipe will be disabled.
`Dialog.forceClose()` still works.

_Available since 1.5._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `contentHeight`

`number` · default `-1`

The height of the dialog's contents.

Set it to -1 to reset it to the content's natural height.

See also: `Gtk.Window.defaultHeight`

_Available since 1.5._

### `contentWidth`

`number` · default `-1`

The width of the dialog's contents.

Set it to -1 to reset it to the content's natural width.

See also: `Gtk.Window.defaultWidth`

_Available since 1.5._

### `currentBreakpoint`

`Adw.Breakpoint` · read-only, observe with `onNotifyCurrentBreakpoint`

The current breakpoint.

_Available since 1.5._

### `defaultWidget`

`Gtk.Widget | ReactElement`

The default widget.

It's activated when the user presses Enter.

_Available since 1.5._

### `focusWidget`

`Gtk.Widget | ReactElement`

The focus widget.

_Available since 1.5._

### `followsContentSize`

`boolean` · default `false`

Whether to size content automatically.

If set to `TRUE`, always use the content's natural size instead of
`Dialog.contentWidth` and `Dialog.contentHeight`. If
the content resizes, the dialog will immediately resize as well.

See also: `Gtk.Window.resizable`

_Available since 1.5._

### `presentationMode`

`Adw.DialogPresentationMode` · default `ADW_DIALOG_AUTO`

The dialog's presentation mode.

When set to `Adw.DialogPresentationMode.auto`, the dialog appears as a
bottom sheet when the following condition is met:
`max-width: 450px or max-height: 360px`, and as a floating window otherwise.

Set it to `Adw.DialogPresentationMode.floating` or
`Adw.DialogPresentationMode.bottom-sheet` to always present it a
floating window or a bottom sheet respectively, regardless of available
size.

Presentation mode does nothing for dialogs presented as a window.

_Available since 1.5._

### `title`

`string`

The title of the dialog.

_Available since 1.5._

## Signals

### `onCloseAttempt`

```ts
(self: Adw.Dialog) => void
```

Emitted when the close button or shortcut is used, or
`Dialog.close()` is called while `Dialog.canClose` is set to
`FALSE`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.5._

### `onClosed`

```ts
(self: Adw.Dialog) => void
```

Emitted when the dialog is successfully closed.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.5._

## Methods

Methods are called on the `Adw.Dialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addBreakpoint`

```ts
addBreakpoint(breakpoint: Adw.Breakpoint): void
```

Adds `breakpoint` to `self`.

**Parameters**

- `breakpoint`: the breakpoint to add

_Available since 1.5._

### `close`

```ts
close(): boolean
```

Attempts to close `self`.

If the `Dialog.canClose` property is set to `FALSE`, the
`Dialog.close-attempt` signal is emitted.

See also: `Dialog.forceClose()`.

**Returns** whether `self` was successfully closed

_Available since 1.5._

### `forceClose`

```ts
forceClose(): void
```

Closes `self`.

Unlike `Dialog.close()`, it succeeds even if `Dialog.canClose`
is set to `FALSE`.

_Available since 1.5._

### `getCanClose`

```ts
getCanClose(): boolean
```

Gets whether `self` can be closed.

**Returns** whether the dialog can be closed

_Available since 1.5._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

_Available since 1.5._

### `getContentHeight`

```ts
getContentHeight(): number
```

Gets the height of the dialog's contents.

**Returns** the content height

_Available since 1.5._

### `getContentWidth`

```ts
getContentWidth(): number
```

Gets the width of the dialog's contents.

**Returns** the content width

_Available since 1.5._

### `getCurrentBreakpoint`

```ts
getCurrentBreakpoint(): Adw.Breakpoint | null
```

Gets the current breakpoint.

**Returns** the current breakpoint

_Available since 1.5._

### `getDefaultWidget`

```ts
getDefaultWidget(): Gtk.Widget | null
```

Gets the default widget for `self`.

**Returns** the default widget

_Available since 1.5._

### `getFocus`

```ts
getFocus(): Gtk.Widget | null
```

Gets the focus widget for `self`.

**Returns** the focus widget

_Available since 1.5._

### `getFollowsContentSize`

```ts
getFollowsContentSize(): boolean
```

Gets whether to size content of `self` automatically.

**Returns** whether to size content automatically

_Available since 1.5._

### `getPresentationMode`

```ts
getPresentationMode(): Adw.DialogPresentationMode
```

Gets presentation mode for `self`.

**Returns** the presentation mode

_Available since 1.5._

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title

_Available since 1.5._

### `present`

```ts
present(parent: Gtk.Widget | null): void
```

Presents `self` within `parent`'s window.

If `self` is already shown, raises it to the top instead.

If the window is an `Window` or `ApplicationWindow`, the dialog
will be shown within it. Otherwise, it will be a separate window.

**Parameters**

- `parent`: a widget within the toplevel

_Available since 1.5._

### `setCanClose`

```ts
setCanClose(canClose: boolean): void
```

Sets whether `self` can be closed.

If set to `FALSE`, the close button, shortcuts and
`Dialog.close()` will result in `Dialog.close-attempt` being
emitted instead, and bottom sheet close swipe will be disabled.
`Dialog.forceClose()` still works.

**Parameters**

- `canClose`: whether to allow closing

_Available since 1.5._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

_Available since 1.5._

### `setContentHeight`

```ts
setContentHeight(contentHeight: number): void
```

Sets the height of the dialog's contents.

Set it to -1 to reset it to the content's natural height.

See also: `Gtk.Window.defaultHeight`

**Parameters**

- `contentHeight`: the content height

_Available since 1.5._

### `setContentWidth`

```ts
setContentWidth(contentWidth: number): void
```

Sets the width of the dialog's contents.

Set it to -1 to reset it to the content's natural width.

See also: `Gtk.Window.defaultWidth`

**Parameters**

- `contentWidth`: the content width

_Available since 1.5._

### `setDefaultWidget`

```ts
setDefaultWidget(defaultWidget: Gtk.Widget | null): void
```

Sets the default widget for `self`.

It's activated when the user presses Enter.

**Parameters**

- `defaultWidget`: the default widget

_Available since 1.5._

### `setFocus`

```ts
setFocus(focus: Gtk.Widget | null): void
```

Sets the focus widget for `self`.

If `focus` is not the current focus widget, and is focusable, sets it as the
focus widget for the dialog.

If focus is `NULL`, unsets the focus widget for this dialog. To set the focus
to a particular widget in the dialog, it is usually more convenient to use
`Gtk.Widget.grabFocus()` instead of this function.

**Parameters**

- `focus`: the focus widget

_Available since 1.5._

### `setFollowsContentSize`

```ts
setFollowsContentSize(followsContentSize: boolean): void
```

Sets whether to size content of `self` automatically.

If set to `TRUE`, always use the content's natural size instead of
`Dialog.contentWidth` and `Dialog.contentHeight`. If
the content resizes, the dialog will immediately resize as well.

See also: `Gtk.Window.resizable`

**Parameters**

- `followsContentSize`: whether to size content automatically

_Available since 1.5._

### `setPresentationMode`

```ts
setPresentationMode(presentationMode: Adw.DialogPresentationMode): void
```

Sets presentation mode for `self`.

When set to `Adw.DialogPresentationMode.auto`, the dialog appears as a
bottom sheet when the following condition is met:
`max-width: 450px or max-height: 360px`, and as a floating window otherwise.

Set it to `Adw.DialogPresentationMode.floating` or
`Adw.DialogPresentationMode.bottom-sheet` to always present it a
floating window or a bottom sheet respectively, regardless of available size.

Presentation mode does nothing for dialogs presented as a window.

**Parameters**

- `presentationMode`: the new presentation mode

_Available since 1.5._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `self`.

**Parameters**

- `title`: the new title

_Available since 1.5._
