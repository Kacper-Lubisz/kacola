---
description: "Provides access to StyleSchemes."
---

# GtkSourceStyleSchemeManager

Provides access to `StyleScheme`s.

```tsx
import { GtkSourceStyleSchemeManager } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceStyleSchemeManager**

## Props

`ref` receives the `GtkSource.StyleSchemeManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `schemeIds`

`string[]` · read-only, observe with `onNotifySchemeIds`

### `searchPath`

`string[]`

## Methods

Methods are called on the `GtkSource.StyleSchemeManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `appendSearchPath`

```ts
appendSearchPath(path: string): void
```

Appends `path` to the list of directories where the `manager` looks for
style scheme files.

See `StyleSchemeManager.setSearchPath()` for details.

**Parameters**

- `path`: a directory or a filename.

### `forceRescan`

```ts
forceRescan(): void
```

Mark any currently cached information about the available style schems
as invalid.

All the available style schemes will be reloaded next time the `manager` is accessed.

### `getScheme`

```ts
getScheme(schemeId: string): GtkSource.StyleScheme | null
```

Looks up style scheme by id.

**Parameters**

- `schemeId`: style scheme id to find.

**Returns** a `GtkSourceStyleScheme` object.
  The returned value is owned by `manager` and must not be unref'ed.

### `getSchemeIds`

```ts
getSchemeIds(): string[] | null
```

Returns the ids of the available style schemes.

**Returns** a `null`-terminated array of strings containing the ids of the available
style schemes or `null` if no style scheme is available.
The array is sorted alphabetically according to the scheme name.
The array is owned by the `manager` and must not be modified.

### `getSearchPath`

```ts
getSearchPath(): string[]
```

Returns the current search path for the `manager`.

See `StyleSchemeManager.setSearchPath()` for details.

**Returns** a `null`-terminated array
of string containing the search path.
The array is owned by the `manager` and must not be modified.

### `prependSearchPath`

```ts
prependSearchPath(path: string): void
```

Prepends `path` to the list of directories where the `manager` looks
for style scheme files.

See `StyleSchemeManager.setSearchPath()` for details.

**Parameters**

- `path`: a directory or a filename.

### `setSearchPath`

```ts
setSearchPath(path: string[] | null): void
```

Sets the list of directories where the `manager` looks for
style scheme files.

If `path` is `null`, the search path is reset to default.

Since GtkSourceView 5.16 this function will allow you to provide
paths in the form of "resource:///" URIs to embedded `GResource`s.
They must contain the path of a directory within the `GResource`.

**Parameters**

- `path`: a `null`-terminated array of strings or `null`.
