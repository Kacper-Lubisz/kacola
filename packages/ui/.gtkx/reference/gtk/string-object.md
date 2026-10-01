---
description: "The type of items in a GtkStringList."
---

# GtkStringObject

The type of items in a `GtkStringList`.

A `GtkStringObject` is a wrapper around a `const char*`; it has
a `Gtk.StringObject.string` property that can be used
for property bindings and expressions.

```tsx
import { GtkStringObject } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkStringObject**

## Props

`ref` receives the `Gtk.StringObject` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `string`

`string` · default `null` · read-only, observe with `onNotifyString`

The string.

## Methods

Methods are called on the `Gtk.StringObject` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getString`

```ts
getString(): string
```

Returns the string contained in a `GtkStringObject`.

**Returns** the string of `self`
