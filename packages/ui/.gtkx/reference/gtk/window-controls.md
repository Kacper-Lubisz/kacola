---
description: "Shows window frame controls."
---

# GtkWindowControls

Shows window frame controls.

Typical window frame controls are minimize, maximize and close buttons,
and the window icon.



`GtkWindowControls` only displays start or end side of the controls (see
`Gtk.WindowControls.side`), so it's intended to be always used
in pair with another `GtkWindowControls` for the opposite side, for example:

```xml
<object class="GtkBox">
  <child>
    <object class="GtkWindowControls">
      <property name="side">start</property>
    </object>
  </child>

  ...

  <child>
    <object class="GtkWindowControls">
      <property name="side">end</property>
    </object>
  </child>
</object>
```

## CSS nodes

```
windowcontrols
├── [image.icon]
├── [button.minimize]
├── [button.maximize]
╰── [button.close]
```

A `GtkWindowControls`' CSS node is called windowcontrols. It contains
subnodes corresponding to each title button. Which of the title buttons
exist and where they are placed exactly depends on the desktop environment
and `Gtk.WindowControls.decorationLayout` value.

When `Gtk.WindowControls.empty` is true, it gets the .empty
style class.

## Accessibility

`GtkWindowControls` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { GtkWindowControls } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkWindowControls**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.WindowControls` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `decorationLayout`

`string` · default `null`

The decoration layout for window buttons.

If this property is not set, the
`Gtk.Settings.gtkDecorationLayout` setting is used.

### `empty`

`boolean` · default `true` · read-only, observe with `onNotifyEmpty`

Whether the widget has any window buttons.

### `side`

`Gtk.PackType` · default `GTK_PACK_START`

Whether the widget shows start or end side of the decoration layout.

See `Gtk.WindowControls.decorationLayout`.

### `useNativeControls`

`boolean` · default `false`

Whether to show platform native close/minimize/maximize buttons.

For macOS, the `Gtk.HeaderBar.decorationLayout` property
controls the use of native window controls.

On other platforms, this option has no effect.

See also [Using GTK on Apple macOS](osx.html?native-window-controls).

_Available since 4.18._

## Methods

Methods are called on the `Gtk.WindowControls` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDecorationLayout`

```ts
getDecorationLayout(): string | null
```

Gets the decoration layout of this window controls widget

**Returns** the decoration layout

### `getEmpty`

```ts
getEmpty(): boolean
```

Gets whether the widget has any window buttons.

**Returns** true if the widget has window buttons

### `getSide`

```ts
getSide(): Gtk.PackType
```

Gets the side to which this window controls widget belongs.

**Returns** the side

### `getUseNativeControls`

```ts
getUseNativeControls(): boolean
```

Returns whether platform native window controls are shown.

**Returns** true if native window controls are shown

_Available since 4.18._

### `setDecorationLayout`

```ts
setDecorationLayout(layout: string | null): void
```

Sets the decoration layout for the title buttons.

This overrides the `Gtk.Settings.gtkDecorationLayout`
setting.

The format of the string is button names, separated by commas.
A colon separates the buttons that should appear on the left
from those on the right. Recognized button names are minimize,
maximize, close and icon (the window icon).

For example, “icon:minimize,maximize,close” specifies a icon
on the left, and minimize, maximize and close buttons on the right.

If `Gtk.WindowControls.side` value is `Gtk.PackType.start`,
`self` will display the part before the colon, otherwise after that.

**Parameters**

- `layout`: a decoration layout, or `NULL` to unset the layout

### `setSide`

```ts
setSide(side: Gtk.PackType): void
```

Determines which part of decoration layout
the window controls widget uses.

See `Gtk.WindowControls.decorationLayout`.

**Parameters**

- `side`: a side

### `setUseNativeControls`

```ts
setUseNativeControls(setting: boolean): void
```

Sets whether platform native window controls are used.

This option shows the "stoplight" buttons on macOS.
For Linux, this option has no effect.

See also [Using GTK on Apple macOS](osx.html?native-window-controls).

**Parameters**

- `setting`: true to show native window controls

_Available since 4.18._
