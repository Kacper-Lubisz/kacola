---
description: "A dialog showing application's preferences."
---

# AdwPreferencesDialog

A dialog showing application's preferences.



The `AdwPreferencesDialog` widget presents an application's preferences
gathered into pages and groups. The preferences are searchable by the user.

### Actions

`AdwPrefencesDialog` defines the `navigation.pop` action, it doesn't take any
parameters and pops the current subpage from the navigation stack, equivalent
to calling `PreferencesDialog.popSubpage()`.

### CSS nodes

`AdwPreferencesDialog` has a main CSS node with the name `dialog` and the
style class `.preferences`.

_Available since 1.5._

```tsx
import { AdwPreferencesDialog } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [AdwDialog](.gtkx/reference/adw/dialog.md) → **AdwPreferencesDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.PreferencesDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `searchEnabled`

`boolean` · default `false`

Whether search is enabled.

_Available since 1.5._

### `visiblePage`

`Gtk.Widget | ReactElement`

The currently visible page.

_Available since 1.5._

### `visiblePageName`

`string` · default `null`

The name of the currently visible page.

See `AdwPreferencesDialog.visiblePage`.

_Available since 1.5._

## Methods

Methods are called on the `Adw.PreferencesDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(page: Adw.PreferencesPage): void
```

Adds a preferences page to `self`.

**Parameters**

- `page`: the page to add

_Available since 1.5._

### `addToast`

```ts
addToast(toast: Adw.Toast): void
```

Displays `toast`.

See `ToastOverlay.addToast()`.

**Parameters**

- `toast`: a toast

_Available since 1.5._

### `getSearchEnabled`

```ts
getSearchEnabled(): boolean
```

Gets whether search is enabled for `self`.

**Returns** whether search is enabled for `self`.

_Available since 1.5._

### `getVisiblePage`

```ts
getVisiblePage(): Adw.PreferencesPage | null
```

Gets the currently visible page of `self`.

**Returns** the visible page

_Available since 1.5._

### `getVisiblePageName`

```ts
getVisiblePageName(): string | null
```

Gets the name of currently visible page of `self`.

**Returns** the name of the visible page

_Available since 1.5._

### `popSubpage`

```ts
popSubpage(): boolean
```

Pop the visible page from the subpage stack of `self`.

**Returns** `TRUE` if a page has been popped

_Available since 1.5._

### `pushSubpage`

```ts
pushSubpage(page: Adw.NavigationPage): void
```

Pushes `page` onto the subpage stack of `self`.

The page will be automatically removed when popped.

**Parameters**

- `page`: the subpage

_Available since 1.5._

### `remove`

```ts
remove(page: Adw.PreferencesPage): void
```

Removes a page from `self`.

**Parameters**

- `page`: the page to remove

_Available since 1.5._

### `setSearchEnabled`

```ts
setSearchEnabled(searchEnabled: boolean): void
```

Sets whether search is enabled for `self`.

**Parameters**

- `searchEnabled`: whether search is enabled

_Available since 1.5._

### `setVisiblePage`

```ts
setVisiblePage(page: Adw.PreferencesPage): void
```

Makes `page` the visible page of `self`.

**Parameters**

- `page`: a page of `self`

_Available since 1.5._

### `setVisiblePageName`

```ts
setVisiblePageName(name: string): void
```

Makes the page with the given name visible.

See `PreferencesDialog.visiblePage`.

**Parameters**

- `name`: the name of the page to make visible

_Available since 1.5._
