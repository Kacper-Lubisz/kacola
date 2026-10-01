---
description: "GCharsetConverter is an implementation of Gio.Converter based on GLib.IConv."
---

# GCharsetConverter

`GCharsetConverter` is an implementation of `Gio.Converter` based on
`GLib.IConv`.

```tsx
import { GCharsetConverter } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GCharsetConverter**

Implements `GConverter`, `GInitable`.

## Props

`ref` receives the `Gio.CharsetConverter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `fromCharset`

`string` · default `null` · construct-only

The character encoding to convert from.

_Available since 2.24._

### `toCharset`

`string` · default `null` · construct-only

The character encoding to convert to.

_Available since 2.24._

### `useFallback`

`boolean` · default `false`

Use fallback (of form `\<hexval>`) for invalid bytes.

_Available since 2.24._

## Methods

Methods are called on the `Gio.CharsetConverter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getNumFallbacks`

```ts
getNumFallbacks(): number
```

Gets the number of fallbacks that `converter` has applied so far.

**Returns** the number of fallbacks that `converter` has applied

_Available since 2.24._

### `getUseFallback`

```ts
getUseFallback(): boolean
```

Gets the `GCharsetConverter.useFallback` property.

**Returns** `true` if fallbacks are used by `converter`

_Available since 2.24._

### `setUseFallback`

```ts
setUseFallback(useFallback: boolean): void
```

Sets the `GCharsetConverter.useFallback` property.

**Parameters**

- `useFallback`: `true` to use fallbacks

_Available since 2.24._
