---
description: "An auxiliary class used by ViewStack."
---

# AdwViewStackPage

An auxiliary class used by `ViewStack`.

```tsx
import { AdwViewStackPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwViewStackPage**

Implements `GtkAccessible`.

## Props

`ref` receives the `Adw.ViewStackPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleRole`

`Gtk.AccessibleRole` · default `GTK_ACCESSIBLE_ROLE_NONE` · from `GtkAccessible`

The accessible role of the given `GtkAccessible` implementation.

The accessible role cannot be changed once set.

### `badgeNumber`

`number` · default `0`

The badge number for this page.

`ViewSwitcher` can display it as a badge next to the page icon. It is
commonly used to display a number of unread items within the page.

It can be used together with [property@ViewStack{age}:needs-attention].

### `child`

`Gtk.Widget` · construct-only

The stack child to which the page belongs.

### `iconName`

`string` · default `null`

The icon name of the child page.

### `name`

`string` · default `null`

The name of the child page.

### `needsAttention`

`boolean` · default `false`

Whether the page requires the user attention.

`ViewSwitcher` will display it as a dot next to the page icon.

### `sectionTitle`

`string` · default `null`

Section title for this page.

Does nothing unless `ViewStackPage.startsSection` is set.

_Available since 1.9._

### `startsSection`

`boolean` · default `false`

Whether this page starts a section.

If set to `TRUE`, `ViewStack.pages` will have a section starting
from this page.

If `ViewStackPage.sectionTitle` is set, it should be used as a
title for the section.

_Available since 1.9._

### `title`

`string` · default `null`

The title of the child page.

### `useUnderline`

`boolean` · default `false`

Whether an embedded underline in the title indicates a mnemonic.

### `visible`

`boolean` · default `true`

Whether this page is visible.

This is independent from the `Gtk.Widget.visible` property of
`ViewStackPage.child`.

## Methods

Methods are called on the `Adw.ViewStackPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getBadgeNumber`

```ts
getBadgeNumber(): number
```

Gets the badge number for this page.

**Returns** the badge number for this page

### `getChild`

```ts
getChild(): Gtk.Widget
```

Gets the stack child to which `self` belongs.

**Returns** the child to which `self` belongs

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name of the page.

**Returns** the icon name of the page

### `getName`

```ts
getName(): string | null
```

Gets the name of the page.

**Returns** the name of the page

### `getNeedsAttention`

```ts
getNeedsAttention(): boolean
```

Gets whether the page requires the user attention.

**Returns** whether the page needs attention

### `getSectionTitle`

```ts
getSectionTitle(): string | null
```

Gets the section title for `self`.

**Returns** the section title

_Available since 1.9._

### `getStartsSection`

```ts
getStartsSection(): boolean
```

Gets whether `self` starts a section.

**Returns** whether `self` starts a section

_Available since 1.9._

### `getTitle`

```ts
getTitle(): string | null
```

Gets the page title.

**Returns** the page title

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether underlines in the page title indicate mnemonics.

**Returns** whether underlines in the page title indicate mnemonics

### `getVisible`

```ts
getVisible(): boolean
```

Gets whether `self` is visible in its `AdwViewStack`.

This is independent from the `Gtk.Widget.visible`
property of its widget.

**Returns** whether `self` is visible

### `setBadgeNumber`

```ts
setBadgeNumber(badgeNumber: number): void
```

Sets the badge number for this page.

`ViewSwitcher` can display it as a badge next to the page icon. It is
commonly used to display a number of unread items within the page.

It can be used together with [property@ViewStack{age}:needs-attention].

**Parameters**

- `badgeNumber`: the new value to set

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name of the page.

**Parameters**

- `iconName`: the icon name

### `setName`

```ts
setName(name: string | null): void
```

Sets the name of the page.

**Parameters**

- `name`: the page name

### `setNeedsAttention`

```ts
setNeedsAttention(needsAttention: boolean): void
```

Sets whether the page requires the user attention.

`ViewSwitcher` will display it as a dot next to the page icon.

**Parameters**

- `needsAttention`: the new value to set

### `setSectionTitle`

```ts
setSectionTitle(sectionTitle: string | null): void
```

Sets the section title for `self`.

Does nothing unless `ViewStackPage.startsSection` is set.

**Parameters**

- `sectionTitle`: the section title

_Available since 1.9._

### `setStartsSection`

```ts
setStartsSection(startsSection: boolean): void
```

Sets whether `self` starts a section.

If set to `TRUE`, `ViewStack.pages` will have a section starting
from this page.

If `ViewStackPage.sectionTitle` is set, it should be used as a
title for the section.

**Parameters**

- `startsSection`: whether `self` starts a section

_Available since 1.9._

### `setTitle`

```ts
setTitle(title: string | null): void
```

Sets the page title.

**Parameters**

- `title`: the page title

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether underlines in the page title indicate mnemonics.

**Parameters**

- `useUnderline`: the new value to set

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets whether `self` is visible in its `AdwViewStack`.

This is independent from the `Gtk.Widget.visible` property of
`ViewStackPage.child`.

**Parameters**

- `visible`: whether `self` is visible
