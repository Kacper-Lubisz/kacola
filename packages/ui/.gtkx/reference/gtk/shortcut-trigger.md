---
description: "Tracks how a GtkShortcut can be activated."
---

# GtkShortcutTrigger

Tracks how a `GtkShortcut` can be activated.

To find out if a `GtkShortcutTrigger` triggers, you can call
`Gtk.ShortcutTrigger.trigger()` on a `GdkEvent`.

`GtkShortcutTriggers` contain functions that allow easy presentation
to end users as well as being printed for debugging.

All `GtkShortcutTriggers` are immutable, you can only specify their
properties during construction. If you want to change a trigger, you
have to replace it with a new one.

```tsx
import { GtkShortcutTrigger } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkShortcutTrigger**

## Props

`ref` receives the `Gtk.ShortcutTrigger` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.ShortcutTrigger` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `compare`

```ts
compare(trigger2: Gtk.ShortcutTrigger): number
```

The types of `trigger1` and `trigger2` are `gconstpointer` only to allow
use of this function as a `GCompareFunc`.

They must each be a `GtkShortcutTrigger`.

**Parameters**

- `trigger2`: a `GtkShortcutTrigger`

**Returns** An integer less than, equal to, or greater than zero if
  `trigger1` is found, respectively, to be less than, to match,
  or be greater than `trigger2`.

### `equal`

```ts
equal(trigger2: Gtk.ShortcutTrigger): boolean
```

Checks if `trigger1` and `trigger2` trigger under the same conditions.

The types of `one` and `two` are `gconstpointer` only to allow use of this
function with `GHashTable`. They must each be a `GtkShortcutTrigger`.

**Parameters**

- `trigger2`: a `GtkShortcutTrigger`

**Returns** `true` if `trigger1` and `trigger2` are equal

### `hash`

```ts
hash(): number
```

Generates a hash value for a `GtkShortcutTrigger`.

The output of this function is guaranteed to be the same for a given
value only per-process. It may change between different processor
architectures or even different versions of GTK. Do not use this
function as a basis for building protocols or file formats.

The types of `trigger` is `gconstpointer` only to allow use of this
function with `GHashTable`. They must each be a `GtkShortcutTrigger`.

**Returns** a hash value corresponding to `trigger`

### `print`

```ts
print(string: GLib.String): void
```

Prints the given trigger into a string for the developer.
This is meant for debugging and logging.

The form of the representation may change at any time
and is not guaranteed to stay identical.

**Parameters**

- `string`: a `GString` to print into

### `printLabel`

```ts
printLabel(display: Gdk.Display, string: GLib.String): boolean
```

Prints the given trigger into a string.

This function is returning a translated string for presentation
to end users for example in menu items or in help texts.

The `display` in use may influence the resulting string in
various forms, such as resolving hardware keycodes or by
causing display-specific modifier names.

The form of the representation may change at any time and is
not guaranteed to stay identical.

**Parameters**

- `display`: `GdkDisplay` to print for
- `string`: a `GString` to print into

**Returns** `true` if something was printed or `false` if the
  trigger did not have a textual representation suitable
  for end users.

### `toLabel`

```ts
toLabel(display: Gdk.Display): string
```

Gets textual representation for the given trigger.

This function is returning a translated string for
presentation to end users for example in menu items
or in help texts.

The `display` in use may influence the resulting string in
various forms, such as resolving hardware keycodes or by
causing display-specific modifier names.

The form of the representation may change at any time and is
not guaranteed to stay identical.

**Parameters**

- `display`: `GdkDisplay` to print for

**Returns** a new string

### `toString`

```ts
toString(): string
```

Prints the given trigger into a human-readable string.

This is a small wrapper around `Gtk.ShortcutTrigger.print()`
to help when debugging.

**Returns** a new string

### `trigger`

```ts
trigger(event: Gdk.Event, enableMnemonics: boolean): Gdk.KeyMatch
```

Checks if the given `event` triggers `self`.

**Parameters**

- `event`: the event to check
- `enableMnemonics`: `true` if mnemonics should trigger. Usually the value of this property is determined by checking that the passed in `event` is a Key event and has the right modifiers set.

**Returns** Whether the event triggered the shortcut
