---
description: "An item within SidebarSection."
---

# AdwSidebarItem

An item within `SidebarSection`.

Sidebar items must have a title, set via `SidebarItem.title`.

Sidebar items should, but are not required to, have an icon. Icons can be set
from an icon name, via `SidebarItem.iconName`, or a
`Gdk.Paintable`, via `SidebarItem.iconPaintable`.

Items can also have subtitles, set with the `SidebarItem.subtitle`
property. Subtitles should be used sparingly.

To add a tooltip, use `SidebarItem.tooltip`. Tooltips always use
Pango markup.

Items can have an arbitrary suffix widget, set with the
`SidebarItem.suffix` properties. It will be displayed at the end of
its row, or before the arrow in the `Adw.SidebarMode.page` mode.

To hide or disable the item, use the `SidebarItem.visible` and
`SidebarItem.enabled` properties respectively.

To access the items's section, use `SidebarItem.section`.

It's also possible to access the index of the item in both the section and
the sidebar, using `SidebarItem.getSectionIndex()` and
`SidebarItem.getIndex()` respectively.

Dragging content over sidebar items activates them by default. To disable
this behavior, set `SidebarItem.dragMotionActivate` to `FALSE`.

`AdwSidebarItem` is derivable, and applications that need to associate each
page with data can store it in the items themselves  this way.

_Available since 1.9._

```tsx
import { AdwSidebarItem } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwSidebarItem**

## Props

`ref` receives the `Adw.SidebarItem` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `dragMotionActivate`

`boolean` · default `true`

Whether to activate the item on pointer motion during Drag-and-Drop.

This is needed to be able to drag content into the page the item
represents, when the sidebar is used as a page switcher. However, it may be
unwanted when dropping content onto the item itself, so it can be disabled.

_Available since 1.9._

### `enabled`

`boolean` · default `true`

Whether the item is enabled.

See `Gtk.Widget.sensitive`.

_Available since 1.9._

### `iconName`

`string` · default `null`

The icon name for this item.

Mutually exclusive with `SidebarItem.iconPaintable`.

_Available since 1.9._

### `iconPaintable`

`Gdk.Paintable | ReactElement`

The paintable to use as the icon for this item.

Mutually exclusive with `SidebarItem.iconName`.

_Available since 1.9._

### `section`

`Adw.SidebarSection` · read-only, observe with `onNotifySection`

The section the item is in.

_Available since 1.9._

### `subtitle`

`string`

Subtitle of the item.

_Available since 1.9._

### `suffix`

`Gtk.Widget | ReactElement`

The suffix widget for this item.

Suffix will be shown at the end of the item's row, or before the arrow in
the `Adw.SidebarMode.page` mode.

_Available since 1.9._

### `title`

`string`

Title of the item.

_Available since 1.9._

### `tooltip`

`string`

The tooltip of the item.

The tooltip can be marked up with the Pango text markup language.

_Available since 1.9._

### `useUnderline`

`boolean` · default `false`

Whether an underline in the title indicates a mnemonic.

The mnemonic can be used to activate the item.

_Available since 1.9._

### `visible`

`boolean` · default `true`

Whether the item is visible.

_Available since 1.9._

## Methods

Methods are called on the `Adw.SidebarItem` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getDragMotionActivate`

```ts
getDragMotionActivate(): boolean
```

Gets whether `self` will be activated on pointer motion during Drag-and-Drop.

**Returns** whether to enable the item on drag motion

_Available since 1.9._

### `getEnabled`

```ts
getEnabled(): boolean
```

Gets whether `self` is enabled.

**Returns** whether the item is enabled

_Available since 1.9._

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name for `item`.

**Returns** the icon name

_Available since 1.9._

### `getIconPaintable`

```ts
getIconPaintable(): Gdk.Paintable | null
```

Gets the paintable used as the icon for `item`.

**Returns** the icon paintable

_Available since 1.9._

### `getIndex`

```ts
getIndex(): number
```

Gets index of `self` within its `Sidebar`.

If `self` is within a section, but that section is not in a sidebar, index
will be within the section only.

If `self` is not within a section, the index will be 0.

The item can later be retrieved by passing this index into
`Sidebar.getItem()`.

**Returns** the index of `self`

_Available since 1.9._

### `getSection`

```ts
getSection(): Adw.SidebarSection | null
```

Gets the section `self` is in.

**Returns** the section of `self`

_Available since 1.9._

### `getSectionIndex`

```ts
getSectionIndex(): number
```

Gets index of `self` within its `SidebarSection`.

If `self` is not within a section, the index will be 0.

The item can later be retrieved by passing this index into
`SidebarSection.getItem()`.

**Returns** the index of `self`

_Available since 1.9._

### `getSubtitle`

```ts
getSubtitle(): string | null
```

Gets the subtitle of `self`.

**Returns** the subtitle

_Available since 1.9._

### `getSuffix`

```ts
getSuffix(): Gtk.Widget | null
```

Gets the suffix widget for `self`.

**Returns** the suffix widget

_Available since 1.9._

### `getTitle`

```ts
getTitle(): string | null
```

Gets the title of `self`.

**Returns** the title

_Available since 1.9._

### `getTooltip`

```ts
getTooltip(): string | null
```

Gets the tooltip of `self`.

**Returns** the tooltip

_Available since 1.9._

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether an underline in the title indicates a mnemonic.

**Returns** whether an underline in the text indicates a mnemonic

_Available since 1.9._

### `getVisible`

```ts
getVisible(): boolean
```

Gets whether `self` is visible.

**Returns** whether the item is visible

_Available since 1.9._

### `setDragMotionActivate`

```ts
setDragMotionActivate(dragMotionActivate: boolean): void
```

Sets whether to activate `self` on pointer motion during Drag-and-Drop.

This is needed to be able to drag content into the page the item
represents, when the sidebar is used as a page switcher. However, it may be
unwanted when dropping content onto the item itself, so it can be disabled.

**Parameters**

- `dragMotionActivate`: whether to enable the item on drag motion

_Available since 1.9._

### `setEnabled`

```ts
setEnabled(enabled: boolean): void
```

Sets whether `self` is enabled.

See `Gtk.Widget.sensitive`.

**Parameters**

- `enabled`: whether to enable the item

_Available since 1.9._

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name for `item`.

Mutually exclusive with `SidebarItem.iconPaintable`.

**Parameters**

- `iconName`: the icon name

_Available since 1.9._

### `setIconPaintable`

```ts
setIconPaintable(paintable: Gdk.Paintable | null): void
```

Sets the paintable to use as the icon for `item`.

Mutually exclusive with `SidebarItem.iconName`.

**Parameters**

- `paintable`: the icon paintable

_Available since 1.9._

### `setSubtitle`

```ts
setSubtitle(subtitle: string | null): void
```

Sets the subtitle of `self`.

**Parameters**

- `subtitle`: the subtitle

_Available since 1.9._

### `setSuffix`

```ts
setSuffix(suffix: Gtk.Widget | null): void
```

Sets the suffix widget for `self`.

Suffix will be shown at the end of the item's row, or before the arrow in
the `Adw.SidebarMode.page` mode.

**Parameters**

- `suffix`: the suffix widget

_Available since 1.9._

### `setTitle`

```ts
setTitle(title: string | null): void
```

Sets the title of `self`.

**Parameters**

- `title`: the title

_Available since 1.9._

### `setTooltip`

```ts
setTooltip(tooltip: string | null): void
```

Sets the tooltip of `self`.

The tooltip can be marked up with the Pango text markup language.

**Parameters**

- `tooltip`: the tooltip

_Available since 1.9._

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether an underline in the title indicates a mnemonic.

The mnemonic can be used to activate the item.

**Parameters**

- `useUnderline`: whether an underline in the text indicates a mnemonic

_Available since 1.9._

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets whether `self` is visible.

**Parameters**

- `visible`: whether the item is visible

_Available since 1.9._
