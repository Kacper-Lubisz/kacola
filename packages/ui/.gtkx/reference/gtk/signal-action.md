---
description: "Emits a signal on a widget."
---

# GtkSignalAction

Emits a signal on a widget.

Signals that are used in this way are referred to as keybinding signals,
and they are expected to be defined with the `G_SIGNAL_ACTION` flag.

```tsx
import { GtkSignalAction } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkShortcutAction](.gtkx/reference/gtk/shortcut-action.md) → **GtkSignalAction**

## Props

`ref` receives the `Gtk.SignalAction` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `signalName`

`string` · default `null` · construct-only

The name of the signal to emit.

## Methods

Methods are called on the `Gtk.SignalAction` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getSignalName`

```ts
getSignalName(): string
```

Returns the name of the signal that will be emitted.

**Returns** the name of the signal to emit
