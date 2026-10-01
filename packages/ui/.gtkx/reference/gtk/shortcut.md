---
description: "Describes a keyboard shortcut."
---

# GtkShortcut

Describes a keyboard shortcut.

It contains a description of how to trigger the shortcut via a
`Gtk.ShortcutTrigger` and a way to activate the shortcut
on a widget via a `Gtk.ShortcutAction`.

The actual work is usually done via `Gtk.ShortcutController`,
which decides if and when to activate a shortcut. Using that controller
directly however is rarely necessary as various higher level
convenience APIs exist on `GtkWidget`s that make it easier to use
shortcuts in GTK.

`GtkShortcut` does provide functionality to make it easy for users
to work with shortcuts, either by providing informational strings
for display purposes or by allowing shortcuts to be configured.

```tsx
import { GtkShortcut } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkShortcut**

## Props

`ref` receives the `Gtk.Shortcut` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `action`

`Gtk.ShortcutAction | ReactElement`

The action that gets activated by this shortcut.

### `arguments_`

`GLib.Variant`

Arguments passed to activation.

### `trigger`

`Gtk.ShortcutTrigger | ReactElement`

The trigger that triggers this shortcut.

## Methods

Methods are called on the `Gtk.Shortcut` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAction`

```ts
getAction(): Gtk.ShortcutAction | null
```

Gets the action that is activated by this shortcut.

**Returns** the action

### `getArguments`

```ts
getArguments(): GLib.Variant | null
```

Gets the arguments that are passed when activating the shortcut.

**Returns** the arguments

### `getTrigger`

```ts
getTrigger(): Gtk.ShortcutTrigger | null
```

Gets the trigger used to trigger `self`.

**Returns** the trigger used

### `setAction`

```ts
setAction(action: Gtk.ShortcutAction | null): void
```

Sets the new action for `self` to be `action`.

**Parameters**

- `action`: The new action. If the `action` is `null`, the nothing action will be used.

### `setArguments`

```ts
setArguments(args: GLib.Variant | null): void
```

Sets the arguments to pass when activating the shortcut.

**Parameters**

- `args`: arguments to pass when activating `self`

### `setTrigger`

```ts
setTrigger(trigger: Gtk.ShortcutTrigger | null): void
```

Sets the new trigger for `self` to be `trigger`.

**Parameters**

- `trigger`: The new trigger. If the `trigger` is `null`, the never trigger will be used.
