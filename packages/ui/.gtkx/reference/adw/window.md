---
description: "A freeform window."
---

# AdwWindow

A freeform window.



The `AdwWindow` widget is a subclass of `Gtk.Window` which has no
titlebar area. Instead, `ToolbarView` can be used together with
`HeaderBar` or `Gtk.HeaderBar` as follows:

```xml
<object class="AdwWindow">
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

Using `Gtk.Window.titlebar` or `Gtk.Window.child`
is not supported and will result in a crash. Use `Window.content`
instead.

### Dialogs

`AdwWindow` can contain `Dialog`. Use `Dialog.present()` with the
window or a widget within a window to show a dialog.

### Breakpoints

`AdwWindow` can be used with `Breakpoint` the same way as
`BreakpointBin`. Refer to that widget's documentation for details.

Example:

```xml
<object class="AdwWindow">
  <property name="content">
    <object class="AdwToolbarView">
      <child type="top">
        <object class="AdwHeaderBar"/>
      </child>
      <property name="content">
        <!-- ... -->
      </property>
      <child type="bottom">
        <object class="GtkActionBar" id="bottom_bar">
          <property name="revealed">True</property>
          <property name="visible">False</property>
        </object>
      </child>
    </object>
  </property>
  <child>
    <object class="AdwBreakpoint">
      <condition>max-width: 500px</condition>
      <setter object="bottom_bar" property="visible">True</setter>
    </object>
  </child>
</object>
```

When breakpoints are used, the minimum size must be larger than the smallest
UI state. `AdwWindow` defaults to the minimum size of 360×200 px. If that's
too small, set the `Gtk.Widget.widthRequest` and
`Gtk.Widget.heightRequest` properties manually.

### Adaptive Preview

`AdwWindow` has a debug tool called adaptive preview. It can be opened from
GTK Inspector or by pressing <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>,
and controlled via the `Window.adaptivePreview` property.

```tsx
import { AdwWindow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **AdwWindow**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.Window` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

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

Methods are called on the `Adw.Window` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

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
