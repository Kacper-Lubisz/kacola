---
description: "An auxiliary class used by GtkStack."
---

# GtkStackPage

An auxiliary class used by `GtkStack`.

```tsx
import { GtkStackPage } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkStackPage**

Implements `GtkAccessible`.

## Props

`ref` receives the `Gtk.StackPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleRole`

`Gtk.AccessibleRole` · default `GTK_ACCESSIBLE_ROLE_NONE` · from `GtkAccessible`

The accessible role of the given `GtkAccessible` implementation.

The accessible role cannot be changed once set.

### `child`

`Gtk.Widget` · construct-only

The child that this page is for.

### `iconName`

`string` · default `null`

The icon name of the child page.

### `name`

`string` · default `null`

The name of the child page.

### `needsAttention`

`boolean` · default `false`

Whether the page requires the user attention.

This is used by the `Gtk.StackSwitcher` to change the
appearance of the corresponding button when a page needs
attention and it is not the current one.

### `title`

`string` · default `null`

The title of the child page.

### `useUnderline`

`boolean` · default `false`

If set, an underline in the title indicates a mnemonic.

### `visible`

`boolean` · default `true`

Whether this page is visible.

## Methods

Methods are called on the `Gtk.StackPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget
```

Returns the stack child to which `self` belongs.

**Returns** the child to which `self` belongs

### `getIconName`

```ts
getIconName(): string | null
```

Returns the icon name of the page.

**Returns** The value of the `Gtk.StackPage.iconName` property

### `getName`

```ts
getName(): string | null
```

Returns the name of the page.

**Returns** The value of the `Gtk.StackPage.name` property

### `getNeedsAttention`

```ts
getNeedsAttention(): boolean
```

Returns whether the page is marked as “needs attention”.

**Returns** The value of the `Gtk.StackPage.needsAttention`
  property.

### `getTitle`

```ts
getTitle(): string | null
```

Gets the page title.

**Returns** The value of the `Gtk.StackPage.title` property

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether underlines in the page title indicate mnemonics.

**Returns** The value of the `Gtk.StackPage.useUnderline` property

### `getVisible`

```ts
getVisible(): boolean
```

Returns whether `page` is visible in its `GtkStack`.

This is independent from the `Gtk.Widget.visible`
property of its widget.

**Returns** `true` if `page` is visible

### `setIconName`

```ts
setIconName(setting: string): void
```

Sets the icon name of the page.

**Parameters**

- `setting`: the new value to set

### `setName`

```ts
setName(setting: string): void
```

Sets the name of the page.

**Parameters**

- `setting`: the new value to set

### `setNeedsAttention`

```ts
setNeedsAttention(setting: boolean): void
```

Sets whether the page is marked as “needs attention”.

**Parameters**

- `setting`: the new value to set

### `setTitle`

```ts
setTitle(setting: string): void
```

Sets the page title.

**Parameters**

- `setting`: the new value to set

### `setUseUnderline`

```ts
setUseUnderline(setting: boolean): void
```

Sets whether underlines in the page title indicate mnemonics.

**Parameters**

- `setting`: the new value to set

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets whether `page` is visible in its `GtkStack`.

**Parameters**

- `visible`: The new property value
