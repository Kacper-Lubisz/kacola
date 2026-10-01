---
description: "A helper widget for creating buttons."
---

# AdwButtonContent

A helper widget for creating buttons.



`AdwButtonContent` is a box-like widget with an icon and a label.

It's intended to be used as a direct child of `Gtk.Button`,
`Gtk.MenuButton` or `SplitButton`, when they need to have both an
icon and a label, as follows:

```xml
<object class="GtkButton">
  <property name="child">
    <object class="AdwButtonContent">
      <property name="icon-name">document-open-symbolic</property>
      <property name="label" translatable="yes">_Open</property>
      <property name="use-underline">True</property>
    </object>
  </property>
</object>
```

`AdwButtonContent` handles style classes and connecting the mnemonic to the
button automatically.

### CSS nodes

```
buttoncontent
╰── box
    ├── image
    ╰── label
```

`AdwButtonContent`'s CSS node is called `buttoncontent`. It contains a `box`
subnode that serves as a container for the  `image` and `label` nodes.

When inside a `GtkButton` or `AdwSplitButton`, the button will receive the
`.image-text-button` style class. When inside a `GtkMenuButton`, the
internal `GtkButton` will receive it instead.

### Accessibility

`AdwButtonContent` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { AdwButtonContent } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwButtonContent**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ButtonContent` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `canShrink`

`boolean` · default `false`

Whether the button can be smaller than the natural size of its contents.

If set to `TRUE`, the label will ellipsize.

See `Gtk.Button.canShrink`.

_Available since 1.4._

### `iconName`

`string`

The name of the displayed icon.

If empty, the icon is not shown.

### `label`

`string`

The displayed label.

### `useUnderline`

`boolean` · default `false`

Whether an underline in the text indicates a mnemonic.

The mnemonic can be used to activate the parent button.

See `ButtonContent.label`.

## Methods

Methods are called on the `Adw.ButtonContent` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCanShrink`

```ts
getCanShrink(): boolean
```

gets whether the button can be smaller than the natural size of its contents.

**Returns** whether the button can shrink

_Available since 1.4._

### `getIconName`

```ts
getIconName(): string
```

Gets the name of the displayed icon.

**Returns** the icon name

### `getLabel`

```ts
getLabel(): string
```

Gets the displayed label.

**Returns** the label

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether an underline in the text indicates a mnemonic.

**Returns** whether an underline in the text indicates a mnemonic

### `setCanShrink`

```ts
setCanShrink(canShrink: boolean): void
```

Sets whether the button can be smaller than the natural size of its contents.

If set to `TRUE`, the label will ellipsize.

See `Gtk.Button.setCanShrink()`.

**Parameters**

- `canShrink`: whether the button can shrink

_Available since 1.4._

### `setIconName`

```ts
setIconName(iconName: string): void
```

Sets the name of the displayed icon.

If empty, the icon is not shown.

**Parameters**

- `iconName`: the new icon name

### `setLabel`

```ts
setLabel(label: string): void
```

Sets the displayed label.

**Parameters**

- `label`: the new label

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether an underline in the text indicates a mnemonic.

The mnemonic can be used to activate the parent button.

See `ButtonContent.label`.

**Parameters**

- `useUnderline`: whether an underline in the text indicates a mnemonic
