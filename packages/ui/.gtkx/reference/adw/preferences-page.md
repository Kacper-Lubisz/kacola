---
description: "A page from PreferencesDialog."
---

# AdwPreferencesPage

A page from `PreferencesDialog`.



The `AdwPreferencesPage` widget gathers preferences groups into a single page
of a preferences window.

### CSS nodes

`AdwPreferencesPage` has a single CSS node with name `preferencespage`.

### Accessibility

`AdwPreferencesPage` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { AdwPreferencesPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwPreferencesPage**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.PreferencesPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `banner`

`Adw.Banner | ReactElement`

A `Banner` displayed at the top of the page.

_Available since 1.7._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `description`

`string`

The description to be displayed at the top of the page.

_Available since 1.4._

### `descriptionCentered`

`boolean` · default `false`

Whether the description should be centered.

_Available since 1.6._

### `iconName`

`string`

The icon name for this page.

### `name`

`string` · default `null`

The name of this page.

### `title`

`string`

The title for this page.

### `useUnderline`

`boolean` · default `false`

Whether an embedded underline in the title indicates a mnemonic.

## Methods

Methods are called on the `Adw.PreferencesPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(group: Adw.PreferencesGroup): void
```

Adds a preferences group to `self`.

**Parameters**

- `group`: the group to add

### `getBanner`

```ts
getBanner(): Adw.Banner | null
```

Gets the banner displayed at the top of the page.

**Returns** the banner for `self`

_Available since 1.7._

### `getDescription`

```ts
getDescription(): string
```

Gets the description of `self`.

**Returns** the description of `self`.

_Available since 1.4._

### `getDescriptionCentered`

```ts
getDescriptionCentered(): boolean
```

Gets whether the description is centered.

**Returns** whether the description is centered.

_Available since 1.6._

### `getGroup`

```ts
getGroup(index: number): Adw.PreferencesGroup | null
```

Gets the group at `index`.

Can return `NULL` if `index` is larger than the number of groups in the page.

**Parameters**

- `index`: a group index

**Returns** the group at `index`

_Available since 1.8._

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name for `self`.

**Returns** the icon name for `self`

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title of `self`.

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether an embedded underline in the title indicates a mnemonic.

**Returns** whether an embedded underline in the title indicates a mnemonic

### `insert`

```ts
insert(group: Adw.PreferencesGroup, index: number): void
```

Inserts a preferences group to `self` at `index`.

If `index` is negative or larger than the number of groups, appends the group,
same as `PreferencesPage.add()`.

**Parameters**

- `group`: the group to add
- `index`: the index to insert `group` a

_Available since 1.8._

### `preferencesPageGetName`

```ts
preferencesPageGetName(): string | null
```

Gets the name of `self`.

**Returns** the name of `self`

### `remove`

```ts
remove(group: Adw.PreferencesGroup): void
```

Removes a group from `self`.

**Parameters**

- `group`: the group to remove

### `scrollToTop`

```ts
scrollToTop(): void
```

Scrolls the scrolled window of `self` to the top.

_Available since 1.3._

### `setBanner`

```ts
setBanner(banner: Adw.Banner | null): void
```

Sets the banner displayed at the top of the page.

**Parameters**

- `banner`: the banner to display at the top of the page

_Available since 1.7._

### `setDescription`

```ts
setDescription(description: string): void
```

Sets the description of `self`.

The description is displayed at the top of the page.

**Parameters**

- `description`: the description

_Available since 1.4._

### `setDescriptionCentered`

```ts
setDescriptionCentered(centered: boolean): void
```

Sets whether the description should be centered.

**Parameters**

- `centered`: If the description should be centered

_Available since 1.6._

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name for `self`.

**Parameters**

- `iconName`: the icon name

### `setName`

```ts
setName(name: string | null): void
```

Sets the name of `self`.

**Parameters**

- `name`: the name

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `self`.

**Parameters**

- `title`: the title

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether an embedded underline in the title indicates a mnemonic.

**Parameters**

- `useUnderline`: `TRUE` if underlines in the text indicate mnemonics
