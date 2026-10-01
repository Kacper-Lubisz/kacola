---
description: "A Gtk.ListBoxRow used to present preferences."
---

# AdwPreferencesRow

A `Gtk.ListBoxRow` used to present preferences.

The `AdwPreferencesRow` widget has a title that `PreferencesDialog`
will use to let the user look for a preference. It doesn't present the title
in any way and lets you present the preference as you please.

`ActionRow` and its derivatives are convenient to use as preference
rows as they take care of presenting the preference's title while letting you
compose the inputs of the preference around it.

```tsx
import { AdwPreferencesRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → **AdwPreferencesRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.PreferencesRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `prefix`

`ReactNode | null`

Widgets added at the start of the row, before its title.

### `suffix`

`ReactNode | null`

Widgets added at the end of the row.

### `title`

`string`

The title of the preference represented by this row.

The title is interpreted as Pango markup unless
`PreferencesRow.useMarkup` is set to `FALSE`.

### `titleSelectable`

`boolean` · default `false`

Whether the user can copy the title from the label.

See also `Gtk.Label.selectable`.

_Available since 1.1._

### `useMarkup`

`boolean` · default `true`

Whether to use Pango markup for the title label.

Subclasses may also use it for other labels, such as subtitle.

See also `Pango.parseMarkup()`.

_Available since 1.2._

### `useUnderline`

`boolean` · default `false`

Whether an embedded underline in the title indicates a mnemonic.

## Methods

Methods are called on the `Adw.PreferencesRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getTitle`

```ts
getTitle(): string
```

Gets the title of the preference represented by `self`.

**Returns** the title

### `getTitleSelectable`

```ts
getTitleSelectable(): boolean
```

Gets whether the user can copy the title from the label

**Returns** whether the user can copy the title from the label

_Available since 1.1._

### `getUseMarkup`

```ts
getUseMarkup(): boolean
```

Gets whether to use Pango markup for the title label.

**Returns** whether to use markup

_Available since 1.2._

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether an embedded underline in the title indicates a mnemonic.

**Returns** whether an embedded underline in the title indicates a mnemonic

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of the preference represented by `self`.

The title is interpreted as Pango markup unless
`PreferencesRow.useMarkup` is set to `FALSE`.

**Parameters**

- `title`: the title

### `setTitleSelectable`

```ts
setTitleSelectable(titleSelectable: boolean): void
```

Sets whether the user can copy the title from the label

See also `Gtk.Label.selectable`.

**Parameters**

- `titleSelectable`: `TRUE` if the user can copy the title from the label

_Available since 1.1._

### `setUseMarkup`

```ts
setUseMarkup(useMarkup: boolean): void
```

Sets whether to use Pango markup for the title label.

Subclasses may also use it for other labels, such as subtitle.

See also `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup

_Available since 1.2._

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether an embedded underline in the title indicates a mnemonic.

**Parameters**

- `useUnderline`: `TRUE` if underlines in the text indicate mnemonics
