---
description: "Base class for platform dialogs that don't use GtkDialog."
---

# GtkNativeDialog

Base class for platform dialogs that don't use `GtkDialog`.

Native dialogs are used in order to integrate better with a platform,
by looking the same as other native applications and supporting
platform specific features.

The `Gtk.Dialog` functions cannot be used on such objects,
but we need a similar API in order to drive them. The `GtkNativeDialog`
object is an API that allows you to do this. It allows you to set
various common properties on the dialog, as well as show and hide
it and get a `Gtk.NativeDialog.response` signal when the user
finished with the dialog.

Note that unlike `GtkDialog`, `GtkNativeDialog` objects are not
toplevel widgets, and GTK does not keep them alive. It is your
responsibility to keep a reference until you are done with the
object.

```tsx
import { GtkNativeDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkNativeDialog**

## Props

`ref` receives the `Gtk.NativeDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `modal`

`boolean` · default `false`

Whether the window should be modal with respect to its transient parent.

### `title`

`string` · default `null`

The title of the dialog window

### `transientFor`

`Gtk.Window | ReactElement`

The transient parent of the dialog, or `null` for none.

### `visible`

`boolean` · default `false`

Whether the window is currently visible.

## Signals

### `onResponse`

```ts
(responseId: number, self: Gtk.NativeDialog) => void
```

Emitted when the user responds to the dialog.

When this is called the dialog has been hidden.

If you call `Gtk.NativeDialog.hide()` before the user
responds to the dialog this signal will not be emitted.

**Parameters**

- `responseId`: the response ID
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.NativeDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `destroy`

```ts
destroy(): void
```

Destroys a dialog.

When a dialog is destroyed, it will break any references it holds
to other objects.

If it is visible it will be hidden and any underlying window system
resources will be destroyed.

Note that this does not release any reference to the object (as opposed
to destroying a `GtkWindow`) because there is no reference from the
windowing system to the `GtkNativeDialog`.

### `getModal`

```ts
getModal(): boolean
```

Returns whether the dialog is modal.

**Returns** `true` if the dialog is set to be modal

### `getTitle`

```ts
getTitle(): string | null
```

Gets the title of the `GtkNativeDialog`.

**Returns** the title of the dialog, or `null` if none has
   been set explicitly. The returned string is owned by the widget
   and must not be modified or freed.

### `getTransientFor`

```ts
getTransientFor(): Gtk.Window | null
```

Fetches the transient parent for this window.

**Returns** the transient parent for this window,
  or `null` if no transient parent has been set.

### `getVisible`

```ts
getVisible(): boolean
```

Determines whether the dialog is visible.

**Returns** `true` if the dialog is visible

### `hide`

```ts
hide(): void
```

Hides the dialog if it is visible, aborting any interaction.

Once this is called the `Gtk.NativeDialog.response` signal
will *not* be emitted until after the next call to
`Gtk.NativeDialog.show()`.

If the dialog is not visible this does nothing.

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets a dialog modal or non-modal.

Modal dialogs prevent interaction with other windows in the same
application. To keep modal dialogs on top of main application
windows, use `Gtk.NativeDialog.setTransientFor()` to make
the dialog transient for the parent; most window managers will
then disallow lowering the dialog below the parent.

**Parameters**

- `modal`: whether the window is modal

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of the `GtkNativeDialog.`

**Parameters**

- `title`: title of the dialog

### `setTransientFor`

```ts
setTransientFor(parent: Gtk.Window | null): void
```

Dialog windows should be set transient for the main application
window they were spawned from.

This allows window managers to e.g. keep the dialog on top of the
main window, or center the dialog over the main window.

Passing `null` for `parent` unsets the current transient window.

**Parameters**

- `parent`: parent window

### `show`

```ts
show(): void
```

Shows the dialog on the display.

When the user accepts the state of the dialog the dialog will
be automatically hidden and the `Gtk.NativeDialog.response`
signal will be emitted.

Multiple calls while the dialog is visible will be ignored.
