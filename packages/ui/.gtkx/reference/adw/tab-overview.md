---
description: "A tab overview for TabView."
---

# AdwTabOverview

A tab overview for `TabView`.



`AdwTabOverview` is a widget that can display tabs from an `AdwTabView` in a
grid.

`AdwTabOverview` shows a thumbnail for each tab. By default thumbnails are
static for all pages except the selected one. They can be made always live
by setting `TabPage.liveThumbnail` to `TRUE`, or refreshed with
`TabPage.invalidateThumbnail()` or
`TabView.invalidateThumbnails()` otherwise.

If the pages are too tall or too wide, the thumbnails will be cropped; use
`TabPage.thumbnailXalign` and `TabPage.thumbnailYalign` to
control which part of the page should be visible in this case.

Pinned tabs are shown as smaller cards without thumbnails above the other
tabs. Unlike in `TabBar`, they still have titles, as well as an unpin
button.

`AdwTabOverview` provides search in open tabs. It searches in tab titles and
tooltips, as well as `TabPage.keyword`.

If `TabOverview.enableNewTab` is set to `TRUE`, a new tab button
will be shown. Connect to the `TabOverview.create-tab` signal to use
it.

`TabOverview.secondaryMenu` can be used to provide a secondary menu
for the overview. Use it to add extra actions, e.g. to open a new window or
undo closed tab.

`AdwTabOverview` is intended to be used as the direct child of the window,
with the rest of the window contents set as the `TabOverview.child`.
The child is expected to contain an `TabView`.

`AdwTabOverview` shows window buttons by default. They can be disabled by
setting `TabOverview.showStartTitleButtons` and/or
`TabOverview.showStartTitleButtons` and/or
`TabOverview.showEndTitleButtons` to `FALSE`.

If search and window buttons are disabled, and secondary menu is not set, the
header bar will be hidden.

### Drag-and-Drop

`AdwTabOverview` thumbnails can have an additional drop target for arbitrary
content.

Use `TabOverview.setupExtraDropTarget()` to set it up, specifying the
supported content types and drag actions, then connect to
`TabOverview.extra-drag-drop` to handle a drop.

In some cases, it may be necessary to determine the used action based on the
content. In that case, set `TabOverview.extraDragPreload` to
`TRUE` and connect to `TabOverview.extra-drag-value` signal, then
return the action from its handler. To access this action from the
`TabOverview.extra-drag-drop` handler, use the
`TabOverview.extraDragPreferredAction` property.

`TabOverview.extra-drag-value` is also always emitted when starting to
hover an item, with a `NULL` value. This happens even when
`TabOverview.extraDragPreload` is `FALSE`.

### Actions

`AdwTabOverview` defines the `overview.open` and `overview.close` actions for
opening and closing itself. They can be convenient when used together with
`TabButton`.

### CSS nodes

`AdwTabOverview` has a single CSS node with name `taboverview`.

_Available since 1.3._

```tsx
import { AdwTabOverview } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwTabOverview**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.TabOverview` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `enableNewTab`

`boolean` · default `false`

Whether to enable new tab button.

Connect to the `TabOverview.create-tab` signal to use it.

_Available since 1.3._

### `enableSearch`

`boolean` · default `true`

Whether to enable search in tabs.

Search matches tab titles and tooltips, as well as keywords, set via
`TabPage.keyword`. Use keywords to search in e.g. page URLs in a
web browser.

During search, tab reordering and drag-n-drop are disabled.

Use `TabOverview.searchActive` to check out if search is
currently active.

_Available since 1.3._

### `extraDragPreferredAction`

`Gdk.DragAction` · default `GDK_ACTION_NONE` · read-only, observe with `onNotifyExtraDragPreferredAction`

The current drag action during a drop.

This property should only be used from inside a
`TabOverview.extra-drag-drop` handler.

The action will be a subset of what was originally passed to
`TabOverview.setupExtraDropTarget()`.

_Available since 1.4._

### `extraDragPreload`

`boolean` · default `false`

Whether the drop data should be preloaded on hover.

See `Gtk.DropTarget.preload`.

_Available since 1.3._

### `inverted`

`boolean` · default `false`

Whether thumbnails use inverted layout.

If set to `TRUE`, thumbnails will have the close or unpin buttons at the
beginning and the indicator at the end rather than the other way around.

_Available since 1.3._

### `open`

`boolean` · default `false`

Whether the overview is open.

_Available since 1.3._

### `searchActive`

`boolean` · default `false` · read-only, observe with `onNotifySearchActive`

Whether search is currently active.

See `TabOverview.enableSearch`.

_Available since 1.3._

### `secondaryMenu`

`Gio.MenuModel | ReactElement`

The secondary menu model.

Use it to add extra actions, e.g. to open a new window or undo closed tab.

_Available since 1.3._

### `showEndTitleButtons`

`boolean` · default `true`

Whether to show end title buttons in the overview's header bar.

See `HeaderBar.showStartTitleButtons` for the other side.

_Available since 1.3._

### `showStartTitleButtons`

`boolean` · default `true`

Whether to show start title buttons in the overview's header bar.

See `HeaderBar.showEndTitleButtons` for the other side.

_Available since 1.3._

### `view`

`Adw.TabView | ReactElement`

The tab view the overview controls.

The view must be inside the tab overview, see `TabOverview.child`.

_Available since 1.3._

## Signals

### `onCreateTab`

```ts
(self: Adw.TabOverview) => Adw.TabPage | undefined
```

Emitted when a tab needs to be created.

This can happen after the new tab button has been pressed, see
`TabOverview.enableNewTab`.

The signal handler is expected to create a new page in the corresponding
`TabView` and return it.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** the newly created page

_Available since 1.3._

### `onExtraDragDrop`

```ts
(page: Adw.TabPage, value: GObject.Value, self: Adw.TabOverview) => boolean | undefined
```

Emitted when content is dropped onto a tab.

The content must be of one of the types set up via
`TabOverview.setupExtraDropTarget()`.

See `Gtk.DropTarget.drop`.

**Parameters**

- `page`: the page matching the tab the content was dropped onto
- `value`: the `GValue` being dropped
- `self`: The instance the signal was emitted on.

**Returns** whether the drop was accepted

_Available since 1.3._

### `onExtraDragValue`

```ts
(page: Adw.TabPage, value: GObject.Value | null, self: Adw.TabOverview) => Gdk.DragAction | undefined
```

Emitted when the dropped content is preloaded.

In order for data to be preloaded, `TabOverview.extraDragPreload`
must be set to `TRUE`.

The content must be of one of the types set up via
`TabOverview.setupExtraDropTarget()`.

See `Gtk.DropTarget.value`.

**Parameters**

- `page`: the page matching the tab the content was dropped onto
- `value`: the `GValue` being dropped
- `self`: The instance the signal was emitted on.

**Returns** the preferred action for the drop

_Available since 1.3._

## Methods

Methods are called on the `Adw.TabOverview` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

_Available since 1.3._

### `getEnableNewTab`

```ts
getEnableNewTab(): boolean
```

Gets whether to new tab button is enabled for `self`.

**Returns** whether new tab button is enabled

_Available since 1.3._

### `getEnableSearch`

```ts
getEnableSearch(): boolean
```

Gets whether search in tabs is enabled for `self`.

**Returns** whether search is enabled

_Available since 1.3._

### `getExtraDragPreferredAction`

```ts
getExtraDragPreferredAction(): Gdk.DragAction
```

Gets the current action during a drop on the extra_drop_target.

**Returns** the drag action of the current drop.

_Available since 1.4._

### `getExtraDragPreload`

```ts
getExtraDragPreload(): boolean
```

Gets the current drag action during a drop.

This method should only be used from inside a
`TabOverview.extra-drag-drop` handler.

The action will be a subset of what was originally passed to
`TabOverview.setupExtraDropTarget()`.

**Returns** the drag action of the current drop

_Available since 1.3._

### `getInverted`

```ts
getInverted(): boolean
```

Gets whether thumbnails use inverted layout.

**Returns** whether thumbnails use inverted layout

_Available since 1.3._

### `getOpen`

```ts
getOpen(): boolean
```

Gets whether `self` is open.

**Returns** whether the overview is open

_Available since 1.3._

### `getSearchActive`

```ts
getSearchActive(): boolean
```

Gets whether search is currently active for `self`.

See `TabOverview.enableSearch`.

**Returns** whether search is active

_Available since 1.3._

### `getSecondaryMenu`

```ts
getSecondaryMenu(): Gio.MenuModel | null
```

Gets the secondary menu model for `self`.

**Returns** the secondary menu model

_Available since 1.3._

### `getShowEndTitleButtons`

```ts
getShowEndTitleButtons(): boolean
```

Gets whether end title buttons are shown in `self`'s header bar.

**Returns** whether end title buttons are shown

_Available since 1.3._

### `getShowStartTitleButtons`

```ts
getShowStartTitleButtons(): boolean
```

Gets whether start title buttons are shown in `self`'s header bar.

**Returns** whether start title buttons are shown

_Available since 1.3._

### `getView`

```ts
getView(): Adw.TabView | null
```

Gets the tab view `self` controls.

**Returns** the tab view

_Available since 1.3._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

_Available since 1.3._

### `setEnableNewTab`

```ts
setEnableNewTab(enableNewTab: boolean): void
```

Sets whether to enable new tab button for `self`.

Connect to the `TabOverview.create-tab` signal to use it.

**Parameters**

- `enableNewTab`: whether to enable new tab button

_Available since 1.3._

### `setEnableSearch`

```ts
setEnableSearch(enableSearch: boolean): void
```

Sets whether to enable search in tabs for `self`.

Search matches tab titles and tooltips, as well as keywords, set via
`TabPage.keyword`. Use keywords to search in e.g. page URLs in a web
browser.

During search, tab reordering and drag-n-drop are disabled.

Use `TabOverview.searchActive` to check out if search is currently
active.

**Parameters**

- `enableSearch`: whether to enable search

_Available since 1.3._

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

Sets whether thumbnails use inverted layout.

If set to `TRUE`, thumbnails will have the close or unpin button at the
beginning and the indicator at the end rather than the other way around.

**Parameters**

- `inverted`: whether thumbnails use inverted layout

_Available since 1.3._

### `setOpen`

```ts
setOpen(open: boolean): void
```

Sets whether the to open `self`.

**Parameters**

- `open`: whether the overview is open

_Available since 1.3._

### `setSecondaryMenu`

```ts
setSecondaryMenu(secondaryMenu: Gio.MenuModel | null): void
```

Sets the secondary menu model for `self`.

Use it to add extra actions, e.g. to open a new window or undo closed tab.

**Parameters**

- `secondaryMenu`: a menu model

_Available since 1.3._

### `setShowEndTitleButtons`

```ts
setShowEndTitleButtons(showEndTitleButtons: boolean): void
```

Sets whether to show end title buttons in `self`'s header bar.

See `HeaderBar.showStartTitleButtons` for the other side.

**Parameters**

- `showEndTitleButtons`: whether to show end title buttons

_Available since 1.3._

### `setShowStartTitleButtons`

```ts
setShowStartTitleButtons(showStartTitleButtons: boolean): void
```

Sets whether to show start title buttons in `self`'s header bar.

See `HeaderBar.showEndTitleButtons` for the other side.

**Parameters**

- `showStartTitleButtons`: whether to show start title buttons

_Available since 1.3._

### `setupExtraDropTarget`

```ts
setupExtraDropTarget(actions: Gdk.DragAction, types: (bigint | AnyClass<TypedClass>)[] | null): void
```

Sets up an extra drop target on tabs.

This allows to drag arbitrary content onto tabs, for example URLs in a web
browser.

If a tab is hovered for a certain period of time while dragging the content,
it will be automatically selected.

The `TabOverview.extra-drag-drop` signal can be used to handle the
drop.

**Parameters**

- `actions`: the supported actions
- `types`: all supported `GType`s that can be dropped

_Available since 1.3._

### `setView`

```ts
setView(view: Adw.TabView | null): void
```

Sets the tab view to control.

The view must be inside `self`, see `TabOverview.child`.

**Parameters**

- `view`: a tab view

_Available since 1.3._
