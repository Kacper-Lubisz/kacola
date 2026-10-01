---
description: "A toggle within ToggleGroup."
---

# AdwToggle

A toggle within `ToggleGroup`.

`AdwToggle` can optionally have a name, set with `Toggle.name`.
If the name is set, `ToggleGroup.activeName` can be used to access
toggles instead of index.

_Available since 1.7._

```tsx
import { AdwToggle } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwToggle**

## Props

`ref` receives the `Adw.Toggle` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `description`

`string`

The description of the toggle.

The description will be read out when using screen reader. If not set,
`Toggle.tooltip` will be used instead.

See `Gtk.AccessibleProperty.description`.

_Available since 1.9._

### `enabled`

`boolean` · default `true`

Whether this toggle is enabled.

_Available since 1.7._

### `iconName`

`string` · default `null`

The toggle icon name.

The icon will be displayed alone or next to the label, unless
`Toggle.child` is set.

_Available since 1.7._

### `label`

`string` · default `null`

The toggle label.

The label will be displayed alone or next to the icon, unless
`Toggle.child` is set, but will still be read out by the screen
reader.

_Available since 1.7._

### `name`

`string` · default `null`

The toggle name.

Allows accessing the toggle by its name instead of index.

See `ToggleGroup.activeName`.

_Available since 1.7._

### `tooltip`

`string`

The tooltip of the toggle.

The tooltip can be marked up with the Pango text markup language.

Tooltip text will also be used as accessible description. Use
`Toggle.description` to set it separately.

_Available since 1.7._

### `useUnderline`

`boolean` · default `false`

Whether an embedded underline in the label indicates a mnemonic.

See `Toggle.label`.

_Available since 1.7._

## Methods

Methods are called on the `Adw.Toggle` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the toggle child

_Available since 1.7._

### `getDescription`

```ts
getDescription(): string
```

Gets the description of `self`.

**Returns** the toggle description

_Available since 1.9._

### `getEnabled`

```ts
getEnabled(): boolean
```

Gets whether `self` is enabled.

**Returns** whether the toggle is enabled

_Available since 1.7._

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name of `self`.

**Returns** the toggle icon name

_Available since 1.7._

### `getIndex`

```ts
getIndex(): number
```

Gets the index of `self` within its toggle group.

**Returns** the index, or `Gtk.INVALID_LIST_POSITION` if it's not in a group

_Available since 1.7._

### `getLabel`

```ts
getLabel(): string | null
```

Gets the label of `self`.

**Returns** the toggle label

_Available since 1.7._

### `getName`

```ts
getName(): string
```

Gets the name of `self`.

**Returns** the toggle name

_Available since 1.7._

### `getTooltip`

```ts
getTooltip(): string
```

Gets the tooltip of `self`.

**Returns** the toggle tooltip

_Available since 1.7._

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether `self` uses underlines.

**Returns** whether the toggle uses underlines

_Available since 1.7._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child of `self` to `child`.

When the child is set, icon and label are not displayed.

It's recommended to still set the label, as it can still be used by the
screen reader.

**Parameters**

- `child`: a child widget

_Available since 1.7._

### `setDescription`

```ts
setDescription(description: string): void
```

Sets the description of `self` to `description`.

The description will be read out when using screen reader. If not set,
`Toggle.tooltip` will be used instead.

See `Gtk.AccessibleProperty.description`.

**Parameters**

- `description`: the description

_Available since 1.9._

### `setEnabled`

```ts
setEnabled(enabled: boolean): void
```

Sets whether `self` is enabled.

**Parameters**

- `enabled`: whether the toggle should be enbled

_Available since 1.7._

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name of `self` to `icon_name`.

The icon will be displayed alone or next to the label, unless
`Toggle.child` is set.

**Parameters**

- `iconName`: the icon name

_Available since 1.7._

### `setLabel`

```ts
setLabel(label: string | null): void
```

Sets the label of `self` to `label`.

The label will be displayed alone or next to the icon, unless
`Toggle.child` is set, but will still be read out by the screen
reader.

**Parameters**

- `label`: a label

_Available since 1.7._

### `setName`

```ts
setName(name: string | null): void
```

Sets the name of `self` to `name`.

Allows accessing `self` by its name instead of index.

See `ToggleGroup.activeName`.

**Parameters**

- `name`: a name

_Available since 1.7._

### `setTooltip`

```ts
setTooltip(tooltip: string): void
```

Sets the tooltip of `self` to `tooltip`.

`tooltip` can be marked up with the Pango text markup language.

Tooltip text will also be used as accessible description. Use
`Toggle.description` to set it separately.

**Parameters**

- `tooltip`: the tooltip

_Available since 1.7._

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether an embedded underline in the label indicates a mnemonic.

See `Toggle.label`.

**Parameters**

- `useUnderline`: whether an underline in the label indicates a mnemonic

_Available since 1.7._
