---
description: "Controls the appearance of View."
---

# GtkSourceStyleScheme

Controls the appearance of `View`.

`GtkSourceStyleScheme` contains all the text styles to be used in
`View` and `Buffer`. For instance, it contains text styles
for syntax highlighting, it may contain foreground and background color for
non-highlighted text, color for the line numbers, current line highlighting,
bracket matching, etc.

Style schemes are stored in XML files. The format of a scheme file is
documented in the [style scheme reference](./style-reference.html).

The two style schemes with IDs "classic" and "tango" follow more closely the
GTK theme (for example for the background color).

```tsx
import { GtkSourceStyleScheme } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceStyleScheme**

## Props

`ref` receives the `GtkSource.StyleScheme` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `description`

`string` · default `null` · read-only, observe with `onNotifyDescription`

Style scheme description, a translatable string to present to the user.

### `filename`

`string` · default `null` · read-only, observe with `onNotifyFilename`

Style scheme filename or `null`.

### `id`

`string` · default `null` · construct-only

Style scheme id, a unique string used to identify the style scheme
in `StyleSchemeManager`.

### `name`

`string` · default `null` · read-only, observe with `onNotifyName`

Style scheme name, a translatable string to present to the user.

## Methods

Methods are called on the `GtkSource.StyleScheme` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getAuthors`

```ts
getAuthors(): string[] | null
```

**Returns** a
`null`-terminated array containing the `scheme` authors or `null` if
no author is specified by the style scheme.

### `getDescription`

```ts
getDescription(): string | null
```

**Returns** `scheme` description (if defined), or `null`.

### `getFilename`

```ts
getFilename(): string | null
```

**Returns** `scheme` file name if the scheme was created
parsing a style scheme file or `null` in the other cases.

### `getId`

```ts
getId(): string
```

**Returns** `scheme` id.

### `getMetadata`

```ts
getMetadata(name: string): string | null
```

Gets a metadata property from the style scheme.

**Parameters**

- `name`: metadata property name.

**Returns** value of property `name` stored in
  the metadata of `scheme` or `null` if `scheme` does not contain the
  specified metadata property.

_Available since 5.4._

### `getName`

```ts
getName(): string
```

**Returns** `scheme` name.

### `getStyle`

```ts
getStyle(styleId: string): GtkSource.Style | null
```

**Parameters**

- `styleId`: id of the style to retrieve.

**Returns** style which corresponds to `style_id` in
the `scheme`, or `null` when no style with this name found.  It is owned by
`scheme` and may not be unref'ed.
