---
description: "Combines two shortcut triggers."
---

# GtkAlternativeTrigger

Combines two shortcut triggers.

The `GtkAlternativeTrigger` triggers when either of the two trigger.

This can be cascaded to combine more than two triggers.

```tsx
import { GtkAlternativeTrigger } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkShortcutTrigger](.gtkx/reference/gtk/shortcut-trigger.md) → **GtkAlternativeTrigger**

## Props

`ref` receives the `Gtk.AlternativeTrigger` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `first`

`Gtk.ShortcutTrigger` · construct-only

The first `GtkShortcutTrigger` to check.

### `second`

`Gtk.ShortcutTrigger` · construct-only

The second `GtkShortcutTrigger` to check.

## Methods

Methods are called on the `Gtk.AlternativeTrigger` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getFirst`

```ts
getFirst(): Gtk.ShortcutTrigger
```

Gets the first of the two alternative triggers that may
trigger `self`.

`Gtk.AlternativeTrigger.getSecond()` will return
the other one.

**Returns** the first alternative trigger

### `getSecond`

```ts
getSecond(): Gtk.ShortcutTrigger
```

Gets the second of the two alternative triggers that may
trigger `self`.

`Gtk.AlternativeTrigger.getFirst()` will return
the other one.

**Returns** the second alternative trigger
