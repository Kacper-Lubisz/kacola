---
description: "A freeform application window."
---

# AdwApplicationWindow

A freeform application window.



`AdwApplicationWindow` is a `Gtk.ApplicationWindow` subclass providing
the same features as `Window`.

See `Window` for details.

Example of an `AdwApplicationWindow` UI definition:

```xml
<object class="AdwApplicationWindow">
  <property name="content">
    <object class="AdwToolbarView">
      <child type="top">
        <object class="AdwHeaderBar"/>
      </child>
      <property name="content">
        <!-- ... -->
      </property>
    </object>
  </property>
</object>
```

Using `Gtk.Application.menubar` is not supported and may result in
visual glitches.

```tsx
import { AdwApplicationWindow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [GtkApplicationWindow](.gtkx/reference/gtk/application-window.md) → **AdwApplicationWindow**

Implements `GActionGroup`, `GActionMap`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.ApplicationWindow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `adaptivePreview`

`boolean` · default `false`

Whether adaptive preview is currently open.

Adaptive preview is a debugging tool used for testing the window
contents at specific screen sizes, simulating mobile environment.

Adaptive preview can always be accessed from inspector. This function
allows applications to open it manually.

Most applications should not use this property.

_Available since 1.7._

### `breakpoints`

`ReactNode | null`

`Adw.Breakpoint` elements added to the element, each applying while its condition holds.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `currentBreakpoint`

`Adw.Breakpoint` · read-only, observe with `onNotifyCurrentBreakpoint`

The current breakpoint.

_Available since 1.4._

### `dialogs`

`Gio.ListModel` · read-only, observe with `onNotifyDialogs`

The open dialogs.

_Available since 1.5._

### `visibleDialog`

`Adw.Dialog` · read-only, observe with `onNotifyVisibleDialog`

The currently visible dialog

_Available since 1.5._

## Methods

Methods are called on the `Adw.ApplicationWindow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addBreakpoint`

```ts
addBreakpoint(breakpoint: Adw.Breakpoint): void
```

Adds `breakpoint` to `self`.

**Parameters**

- `breakpoint`: the breakpoint to add

_Available since 1.4._

### `getAdaptivePreview`

```ts
getAdaptivePreview(): boolean
```

Gets whether adaptive preview for `self` is currently open.

**Returns** whether adaptive preview is open.

_Available since 1.7._

### `getContent`

```ts
getContent(): Gtk.Widget | null
```

Gets the content widget of `self`.

This method should always be used instead of `Gtk.Window.getChild()`.

**Returns** the content widget of `self`

### `getCurrentBreakpoint`

```ts
getCurrentBreakpoint(): Adw.Breakpoint | null
```

Gets the current breakpoint.

**Returns** the current breakpoint

_Available since 1.4._

### `getDialogs`

```ts
getDialogs(): Gio.ListModel
```

Returns a `Gio.ListModel` that contains the open dialogs of `self`.

This can be used to keep an up-to-date view.

**Returns** a list model for the dialogs of `self`

_Available since 1.5._

### `getVisibleDialog`

```ts
getVisibleDialog(): Adw.Dialog | null
```

Returns the currently visible dialog in `self`, if there's one.

**Returns** the visible dialog

_Available since 1.5._

### `setAdaptivePreview`

```ts
setAdaptivePreview(adaptivePreview: boolean): void
```

Sets whether adaptive preview for `self` is currently open.

Adaptive preview is a debugging tool used for testing the window
contents at specific screen sizes, simulating mobile environment.

Adaptive preview can always be accessed from inspector. This function
allows applications to open it manually.

Most applications should not use this function.

**Parameters**

- `adaptivePreview`: whether to open adaptive preview

_Available since 1.7._

### `setContent`

```ts
setContent(content: Gtk.Widget | null): void
```

Sets the content widget of `self`.

This method should always be used instead of `Gtk.Window.setChild()`.

**Parameters**

- `content`: the content widget
