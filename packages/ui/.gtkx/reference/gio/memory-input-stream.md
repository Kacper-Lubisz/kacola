---
description: "GMemoryInputStream is a class for using arbitrary memory chunks as input for GIO streaming input operations."
---

# GMemoryInputStream

`GMemoryInputStream` is a class for using arbitrary
memory chunks as input for GIO streaming input operations.

As of GLib 2.34, `GMemoryInputStream` implements
`Gio.PollableInputStream`.

```tsx
import { GMemoryInputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInputStream](.gtkx/reference/gio/input-stream.md) → **GMemoryInputStream**

Implements `GPollableInputStream`, `GSeekable`.

## Props

`ref` receives the `Gio.MemoryInputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.MemoryInputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addBytes`

```ts
addBytes(bytes: GLib.Bytes): void
```

Appends `bytes` to data that can be read from the input stream.

**Parameters**

- `bytes`: input data

_Available since 2.34._

### `addData`

```ts
addData(data: Uint8Array | number[], destroy: GLib.DestroyNotify | null): void
```

Appends `data` to data that can be read from the input stream

**Parameters**

- `data`: input data
- `destroy`: function that is called to free `data`, or `null`
