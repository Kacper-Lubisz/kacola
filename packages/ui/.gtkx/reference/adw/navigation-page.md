---
description: "A page within NavigationView or NavigationSplitView."
---

# AdwNavigationPage

A page within `NavigationView` or `NavigationSplitView`.

Each page has a child widget, a title and optionally a tag.

The `NavigationPage.showing`, `NavigationPage.shown`,
`NavigationPage.hiding` and `NavigationPage.hidden` signals
can be used to track the page's visibility within its `AdwNavigationView`.

### Header Bar Integration

When placed inside `AdwNavigationPage`, `HeaderBar` will display the
page title instead of window title.

When used together with `NavigationView`, it will also display a back
button that can be used to go back to the previous page. Set
`HeaderBar.showBackButton` to `FALSE` to disable that behavior if
it's unwanted.

### CSS Nodes

`AdwNavigationPage` has a single CSS node with name
`navigation-view-page`.

### Accessibility

`AdwNavigationPage` uses the `Gtk.AccessibleRole.group` role.

_Available since 1.4._

```tsx
import { AdwNavigationPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwNavigationPage**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.NavigationPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `canPop`

`boolean` · default `true`

Whether the page can be popped from navigation stack.

Set it to `FALSE` to disable shortcuts and gestures, as well as remove the
back button from `HeaderBar`.

Manually calling `NavigationView.pop()` or using the `navigation.pop`
action will still work.

See `HeaderBar.showBackButton` for removing only the back
button, but not shortcuts.

_Available since 1.4._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `tag`

`string` · default `null`

The page tag.

The tag can be used to retrieve the page with
`NavigationView.findPage()`, as well as with
`NavigationView.pushByTag()`, `NavigationView.popToTag()` or
`NavigationView.replaceWithTags()`.

Tags must be unique within each `NavigationView`.

The tag also must be set to use the `navigation.push` action.

_Available since 1.4._

### `title`

`string`

The page title.

It's displayed in `HeaderBar` instead of the window title, and used
as the tooltip on the next page's back button, as well as by screen reader.

_Available since 1.4._

## Signals

### `onHidden`

```ts
(self: Adw.NavigationPage) => void
```

Emitted when the navigation view transition has been completed and the page
is fully hidden.

It will always be preceded by `NavigationPage.hiding` or
`NavigationPage.showing`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

### `onHiding`

```ts
(self: Adw.NavigationPage) => void
```

Emitted when the page starts hiding at the beginning of the navigation view
transition.

It will always be followed by `NavigationPage.hidden` or
`NavigationPage.shown`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

### `onShowing`

```ts
(self: Adw.NavigationPage) => void
```

Emitted when the page shows at the beginning of the navigation view
transition.

It will always be followed by `NavigationPage.shown` or
`NavigationPage.hidden`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

### `onShown`

```ts
(self: Adw.NavigationPage) => void
```

Emitted when the navigation view transition has been completed and the page
is fully shown.

It will always be preceded by `NavigationPage.showing` or
`NavigationPage.hiding`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

## Methods

Methods are called on the `Adw.NavigationPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCanPop`

```ts
getCanPop(): boolean
```

Gets whether `self` can be popped from navigation stack.

**Returns** whether the page can be popped from navigation stack

_Available since 1.4._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

_Available since 1.4._

### `getTag`

```ts
getTag(): string | null
```

Gets the tag of `self`.

**Returns** the page tag

_Available since 1.4._

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title of `self`

_Available since 1.4._

### `setCanPop`

```ts
setCanPop(canPop: boolean): void
```

Sets whether `self` can be popped from navigation stack.

Set it to `FALSE` to disable shortcuts and gestures, as well as remove the
back button from `HeaderBar`.

Manually calling `NavigationView.pop()` or using the `navigation.pop`
action will still work.

See `HeaderBar.showBackButton` for removing only the back button,
but not shortcuts.

**Parameters**

- `canPop`: whether the page can be popped from navigation stack

_Available since 1.4._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

_Available since 1.4._

### `setTag`

```ts
setTag(tag: string | null): void
```

Sets the tag for `self`.

The tag can be used to retrieve the page with
`NavigationView.findPage()`, as well as with
`NavigationView.pushByTag()`, `NavigationView.popToTag()` or
`NavigationView.replaceWithTags()`.

Tags must be unique within each `NavigationView`.

The tag also must be set to use the `navigation.push` action.

**Parameters**

- `tag`: the page tag

_Available since 1.4._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `self`.

It's displayed in `HeaderBar` instead of the window title, and used as
the tooltip on the next page's back button, as well as by screen reader.

**Parameters**

- `title`: the title

_Available since 1.4._
