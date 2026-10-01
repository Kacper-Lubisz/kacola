---
description: "A PangoCoverage structure is a map from Unicode characters to Pango.CoverageLevel values."
---

# PangoCoverage

A `PangoCoverage` structure is a map from Unicode characters
to `Pango.CoverageLevel` values.

It is often necessary in Pango to determine if a particular
font can represent a particular character, and also how well
it can represent that character. The `PangoCoverage` is a data
structure that is used to represent that information. It is an
opaque structure with no public fields.

```tsx
import { PangoCoverage } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoCoverage**

## Props

`ref` receives the `Pango.Coverage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.Coverage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `copy`

```ts
copy(): Pango.Coverage
```

Copy an existing `PangoCoverage`.

**Returns** the newly allocated `PangoCoverage`,
  with a reference count of one, which should be freed with
  `Pango.Coverage.unref()`.

### `get`

```ts
get(index: number): Pango.CoverageLevel
```

Determine whether a particular index is covered by `coverage`.

**Parameters**

- `index`: the index to check

**Returns** the coverage level of `coverage` for character `index_`.

### `max`

```ts
max(other: Pango.Coverage): void
```

Set the coverage for each index in `coverage` to be the max (better)
value of the current coverage for the index and the coverage for
the corresponding index in `other`.

**Parameters**

- `other`: another `PangoCoverage`

> **Deprecated since 1.44.** This function does nothing

### `set`

```ts
set(index: number, level: Pango.CoverageLevel): void
```

Modify a particular index within `coverage`

**Parameters**

- `index`: the index to modify
- `level`: the new level for `index_`

### `toBytes`

```ts
toBytes(): Uint8Array
```

Convert a `PangoCoverage` structure into a flat binary format.

**Returns** location to store result (must be freed with `g_free()`)

> **Deprecated since 1.44.** This returns `null`
