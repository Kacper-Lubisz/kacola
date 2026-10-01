---
description: "Encodes an action that can be triggered by a keyboard shortcut."
---

# GtkShortcutAction

Encodes an action that can be triggered by a keyboard shortcut.

`GtkShortcutActions` contain functions that allow easy presentation
to end users as well as being printed for debugging.

All `GtkShortcutActions` are immutable, you can only specify their
properties during construction. If you want to change a action, you
have to replace it with a new one. If you need to pass arguments to
an action, these are specified by the higher-level `GtkShortcut` object.

To activate a `GtkShortcutAction` manually, `Gtk.ShortcutAction.activate()`
can be called.

GTK provides various actions:

 - `Gtk.MnemonicAction`: a shortcut action that calls
   `gtk_widget_mnemonic_activate()`
 - `Gtk.CallbackAction`: a shortcut action that invokes
   a given callback
 - `Gtk.SignalAction`: a shortcut action that emits a
   given signal
 - `Gtk.ActivateAction`: a shortcut action that calls
   `gtk_widget_activate()`
 - `Gtk.NamedAction`: a shortcut action that calls
   `gtk_widget_activate_action()`
 - `Gtk.NothingAction`: a shortcut action that does nothing

```tsx
import { GtkShortcutAction } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkShortcutAction**

## Props

`ref` receives the `Gtk.ShortcutAction` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.ShortcutAction` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `activate`

```ts
activate(flags: Gtk.ShortcutActionFlags, widget: Gtk.Widget, args: GLib.Variant | null): boolean
```

Activates the action on the `widget` with the given `args`.

Note that some actions ignore the passed in `flags`, `widget` or `args`.

Activation of an action can fail for various reasons. If the action
is not supported by the `widget`, if the `args` don't match the action
or if the activation otherwise had no effect, `false` will be returned.

**Parameters**

- `flags`: flags to activate with
- `widget`: Target of the activation
- `args`: arguments to pass

**Returns** `true` if this action was activated successfully

### `print`

```ts
print(string: GLib.String): void
```

Prints the given action into a string for the developer.

This is meant for debugging and logging.

The form of the representation may change at any time and is
not guaranteed to stay identical.

**Parameters**

- `string`: a `GString` to print into

### `toString`

```ts
toString(): string
```

Prints the given action into a human-readable string.

This is a small wrapper around `Gtk.ShortcutAction.print()`
to help when debugging.

**Returns** a new string
