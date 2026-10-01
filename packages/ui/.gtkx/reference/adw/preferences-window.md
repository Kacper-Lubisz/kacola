---
description: "A window to present an application's preferences."
---

# AdwPreferencesWindow

A window to present an application's preferences.



The `AdwPreferencesWindow` widget presents an application's preferences
gathered into pages and groups. The preferences are searchable by the user.

### CSS nodes

`AdwPreferencesWindow` has a main CSS node with the name `window` and the
style class `.preferences`.

> **Deprecated since 1.6.** Use `PreferencesDialog`.

```tsx
import { AdwPreferencesWindow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [AdwWindow](.gtkx/reference/adw/window.md) → **AdwPreferencesWindow**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.PreferencesWindow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `canNavigateBack`

`boolean` · default `false` · deprecated since 1.4

Whether gestures and shortcuts for closing subpages are enabled.

The supported gestures are:

- One-finger swipe on touchscreens
- Horizontal scrolling on touchpads (usually two-finger swipe)
- Back mouse button

The keyboard back key is also supported, as well as the
<kbd>Alt</kbd>+<kbd>←</kbd> shortcut.

For right-to-left locales, gestures and shortcuts are reversed.

Has no effect for subpages added with
`PreferencesWindow.pushSubpage()`.

> **Deprecated since 1.4.** Use `NavigationPage.canPop` instead.

### `searchEnabled`

`boolean` · default `true` · deprecated since 1.6

Whether search is enabled.

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `visiblePage`

`Gtk.Widget | ReactElement` · deprecated since 1.6

The currently visible page.

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `visiblePageName`

`string` · default `null` · deprecated since 1.6

The name of the currently visible page.

See `PreferencesWindow.visiblePage`.

> **Deprecated since 1.6.** Use `PreferencesDialog`.

## Methods

Methods are called on the `Adw.PreferencesWindow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(page: Adw.PreferencesPage): void
```

Adds a preferences page to `self`.

**Parameters**

- `page`: the page to add

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `addToast`

```ts
addToast(toast: Adw.Toast): void
```

Displays `toast`.

See `ToastOverlay.addToast()`.

**Parameters**

- `toast`: a toast

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `closeSubpage`

```ts
closeSubpage(): void
```

Closes the current subpage.

If there is no presented subpage, this does nothing.

> **Deprecated since 1.4.** Use `PreferencesWindow.popSubpage()` instead.

### `getCanNavigateBack`

```ts
getCanNavigateBack(): boolean
```

Gets whether gestures and shortcuts for closing subpages are enabled.

**Returns** whether gestures and shortcuts are enabled.

> **Deprecated since 1.4.** Use `NavigationPage.getCanPop()` instead.

### `getSearchEnabled`

```ts
getSearchEnabled(): boolean
```

Gets whether search is enabled for `self`.

**Returns** whether search is enabled for `self`.

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `getVisiblePage`

```ts
getVisiblePage(): Adw.PreferencesPage | null
```

Gets the currently visible page of `self`.

**Returns** the visible page

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `getVisiblePageName`

```ts
getVisiblePageName(): string | null
```

Gets the name of currently visible page of `self`.

**Returns** the name of the visible page

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `popSubpage`

```ts
popSubpage(): boolean
```

Pop the visible page from the subpage stack of `self`.

**Returns** `TRUE` if a page has been popped

> **Deprecated since 1.6.** Use `PreferencesDialog`.

_Available since 1.4._

### `presentSubpage`

```ts
presentSubpage(subpage: Gtk.Widget): void
```

Sets `subpage` as the window's subpage and opens it.

The transition can be cancelled by the user, in which case visible child will
change back to the previously visible child.

**Parameters**

- `subpage`: the subpage

> **Deprecated since 1.4.** Use `PreferencesWindow.pushSubpage()` instead.

### `pushSubpage`

```ts
pushSubpage(page: Adw.NavigationPage): void
```

Pushes `page` onto the subpage stack of `self`.

The page will be automatically removed when popped.

**Parameters**

- `page`: the subpage

> **Deprecated since 1.6.** Use `PreferencesDialog`.

_Available since 1.4._

### `remove`

```ts
remove(page: Adw.PreferencesPage): void
```

Removes a page from `self`.

**Parameters**

- `page`: the page to remove

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `setCanNavigateBack`

```ts
setCanNavigateBack(canNavigateBack: boolean): void
```

Sets whether gestures and shortcuts for closing subpages are enabled.

The supported gestures are:

- One-finger swipe on touchscreens
- Horizontal scrolling on touchpads (usually two-finger swipe)
- Back mouse button

The keyboard back key is also supported, as well as the
<kbd>Alt</kbd>+<kbd>←</kbd> shortcut.

For right-to-left locales, gestures and shortcuts are reversed.

Has no effect for subpages added with `PreferencesWindow.pushSubpage()`.

**Parameters**

- `canNavigateBack`: the new value

> **Deprecated since 1.4.** Use `NavigationPage.setCanPop()` instead.

### `setSearchEnabled`

```ts
setSearchEnabled(searchEnabled: boolean): void
```

Sets whether search is enabled for `self`.

**Parameters**

- `searchEnabled`: whether search is enabled

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `setVisiblePage`

```ts
setVisiblePage(page: Adw.PreferencesPage): void
```

Makes `page` the visible page of `self`.

**Parameters**

- `page`: a page of `self`

> **Deprecated since 1.6.** Use `PreferencesDialog`.

### `setVisiblePageName`

```ts
setVisiblePageName(name: string): void
```

Makes the page with the given name visible.

See `PreferencesWindow.visiblePage`.

**Parameters**

- `name`: the name of the page to make visible

> **Deprecated since 1.6.** Use `PreferencesDialog`.
