---
description: "A Gtk.ListBoxRow used to present actions."
---

# AdwActionRow

A `Gtk.ListBoxRow` used to present actions.



The `AdwActionRow` widget can have a title, a subtitle and an icon. The row
can receive additional widgets at its end, or prefix widgets at its start.

It is convenient to present a preference and its related actions.

`AdwActionRow` is unactivatable by default, giving it an activatable widget
will automatically make it activatable, but unsetting it won't change the
row's activatability.

### AdwActionRow as GtkBuildable

The `AdwActionRow` implementation of the `Gtk.Buildable` interface
supports adding a child at its end by specifying “suffix” or omitting the
“type” attribute of a <child> element.

It also supports adding a child as a prefix widget by specifying “prefix” as
the “type” attribute of a <child> element.

### CSS nodes

`AdwActionRow` has a main CSS node with name `row`.

It contains the subnode `box.header` for its main horizontal box, and
`box.title` for the vertical box containing the title and subtitle labels.

It contains subnodes `label.title` and `label.subtitle` representing
respectively the title label and subtitle label.

### Style classes

`AdwActionRow` can use the [`.property`](style-classes.html#property-rows)
style class to emphasize the row subtitle instead of the row title, which is
useful for displaying read-only properties.



When used together with the `.monospace` style class, only the subtitle
becomes monospace, not the title or any extra widgets.

```tsx
import { AdwActionRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → **AdwActionRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ActionRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatableWidget`

`Gtk.Widget | ReactElement`

The widget to activate when the row is activated.

The row can be activated either by clicking on it, calling
`ActionRow.activate()`, or via mnemonics in the title.
See the `PreferencesRow.useUnderline` property to enable
mnemonics.

The target widget will be activated by emitting the
`Gtk.Widget.mnemonic-activate` signal on it.

### `iconName`

`string` · deprecated since 1.3

The icon name for this row.

> **Deprecated since 1.3.** Use `ActionRow.addPrefix()` to add an icon.

### `prefix`

`ReactNode | null`

Widgets added at the start of the row, before its title.

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

### `subtitleSelectable`

`boolean` · default `false`

Whether the user can copy the subtitle from the label.

See also `Gtk.Label.selectable`.

_Available since 1.3._

### `suffix`

`ReactNode | null`

Widgets added at the end of the row.

### `titleLines`

`number` · default `0`

The number of lines at the end of which the title label will be ellipsized.

If the value is 0, the number of lines won't be limited.

## Signals

### `onActivated`

```ts
(self: Adw.ActionRow) => void
```

This signal is emitted after the row has been activated.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.ActionRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `actionRowActivate`

```ts
actionRowActivate(): void
```

Activates `self`.

### `addPrefix`

```ts
addPrefix(widget: Gtk.Widget): void
```

Adds a prefix widget to `self`.

**Parameters**

- `widget`: a widget

### `addSuffix`

```ts
addSuffix(widget: Gtk.Widget): void
```

Adds a suffix widget to `self`.

**Parameters**

- `widget`: a widget

### `getActivatableWidget`

```ts
getActivatableWidget(): Gtk.Widget | null
```

Gets the widget activated when `self` is activated.

**Returns** the activatable widget for `self`

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name for `self`.

**Returns** the icon name for `self`

> **Deprecated since 1.3.** Use `ActionRow.addPrefix()` to add an icon.

### `getSubtitle`

```ts
getSubtitle(): string | null
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

### `getSubtitleSelectable`

```ts
getSubtitleSelectable(): boolean
```

Gets whether the user can copy the subtitle from the label

**Returns** whether the user can copy the subtitle from the label

_Available since 1.3._

### `getTitleLines`

```ts
getTitleLines(): number
```

Gets the number of lines at the end of which the title label will be
ellipsized.

**Returns** the number of lines at the end of which the title label will be
  ellipsized

### `remove`

```ts
remove(widget: Gtk.Widget): void
```

Removes a child from `self`.

**Parameters**

- `widget`: the child to be removed

### `setActivatableWidget`

```ts
setActivatableWidget(widget: Gtk.Widget | null): void
```

Sets the widget to activate when `self` is activated.

The row can be activated either by clicking on it, calling
`ActionRow.activate()`, or via mnemonics in the title.
See the `PreferencesRow.useUnderline` property to enable mnemonics.

The target widget will be activated by emitting the
`Gtk.Widget.mnemonic-activate` signal on it.

**Parameters**

- `widget`: the target widget

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name for `self`.

**Parameters**

- `iconName`: the icon name

> **Deprecated since 1.3.** Use `ActionRow.addPrefix()` to add an icon.

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

### `setSubtitleSelectable`

```ts
setSubtitleSelectable(subtitleSelectable: boolean): void
```

Sets whether the user can copy the subtitle from the label

See also `Gtk.Label.selectable`.

**Parameters**

- `subtitleSelectable`: `TRUE` if the user can copy the subtitle from the label

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
