---
description: "AdwEnumListItem is the type of items in a EnumListModel."
---

# AdwEnumListItem

`AdwEnumListItem` is the type of items in a `EnumListModel`.

```tsx
import { AdwEnumListItem } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwEnumListItem**

## Props

`ref` receives the `Adw.EnumListItem` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `name`

`string` · default `null` · read-only, observe with `onNotifyName`

The enum value name.

### `nick`

`string` · default `null` · read-only, observe with `onNotifyNick`

The enum value nick.

### `value`

`number` · default `0` · read-only, observe with `onNotifyValue`

The enum value.

## Methods

Methods are called on the `Adw.EnumListItem` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getName`

```ts
getName(): string
```

Gets the enum value name.

**Returns** the enum value name

### `getNick`

```ts
getNick(): string
```

Gets the enum value nick.

**Returns** the enum value nick

### `getValue`

```ts
getValue(): number
```

Gets the enum value.

**Returns** the enum value
