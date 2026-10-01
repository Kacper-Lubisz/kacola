---
description: "A tab bar for TabView."
---

# AdwTabBar

A tab bar for `TabView`.



The `AdwTabBar` widget is a tab bar that can be used with conjunction with
`AdwTabView`. It is typically used as a top bar within `ToolbarView`.

`AdwTabBar` can autohide and can optionally contain action widgets on both
sides of the tabs.

When there's not enough space to show all the tabs, `AdwTabBar` will scroll
them. Pinned tabs always stay visible and aren't a part of the scrollable
area.

### Drag-and-Drop

`AdwTabBar` tabs can have an additional drop target for arbitrary content.

Use `TabBar.setupExtraDropTarget()` to set it up, specifying the
supported content types and drag actions, then connect to
`TabBar.extra-drag-drop` to handle a drop.

In some cases, it may be necessary to determine the used action based on the
content. In that case, set `TabBar.extraDragPreload` to `TRUE`
and connect to `TabBar.extra-drag-value` signal, then return the
action from its handler. To access this action from the
`TabBar.extra-drag-drop` handler, use the
`TabBar.extraDragPreferredAction` property.

`TabBar.extra-drag-value` is also always emitted when starting to
hover an item, with a `NULL` value. This happens even when
`TabBar.extraDragPreload` is `FALSE`.

### CSS nodes

`AdwTabBar` has a single CSS node with name `tabbar`.

### Style classes

By default `AdwTabBar` look like a part of an `AdwHeaderBar` and is intended
to be used directly attached to one or used as a `ToolbarView` toolbar.
The [`.inline`](style-classes.html#inline) style class removes its background,
so that it can be used in different contexts instead.

```tsx
import { AdwTabBar } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwTabBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.TabBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `autohide`

`boolean` · default `true`

Whether the tabs automatically hide.

If set to `TRUE`, the tab bar disappears when `TabBar.view` has 0
or 1 tab, no pinned tabs, and no tab is being transferred.

See `TabBar.tabsRevealed`.

### `endActionWidget`

`Gtk.Widget | ReactElement`

The widget shown after the tabs.

### `expandTabs`

`boolean` · default `true`

Whether tabs expand to full width.

If set to `TRUE`, the tabs will always vary width filling the whole width
when possible, otherwise tabs will always have the minimum possible size.

### `extraDragPreferredAction`

`Gdk.DragAction` · default `GDK_ACTION_NONE` · read-only, observe with `onNotifyExtraDragPreferredAction`

The current drag action during a drop.

This property should only be used from inside a
`TabBar.extra-drag-drop` handler.

The action will be a subset of what was originally passed to
`TabBar.setupExtraDropTarget()`.

_Available since 1.4._

### `extraDragPreload`

`boolean` · default `false`

Whether the drop data should be preloaded on hover.

See `Gtk.DropTarget.preload`.

_Available since 1.3._

### `inverted`

`boolean` · default `false`

Whether tabs use inverted layout.

If set to `TRUE`, non-pinned tabs will have the close button at the
beginning and the indicator at the end rather than the opposite.

### `isOverflowing`

`boolean` · default `false` · read-only, observe with `onNotifyIsOverflowing`

Whether the tab bar is overflowing.

If `TRUE`, all tabs cannot be displayed at once and require scrolling.

### `startActionWidget`

`Gtk.Widget | ReactElement`

The widget shown before the tabs.

### `tabsRevealed`

`boolean` · default `false` · read-only, observe with `onNotifyTabsRevealed`

Whether the tabs are currently revealed.

See `TabBar.autohide`.

### `view`

`Adw.TabView | ReactElement`

The tab view the tab bar controls.

## Signals

### `onExtraDragDrop`

```ts
(page: Adw.TabPage, value: GObject.Value, self: Adw.TabBar) => boolean | undefined
```

Emitted when content is dropped onto a tab.

The content must be of one of the types set up via
`TabBar.setupExtraDropTarget()`.

See `Gtk.DropTarget.drop`.

**Parameters**

- `page`: the page matching the tab the content was dropped onto
- `value`: the `GValue` being dropped
- `self`: The instance the signal was emitted on.

**Returns** whether the drop was accepted

### `onExtraDragValue`

```ts
(page: Adw.TabPage, value: GObject.Value | null, self: Adw.TabBar) => Gdk.DragAction | undefined
```

Emitted when the dropped content is preloaded.

In order for data to be preloaded, `TabBar.extraDragPreload`
must be set to `TRUE`.

The content must be of one of the types set up via
`TabBar.setupExtraDropTarget()`.

See `Gtk.DropTarget.value`.

**Parameters**

- `page`: the page matching the tab the content was dropped onto
- `value`: the `GValue` being dropped
- `self`: The instance the signal was emitted on.

**Returns** the preferred action for the drop

_Available since 1.3._

## Methods

Methods are called on the `Adw.TabBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAutohide`

```ts
getAutohide(): boolean
```

Gets whether the tabs automatically hide.

**Returns** whether the tabs automatically hide

### `getEndActionWidget`

```ts
getEndActionWidget(): Gtk.Widget | null
```

Gets the widget shown after the tabs.

**Returns** the widget shown after the tabs

### `getExpandTabs`

```ts
getExpandTabs(): boolean
```

Gets whether tabs expand to full width.

**Returns** whether tabs expand to full width.

### `getExtraDragPreferredAction`

```ts
getExtraDragPreferredAction(): Gdk.DragAction
```

Gets the current drag action during a drop.

This method should only be used from inside a
`TabBar.extra-drag-drop` handler.

The action will be a subset of what was originally passed to
`TabBar.setupExtraDropTarget()`.

**Returns** the drag action of the current drop

_Available since 1.4._

### `getExtraDragPreload`

```ts
getExtraDragPreload(): boolean
```

Gets whether drop data should be preloaded on hover.

**Returns** whether drop data should be preloaded on hover

_Available since 1.3._

### `getInverted`

```ts
getInverted(): boolean
```

Gets whether tabs use inverted layout.

**Returns** whether tabs use inverted layout

### `getIsOverflowing`

```ts
getIsOverflowing(): boolean
```

Gets whether `self` is overflowing.

If `TRUE`, all tabs cannot be displayed at once and require scrolling.

**Returns** whether `self` is overflowing

### `getStartActionWidget`

```ts
getStartActionWidget(): Gtk.Widget | null
```

Gets the widget shown before the tabs.

**Returns** the widget shown before the tabs

### `getTabsRevealed`

```ts
getTabsRevealed(): boolean
```

Gets whether the tabs are currently revealed.

See `TabBar.autohide`.

**Returns** whether the tabs are currently revealed

### `getView`

```ts
getView(): Adw.TabView | null
```

Gets the tab view `self` controls.

**Returns** the view `self` controls

### `setAutohide`

```ts
setAutohide(autohide: boolean): void
```

Sets whether the tabs automatically hide.

If set to `TRUE`, the tab bar disappears when `TabBar.view` has 0
or 1 tab, no pinned tabs, and no tab is being transferred.

See `TabBar.tabsRevealed`.

**Parameters**

- `autohide`: whether the tabs automatically hide

### `setEndActionWidget`

```ts
setEndActionWidget(widget: Gtk.Widget | null): void
```

Sets the widget to show after the tabs.

**Parameters**

- `widget`: the widget to show after the tabs

### `setExpandTabs`

```ts
setExpandTabs(expandTabs: boolean): void
```

Sets whether tabs expand to full width.

If set to `TRUE`, the tabs will always vary width filling the whole width
when possible, otherwise tabs will always have the minimum possible size.

**Parameters**

- `expandTabs`: whether to expand tabs

### `setExtraDragPreload`

```ts
setExtraDragPreload(preload: boolean): void
```

Sets whether drop data should be preloaded on hover.

See `Gtk.DropTarget.preload`.

**Parameters**

- `preload`: whether to preload drop data

_Available since 1.3._

### `setInverted`

```ts
setInverted(inverted: boolean): void
```

Sets whether tabs tabs use inverted layout.

If set to `TRUE`, non-pinned tabs will have the close button at the beginning
and the indicator at the end rather than the opposite.

**Parameters**

- `inverted`: whether tabs use inverted layout

### `setStartActionWidget`

```ts
setStartActionWidget(widget: Gtk.Widget | null): void
```

Sets the widget to show before the tabs.

**Parameters**

- `widget`: the widget to show before the tabs

### `setupExtraDropTarget`

```ts
setupExtraDropTarget(actions: Gdk.DragAction, types: (bigint | AnyClass<TypedClass>)[] | null): void
```

Sets up an extra drop target on tabs.

This allows to drag arbitrary content onto tabs, for example URLs in a web
browser.

If a tab is hovered for a certain period of time while dragging the content,
it will be automatically selected.

The `TabBar.extra-drag-drop` signal can be used to handle the drop.

**Parameters**

- `actions`: the supported actions
- `types`: all supported `GType`s that can be dropped

### `setView`

```ts
setView(view: Adw.TabView | null): void
```

Sets the tab view `self` controls.

**Parameters**

- `view`: a tab view
