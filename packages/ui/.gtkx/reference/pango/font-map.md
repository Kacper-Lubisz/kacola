---
description: "A PangoFontMap represents the set of fonts available for a particular rendering system."
---

# PangoFontMap

A `PangoFontMap` represents the set of fonts available for a
particular rendering system.

This is a virtual object with implementations being specific to
particular rendering systems.

```tsx
import { PangoFontMap } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoFontMap**

Implements `GListModel`.

## Props

`ref` receives the `Pango.FontMap` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items contained in this list.

_Available since 1.52._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items contained in this list.

_Available since 1.52._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Pango.FontMap) => void
```

From `GListModel`.

This signal is emitted whenever items were added to or removed
from `list`. At `position`, `removed` items were removed and `added`
items were added in their place.

Note: If `removed != added`, the positions of all later items
in the model change.

**Parameters**

- `position`: the position at which `list` changed
- `removed`: the number of items removed
- `added`: the number of items added
- `self`: The instance the signal was emitted on.

_Available since 2.44._

## Methods

Methods are called on the `Pango.FontMap` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `addFontFile`

```ts
addFontFile(filename: string): boolean
```

Loads a font file with one or more fonts into the `PangoFontMap`.

The added fonts will take precedence over preexisting
fonts with the same name.

**Parameters**

- `filename`: Path to the font file

**Returns** True if the font file is successfully loaded
    into the fontmap, false if an error occurred.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 1.56._

### `changed`

```ts
changed(): void
```

Forces a change in the fontmap, which will cause any `PangoContext`
using this fontmap to change.

This function is only useful when implementing a new backend
for Pango, something applications won't do. Backends should
call this function if they have attached extra data to the
fontmap and such data is changed.

_Available since 1.34._

### `createContext`

```ts
createContext(): Pango.Context
```

Creates a `PangoContext` connected to `fontmap`.

This is equivalent to `Pango.Context.new()` followed by
`Pango.Context.setFontMap()`.

If you are using Pango as part of a higher-level system,
that system may have it's own way of create a `PangoContext`.
For instance, the GTK toolkit has, among others,
`gtk_widget_get_pango_context()`. Use those instead.

**Returns** the newly allocated `PangoContext`,
  which should be freed with `g_object_unref()`.

_Available since 1.22._

### `getFamily`

```ts
getFamily(name: string): Pango.FontFamily | null
```

Gets a font family by name.

**Parameters**

- `name`: a family name

**Returns** the `PangoFontFamily`

_Available since 1.46._

### `getSerial`

```ts
getSerial(): number
```

Returns the current serial number of `fontmap`.

The serial number is initialized to an small number larger than zero
when a new fontmap is created and is increased whenever the fontmap
is changed. It may wrap, but will never have the value 0. Since it can
wrap, never compare it with "less than", always use "not equals".

The fontmap can only be changed using backend-specific API, like changing
fontmap resolution.

This can be used to automatically detect changes to a `PangoFontMap`,
like in `PangoContext`.

**Returns** The current serial number of `fontmap`.

_Available since 1.32.4._

### `listFamilies`

```ts
listFamilies(): Pango.FontFamily[]
```

List all families for a fontmap.

Note that the returned families are not in any particular order.

`PangoFontMap` also implemented the `Gio.ListModel` interface
for enumerating families.

**Returns** location to
  store a pointer to an array of `PangoFontFamily` *.
  This array should be freed with `g_free()`.

### `loadFont`

```ts
loadFont(context: Pango.Context, desc: Pango.FontDescription): Pango.Font | null
```

Load the font in the fontmap that is the closest match for `desc`.

**Parameters**

- `context`: the `PangoContext` the font will be used with
- `desc`: a `PangoFontDescription` describing the font to load

**Returns** the newly allocated `PangoFont`
  loaded, or `null` if no font matched.

### `loadFontset`

```ts
loadFontset(context: Pango.Context, desc: Pango.FontDescription, language: Pango.Language): Pango.Fontset | null
```

Load a set of fonts in the fontmap that can be used to render
a font matching `desc`.

**Parameters**

- `context`: the `PangoContext` the font will be used with
- `desc`: a `PangoFontDescription` describing the font to load
- `language`: a `PangoLanguage` the fonts will be used for

**Returns** the newly allocated
  `PangoFontset` loaded, or `null` if no font matched.

### `reloadFont`

```ts
reloadFont(font: Pango.Font, scale: number, context: Pango.Context | null, variations: string | null): Pango.Font
```

Returns a new font that is like `font`, except that it is scaled
by `scale`, its backend-dependent configuration (e.g. cairo font options)
is replaced by the one in `context`, and its variations are replaced
by `variations`.

Note that the scaling here is meant to be linear, so this
scaling can be used to render a font on a hi-dpi display
without changing its optical size.

**Parameters**

- `font`: a font in `fontmap`
- `scale`: the scale factor to apply
- `context`: a `PangoContext`
- `variations`: font variations to use

**Returns** the modified font

_Available since 1.52._
