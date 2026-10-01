---
description: "An adaptive sidebar that controls an ViewStack."
---

# AdwViewSwitcherSidebar

An adaptive sidebar that controls an `ViewStack`.



`AdwViewSwitcherSidebar` is a view switcher implemented using a
`Sidebar`, in a similar fashion to `Gtk.StackSidebar`.

`AdwViewSwitcherSidebar` items have an icon, a label, as well as an unread
dot or a badge.

Unlike other switchers, `AdwViewSwitcherSidebar` supports grouping pages into
sections, using the `ViewStackPage.startsSection` and
`ViewStackPage.sectionTitle` properties.

Like `Sidebar`, `AdwViewSwitcherSidebar` is adaptive and can behave as
a sidebar or a page, via the `ViewSwitcherSidebar.mode` property.



Connect to the `ViewSwitcherSidebar.activated` signal to run code when
an item has been activated. This can be used to toggle the visible pane when
used in a split view.

Like `AdwSidebar`, `AdwViewSwitcherSidebar` supports filtering items via the
`ViewSwitcherSidebar.filter` property.

Use `ViewSwitcherSidebar.placeholder` to provide an empty state
widget. It will be shown when all items have been filtered out, or the
sidebar has no items otherwise.

### CSS nodes

`AdwViewSwitcherSidebar` has a single CSS node with name
`view-switcher-sidebar`.

See also: `ViewSwitcher`, `ViewSwitcherBar`,
`InlineViewSwitcher`.

_Available since 1.9._

```tsx
import { AdwViewSwitcherSidebar } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwViewSwitcherSidebar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ViewSwitcherSidebar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `filter`

`Gtk.Filter | ReactElement`

The item filter.

Can be used to implement search within the sidebar.

Use `ViewSwitcherSidebar.placeholder` to provide an empty state.

See `Sidebar.filter`.

_Available since 1.9._

### `mode`

`Adw.SidebarMode` · default `ADW_SIDEBAR_MODE_SIDEBAR`

Determines the sidebar's look and behavior.



If set to `Adw.SidebarMode.sidebar`, behaves like a sidebar: with a
sidebar style and a persistent selection.

If set to `Adw.SidebarMode.page`, behaves like a page of boxed lists.

The page mode is intended to be used with `NavigationSplitView` when
collapsed, as the sidebar pane becomes a page there.

When used with `OverlaySplitView`, the sidebar should stay in sidebar
mode, as the sidebar pane is still a sidebar when collapsed.

See `Sidebar.mode`.

_Available since 1.9._

### `placeholder`

`Gtk.Widget | ReactElement`

The placeholder widget.

This widget will be shown if the sidebar has no items, or all of its items
have been filtered out by `ViewSwitcherSidebar.filter`.

See `Sidebar.placeholder`.

_Available since 1.9._

### `stack`

`Adw.ViewStack | ReactElement`

The stack the sidebar controls.

_Available since 1.9._

## Signals

### `onActivated`

```ts
(self: Adw.ViewSwitcherSidebar) => void
```

Emitted when an item has been activated.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.9._

## Methods

Methods are called on the `Adw.ViewSwitcherSidebar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getFilter`

```ts
getFilter(): Gtk.Filter | null
```

Gets the item filter for `self`.

**Returns** the item filter

_Available since 1.9._

### `getMode`

```ts
getMode(): Adw.SidebarMode
```

Gets `self`'s look and behavior.

See `Sidebar.getMode()`.

**Returns** the current mode

_Available since 1.9._

### `getPlaceholder`

```ts
getPlaceholder(): Gtk.Widget | null
```

Gets the placeholder widget for `self`.

**Returns** the placeholder widget

_Available since 1.9._

### `getStack`

```ts
getStack(): Adw.ViewStack | null
```

Gets the stack `self` controls.

**Returns** The stack of `self`

_Available since 1.9._

### `setFilter`

```ts
setFilter(filter: Gtk.Filter | null): void
```

Sets the item filter for `self`.

Can be used to implement search within the sidebar.

Use `ViewSwitcherSidebar.placeholder` to provide an empty state.

See `Sidebar.setFilter()`.

**Parameters**

- `filter`: the item filter

_Available since 1.9._

### `setMode`

```ts
setMode(mode: Adw.SidebarMode): void
```

Sets `self`'s look and behavior.



If set to `Adw.SidebarMode.sidebar`, behaves like a sidebar: with a
sidebar style and a persistent selection.

If set to `Adw.SidebarMode.page`, behaves like a page of boxed lists.
In this mode, the selection is invisible and only tracked to determine the
initially selected item once switched back to sidebar mode.

The page mode is intended to be used with `NavigationSplitView` when
collapsed, as the sidebar pane becomes a page there.

When used with `OverlaySplitView`, the sidebar should stay in sidebar
mode, as the sidebar pane is still a sidebar when collapsed.

See `Sidebar.setMode()`.

**Parameters**

- `mode`: the new mode

_Available since 1.9._

### `setPlaceholder`

```ts
setPlaceholder(placeholder: Gtk.Widget | null): void
```

Sets the placeholder widget for `self`.

This widget will be shown if `self` has no items, or all of its items have
been filtered out by `ViewSwitcherSidebar.filter`.

See `Sidebar.setPlaceholder()`.

**Parameters**

- `placeholder`: the placeholder widget

_Available since 1.9._

### `setStack`

```ts
setStack(stack: Adw.ViewStack | null): void
```

Sets the stack to control.

**Parameters**

- `stack`: a stack

_Available since 1.9._
