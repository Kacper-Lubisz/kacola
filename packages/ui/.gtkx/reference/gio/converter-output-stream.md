---
description: "Converter output stream implements Gio.OutputStream and allows conversion of data of various types during reading."
---

# GConverterOutputStream

Converter output stream implements `Gio.OutputStream` and allows
conversion of data of various types during reading.

As of GLib 2.34, `GConverterOutputStream` implements
`Gio.PollableOutputStream`.

```tsx
import { GConverterOutputStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GOutputStream](.gtkx/reference/gio/output-stream.md) → [GFilterOutputStream](.gtkx/reference/gio/filter-output-stream.md) → **GConverterOutputStream**

Implements `GPollableOutputStream`.

## Props

`ref` receives the `Gio.ConverterOutputStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `converter`

`Gio.Converter` · construct-only

The converter object.

## Methods

Methods are called on the `Gio.ConverterOutputStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getConverter`

```ts
getConverter(): Gio.Converter
```

Gets the `GConverter` that is used by `converter_stream`.

**Returns** the converter of the converter output stream

_Available since 2.24._
