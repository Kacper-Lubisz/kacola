---
description: "Asks the user for passwords and other information required to mount a volume."
---

# GtkMountOperation

Asks the user for passwords and other information required to
mount a volume.

`GtkMountOperation` is needed when mounting volumes:
It is an implementation of `GMountOperation` that can be used with
GIO functions for mounting volumes such as
`Gio.File.mountEnclosingVolume()`,
`Gio.File.mountMountable()`,
`Gio.Volume.mount()`,
`Gio.Mount.unmountWithOperation()` and others.

When necessary, `GtkMountOperation` shows dialogs to let the user
enter passwords, ask questions or show processes blocking unmount.

```tsx
import { GtkMountOperation } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GMountOperation](.gtkx/reference/gio/mount-operation.md) → **GtkMountOperation**

## Props

`ref` receives the `Gtk.MountOperation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `display`

`Gdk.Display | ReactElement`

The display where dialogs will be shown.

### `isShowing`

`boolean` · default `false` · read-only, observe with `onNotifyIsShowing`

Whether a dialog is currently shown.

### `parent`

`Gtk.Window | ReactElement`

The parent window.

## Methods

Methods are called on the `Gtk.MountOperation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Gets the display on which windows of the `GtkMountOperation`
will be shown.

**Returns** the display on which windows of `op` are shown

### `getParent`

```ts
getParent(): Gtk.Window | null
```

Gets the transient parent used by the `GtkMountOperation`.

**Returns** the transient parent for windows shown by `op`

### `isShowing`

```ts
isShowing(): boolean
```

Returns whether the `GtkMountOperation` is currently displaying
a window.

**Returns** `true` if `op` is currently displaying a window

### `setDisplay`

```ts
setDisplay(display: Gdk.Display): void
```

Sets the display to show windows of the `GtkMountOperation` on.

**Parameters**

- `display`: a `GdkDisplay`

### `setParent`

```ts
setParent(parent: Gtk.Window | null): void
```

Sets the transient parent for windows shown by the
`GtkMountOperation`.

**Parameters**

- `parent`: transient parent of the window
