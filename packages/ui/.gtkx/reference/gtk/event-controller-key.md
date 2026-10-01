---
description: "Provides access to key events."
---

# GtkEventControllerKey

Provides access to key events.

```tsx
import { GtkEventControllerKey } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkEventControllerKey**

## Props

`ref` receives the `Gtk.EventControllerKey` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onImUpdate`

```ts
(self: Gtk.EventControllerKey) => void
```

Emitted whenever the input method context filters away
a keypress and prevents the `controller` receiving it.

See `Gtk.EventControllerKey.setImContext()` and
`Gtk.IMContext.filterKeypress()`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onKeyPressed`

```ts
(keyval: number, keycode: number, state: Gdk.ModifierType, self: Gtk.EventControllerKey) => boolean | undefined
```

Emitted whenever a key is pressed.

**Parameters**

- `keyval`: the pressed key.
- `keycode`: the raw code of the pressed key.
- `state`: the bitmask, representing the state of modifier keys and pointer buttons.
- `self`: The instance the signal was emitted on.

**Returns** `true` if the key press was handled, `false` otherwise.

### `onKeyReleased`

```ts
(keyval: number, keycode: number, state: Gdk.ModifierType, self: Gtk.EventControllerKey) => void
```

Emitted whenever a key is released.

**Parameters**

- `keyval`: the released key.
- `keycode`: the raw code of the released key.
- `state`: the bitmask, representing the state of modifier keys and pointer buttons.
- `self`: The instance the signal was emitted on.

### `onModifiers`

```ts
(state: Gdk.ModifierType, self: Gtk.EventControllerKey) => boolean | undefined
```

Emitted whenever the state of modifier keys and pointer buttons change.

**Parameters**

- `state`: the bitmask, representing the new state of modifier keys and pointer buttons.
- `self`: The instance the signal was emitted on.

**Returns** whether to ignore modifiers

## Methods

Methods are called on the `Gtk.EventControllerKey` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `forward`

```ts
forward(widget: Gtk.Widget): boolean
```

Forwards the current event of this `controller` to a `widget`.

This function can only be used in handlers for the
`Gtk.EventControllerKey.key-pressed`,
`Gtk.EventControllerKey.key-released`
or `Gtk.EventControllerKey.modifiers` signals.

**Parameters**

- `widget`: a `GtkWidget`

**Returns** whether the `widget` handled the event

### `getGroup`

```ts
getGroup(): number
```

Gets the key group of the current event of this `controller`.

See `Gdk.KeyEvent.getLayout()`.

**Returns** the key group

### `getImContext`

```ts
getImContext(): Gtk.IMContext | null
```

Gets the input method context of the key `controller`.

**Returns** the `GtkIMContext`

### `setImContext`

```ts
setImContext(imContext: Gtk.IMContext | null): void
```

Sets the input method context of the key `controller`.

**Parameters**

- `imContext`: a `GtkIMContext`
