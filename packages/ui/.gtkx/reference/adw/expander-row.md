---
description: "A Gtk.ListBoxRow used to reveal widgets."
---

# AdwExpanderRow

A `Gtk.ListBoxRow` used to reveal widgets.



The `AdwExpanderRow` widget allows the user to reveal or hide widgets below
it. It also allows the user to enable the expansion of the row, allowing to
disable all that the row contains.

### AdwExpanderRow as GtkBuildable

The `AdwExpanderRow` implementation of the `Gtk.Buildable` interface
supports adding a child as an suffix widget by specifying “suffix” as the
“type” attribute of a <child> element.

It also supports adding it as a prefix widget by specifying “prefix” as the
“type” attribute of a <child> element.

### CSS nodes

`AdwExpanderRow` has a main CSS node with name `row` and the `.expander`
style class. It has the `.empty` style class when it contains no children.

It contains the subnodes `row.header` for its main embedded row,
`list.nested` for the list it can expand, and `image.expander-row-arrow` for
its arrow.

### Style classes

`AdwExpanderRow` can use the [`.`](style-classes.html#property-rows)
style class to emphasize the row subtitle instead of the row title, which is
useful for displaying read-only properties.

When used together with the `.monospace` style class, only the subtitle
becomes monospace, not the title or any extra widgets.

```tsx
import { AdwExpanderRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → **AdwExpanderRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ExpanderRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableExpansion`

`boolean` · default `true`

Whether expansion is enabled.

### `expanded`

`boolean` · default `false`

Whether the row is expanded.

### `iconName`

`string` · deprecated since 1.3

The icon name for this row.

> **Deprecated since 1.3.** Use `ExpanderRow.addPrefix()` to add an icon.

### `prefix`

`ReactNode | null`

Widgets added at the start of the row, before its title.

### `rows`

`ReactNode | null`

Widgets added to the area the row reveals when it expands.

### `showEnableSwitch`

`boolean` · default `false`

Whether the switch enabling the expansion is visible.

### `subtitle`

`string`

The subtitle for this row.

The subtitle is interpreted as Pango markup unless
`PreferencesRow.useMarkup` is set to `FALSE`.

### `subtitleLines`

`number` · default `0`

The number of lines at the end of which the subtitle label will be
ellipsized.

If the value is 0, the number of lines won't be limited.

_Available since 1.3._

### `suffix`

`ReactNode | null`

Widgets added at the end of the row.

### `titleLines`

`number` · default `0`

The number of lines at the end of which the title label will be ellipsized.

If the value is 0, the number of lines won't be limited.

_Available since 1.3._

## Methods

Methods are called on the `Adw.ExpanderRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addAction`

```ts
addAction(widget: Gtk.Widget): void
```

Adds an action widget to `self`.

**Parameters**

- `widget`: a widget

> **Deprecated since 1.4.** Use `ExpanderRow.addSuffix()` to add a suffix.

### `addPrefix`

```ts
addPrefix(widget: Gtk.Widget): void
```

Adds a prefix widget to `self`.

**Parameters**

- `widget`: a widget

### `addRow`

```ts
addRow(child: Gtk.Widget): void
```

Adds a widget to `self`.

The widget will appear in the expanding list below `self`.

**Parameters**

- `child`: a widget

### `addSuffix`

```ts
addSuffix(widget: Gtk.Widget): void
```

Adds an suffix widget to `self`.

**Parameters**

- `widget`: a widget

_Available since 1.4._

### `getEnableExpansion`

```ts
getEnableExpansion(): boolean
```

Gets whether the expansion of `self` is enabled.

**Returns** whether the expansion of `self` is enabled.

### `getExpanded`

```ts
getExpanded(): boolean
```

Gets whether `self` is expanded.

**Returns** whether `self` is expanded

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name for `self`.

**Returns** the icon name for `self`

> **Deprecated since 1.3.** Use `ExpanderRow.addPrefix()` to add an icon.

### `getShowEnableSwitch`

```ts
getShowEnableSwitch(): boolean
```

Gets whether the switch enabling the expansion of `self` is visible.

**Returns** whether the switch enabling the expansion is visible

### `getSubtitle`

```ts
getSubtitle(): string
```

Gets the subtitle for `self`.

**Returns** the subtitle for `self`

### `getSubtitleLines`

```ts
getSubtitleLines(): number
```

Gets the number of lines at the end of which the subtitle label will be
ellipsized.

**Returns** the number of lines at the end of which the subtitle label will be
  ellipsized

_Available since 1.3._

### `getTitleLines`

```ts
getTitleLines(): number
```

Gets the number of lines at the end of which the title label will be
ellipsized.

**Returns** the number of lines at the end of which the title label will be
  ellipsized

_Available since 1.3._

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child from `self`.

**Parameters**

- `child`: the child to be removed

### `setEnableExpansion`

```ts
setEnableExpansion(enableExpansion: boolean): void
```

Sets whether the expansion of `self` is enabled.

**Parameters**

- `enableExpansion`: whether to enable the expansion

### `setExpanded`

```ts
setExpanded(expanded: boolean): void
```

Sets whether `self` is expanded.

**Parameters**

- `expanded`: whether to expand the row

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name for `self`.

**Parameters**

- `iconName`: the icon name

> **Deprecated since 1.3.** Use `ExpanderRow.addPrefix()` to add an icon.

### `setShowEnableSwitch`

```ts
setShowEnableSwitch(showEnableSwitch: boolean): void
```

Sets whether the switch enabling the expansion of `self` is visible.

**Parameters**

- `showEnableSwitch`: whether to show the switch enabling the expansion

### `setSubtitle`

```ts
setSubtitle(subtitle: string): void
```

Sets the subtitle for `self`.

The subtitle is interpreted as Pango markup unless
`PreferencesRow.useMarkup` is set to `FALSE`.

**Parameters**

- `subtitle`: the subtitle

### `setSubtitleLines`

```ts
setSubtitleLines(subtitleLines: number): void
```

Sets the number of lines at the end of which the subtitle label will be
ellipsized.

If the value is 0, the number of lines won't be limited.

**Parameters**

- `subtitleLines`: the number of lines at the end of which the subtitle label will be ellipsized

_Available since 1.3._

### `setTitleLines`

```ts
setTitleLines(titleLines: number): void
```

Sets the number of lines at the end of which the title label will be
ellipsized.

If the value is 0, the number of lines won't be limited.

**Parameters**

- `titleLines`: the number of lines at the end of which the title label will be ellipsized

_Available since 1.3._
