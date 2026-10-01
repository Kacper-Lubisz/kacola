---
description: "GSimpleIOStream creates a Gio.IOStream from an arbitrary Gio.InputStream and Gio.OutputStream."
---

# GSimpleIOStream

`GSimpleIOStream` creates a `Gio.IOStream` from an arbitrary
`Gio.InputStream` and `Gio.OutputStream`. This allows any pair of
input and output streams to be used with `Gio.IOStream` methods.

This is useful when you obtained a `Gio.InputStream` and a
`Gio.OutputStream` by other means, for instance creating them with
platform specific methods as
[`g_unix_input_stream_new()`](../gio-unix/ctor.UnixInputStream.new.html)
(from `gio-unix-2.0.pc` / `GioUnix-2.0`), and you want to
take advantage of the methods provided by `Gio.IOStream`.

_Available since 2.44._

```tsx
import { GSimpleIOStream } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GIOStream](.gtkx/reference/gio/io-stream.md) → **GSimpleIOStream**

## Props

`ref` receives the `Gio.SimpleIOStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `inputStream`

`Gio.InputStream` · construct-only

The `Gio.InputStream` to read from.

_Available since 2.44._

### `outputStream`

`Gio.OutputStream` · construct-only

The `Gio.OutputStream` to write to.

_Available since 2.44._
