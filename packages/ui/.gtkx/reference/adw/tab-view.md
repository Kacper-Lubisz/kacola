---
description: "A dynamic tabbed container."
---

# AdwTabView

A dynamic tabbed container.

`AdwTabView` is a container which shows one child at a time. While it
provides keyboard shortcuts for switching between pages, it does not provide
a visible tab switcher and relies on external widgets for that, such as
`TabBar`, `TabOverview` and `TabButton`.

`AdwTabView` maintains a `TabPage` object for each page, which holds
additional per-page properties. You can obtain the `AdwTabPage` for a page
with `TabView.getPage()`, and as the return value for
`TabView.append()` and other functions for adding children.

`AdwTabView` only aims to be useful for dynamic tabs in multi-window
document-based applications, such as web browsers, file managers, text
editors or terminals. It does not aim to replace `Gtk.Notebook` for use
cases such as tabbed dialogs.

As such, it does not support disabling page reordering or detaching.

`AdwTabView` adds a number of global page switching and reordering shortcuts.
The `TabView.shortcuts` property can be used to manage them.

See `TabViewShortcuts` for the list of the available shortcuts. All of
the shortcuts are enabled by default.

`TabView.addShortcuts()` and `TabView.removeShortcuts()` can be
used to manage shortcuts in a convenient way, for example:

```c
adw_tab_view_remove_shortcuts (view, ADW_TAB_VIEW_SHORTCUT_CONTROL_HOME |
                                     ADW_TAB_VIEW_SHORTCUT_CONTROL_END);
```

### CSS nodes

`AdwTabView` has a main CSS node with the name `tabview`.

### Accessibility

`AdwTabView` uses the `Gtk.AccessibleRole.tab-panel` role for the tab
pages which are the accessible parent objects of the child widgets.

```tsx
import { AdwTabView } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwTabView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.TabView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `defaultIcon`

`Gio.Icon | ReactElement`

Default page icon.

If a page doesn't provide its own icon via `TabPage.icon`, a
default icon may be used instead for contexts where having an icon is
necessary.

`TabBar` will use default icon for pinned tabs in case the page is
not loading, doesn't have an icon and an indicator. Default icon is never
used for tabs that aren't pinned.

`TabOverview` will use default icon for pages with missing
thumbnails.

By default, the `adw-tab-icon-missing-symbolic` icon is used.

### `isTransferringPage`

`boolean` · default `false` · read-only, observe with `onNotifyIsTransferringPage`

Whether a page is being transferred.

This property will be set to `TRUE` when a drag-n-drop tab transfer starts
on any `AdwTabView`, and to `FALSE` after it ends.

During the transfer, children cannot receive pointer input and a tab can
be safely dropped on the tab view.

### `menuModel`

`Gio.MenuModel | ReactElement`

Tab context menu model.

When a context menu is shown for a tab, it will be constructed from the
provided menu model. Use the `TabView.setup-menu` signal to set up
the menu actions for the particular tab.

### `nPages`

`number` · default `0` · read-only, observe with `onNotifyNPages`

The number of pages in the tab view.

### `nPinnedPages`

`number` · default `0` · read-only, observe with `onNotifyNPinnedPages`

The number of pinned pages in the tab view.

See `TabView.setPagePinned()`.

### `pages`

`Gtk.SelectionModel` · read-only, observe with `onNotifyPages`

A list model with the tab view's pages.

This can be used to keep an up-to-date view.

The model implements `Gtk.SectionModel`, with one section for pinned
pages and one for the rest of the pages.

It also implements `Gtk.SelectionModel` and can be used to track and
change the selected page.

### `selectedPage`

`Adw.TabPage | ReactElement`

The currently selected page.

### `shortcuts`

`Adw.TabViewShortcuts` · default `ADW_TAB_VIEW_SHORTCUT_CONTROL_TAB | ADW_TAB_VIEW_SHORTCUT_CONTROL_SHIFT_TAB | ADW_TAB_VIEW_SHORTCUT_CONTROL_PAGE_UP | ADW_TAB_VIEW_SHORTCUT_CONTROL_PAGE_DOWN | ADW_TAB_VIEW_SHORTCUT_CONTROL_HOME | ADW_TAB_VIEW_SHORTCUT_CONTROL_END | ADW_TAB_VIEW_SHORTCUT_CONTROL_SHIFT_PAGE_UP | ADW_TAB_VIEW_SHORTCUT_CONTROL_SHIFT_PAGE_DOWN | ADW_TAB_VIEW_SHORTCUT_CONTROL_SHIFT_HOME | ADW_TAB_VIEW_SHORTCUT_CONTROL_SHIFT_END | ADW_TAB_VIEW_SHORTCUT_ALT_DIGITS | ADW_TAB_VIEW_SHORTCUT_ALT_ZERO`

The enabled shortcuts.

See `TabViewShortcuts` for the list of the available shortcuts. All
of the shortcuts are enabled by default.

`TabView.addShortcuts()` and `TabView.removeShortcuts()`
provide a convenient way to manage individual shortcuts.

_Available since 1.2._

## Signals

### `onClosePage`

```ts
(page: Adw.TabPage, self: Adw.TabView) => boolean | undefined
```

Emitted after `TabView.closePage()` has been called for `page`.

The handler is expected to call `TabView.closePageFinish()` to
confirm or reject the closing.

The default handler will immediately confirm closing for non-pinned pages,
or reject it for pinned pages, equivalent to the following example:

```c
static gboolean
close_page_cb (AdwTabView *view,
               AdwTabPage *page,
               gpointer    user_data)
{
  adw_tab_view_close_page_finish (view, page, !adw_tab_page_get_pinned (page));

  return GDK_EVENT_STOP;
}
```

The `TabView.closePageFinish()` call doesn't have to happen inside
the handler, so can be used to do asynchronous checks before confirming the
closing.

A typical reason to connect to this signal is to show a confirmation dialog
for closing a tab.

The signal handler should return `Gdk.EVENT_STOP` to stop propagation
or `Gdk.EVENT_PROPAGATE` to invoke the default handler.

**Parameters**

- `page`: a page of `self`
- `self`: The instance the signal was emitted on.

**Returns** whether propagation should be stopped

### `onCreateWindow`

```ts
(self: Adw.TabView) => Adw.TabView | null | undefined
```

Emitted when a tab should be transferred into a new window.

This can happen after a tab has been dropped on desktop.

The signal handler is expected to create a new window, position it as
needed and return its `AdwTabView` that the page will be transferred into.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** the `AdwTabView` from the new window

### `onIndicatorActivated`

```ts
(page: Adw.TabPage, self: Adw.TabView) => void
```

Emitted after the indicator icon on `page` has been activated.

See `TabPage.indicatorIcon` and
`TabPage.indicatorActivatable`.

**Parameters**

- `page`: a page of `self`
- `self`: The instance the signal was emitted on.

### `onPageAttached`

```ts
(page: Adw.TabPage, position: number, self: Adw.TabView) => void
```

Emitted when a page has been created or transferred to `self`.

A typical reason to connect to this signal would be to connect to page
signals for things such as updating window title.

**Parameters**

- `page`: a page of `self`
- `position`: the position of the page, starting from 0
- `self`: The instance the signal was emitted on.

### `onPageDetached`

```ts
(page: Adw.TabPage, position: number, self: Adw.TabView) => void
```

Emitted when a page has been removed or transferred to another view.

A typical reason to connect to this signal would be to disconnect signal
handlers connected in the `TabView.page-attached` handler.

It is important not to try and destroy the page child in the handler of
this function as the child might merely be moved to another window; use
child dispose handler for that or do it in sync with your
`TabView.closePageFinish()` calls.

**Parameters**

- `page`: a page of `self`
- `position`: the position of the removed page, starting from 0
- `self`: The instance the signal was emitted on.

### `onPageReordered`

```ts
(page: Adw.TabPage, position: number, self: Adw.TabView) => void
```

Emitted after `page` has been reordered to `position`.

**Parameters**

- `page`: a page of `self`
- `position`: the position `page` was moved to, starting at 0
- `self`: The instance the signal was emitted on.

### `onSetupMenu`

```ts
(page: Adw.TabPage | null, self: Adw.TabView) => void
```

Emitted when a context menu is opened or closed for `page`.

If the menu has been closed, `page` will be set to `NULL`.

It can be used to set up menu actions before showing the menu, for example
disable actions not applicable to `page`.

**Parameters**

- `page`: a page of `self`
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.TabView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addPage`

```ts
addPage(child: Gtk.Widget, parent: Adw.TabPage | null): Adw.TabPage
```

Adds `child` to `self` with `parent` as the parent.

This function can be used to automatically position new pages, and to select
the correct page when this page is closed while being selected (see
`TabView.closePage()`).

If `parent` is `NULL`, this function is equivalent to `TabView.append()`.

**Parameters**

- `child`: a widget to add
- `parent`: a parent page for `child`

**Returns** the page object representing `child`

### `addShortcuts`

```ts
addShortcuts(shortcuts: Adw.TabViewShortcuts): void
```

Adds `shortcuts` for `self`.

See `TabView.shortcuts` for details.

**Parameters**

- `shortcuts`: the shortcuts to add

_Available since 1.2._

### `append`

```ts
append(child: Gtk.Widget): Adw.TabPage
```

Inserts `child` as the last non-pinned page.

**Parameters**

- `child`: a widget to add

**Returns** the page object representing `child`

### `appendPinned`

```ts
appendPinned(child: Gtk.Widget): Adw.TabPage
```

Inserts `child` as the last pinned page.

**Parameters**

- `child`: a widget to add

**Returns** the page object representing `child`

### `closeOtherPages`

```ts
closeOtherPages(page: Adw.TabPage): void
```

Requests to close all pages other than `page`.

**Parameters**

- `page`: a page of `self`

### `closePage`

```ts
closePage(page: Adw.TabPage): void
```

Requests to close `page`.

Calling this function will result in the `TabView.close-page` signal
being emitted for `page`. Closing the page can then be confirmed or
denied via `TabView.closePageFinish()`.

If the page is waiting for a `TabView.closePageFinish()` call, this
function will do nothing.

The default handler for `TabView.close-page` will immediately confirm
closing the page if it's non-pinned, or reject it if it's pinned. This
behavior can be changed by registering your own handler for that signal.

If `page` was selected, another page will be selected instead:

If the `TabPage.parent` value is `NULL`, the next page will be
selected when possible, or if the page was already last, the previous page
will be selected instead.

If it's not `NULL`, the previous page will be selected if it's a descendant
(possibly indirect) of the parent. If both the previous page and the parent
are pinned, the parent will be selected instead.

**Parameters**

- `page`: a page of `self`

### `closePageFinish`

```ts
closePageFinish(page: Adw.TabPage, confirm: boolean): void
```

Completes a `TabView.closePage()` call for `page`.

If `confirm` is `TRUE`, `page` will be closed. If it's `FALSE`, it will be
reverted to its previous state and `TabView.closePage()` can be called
for it again.

This function should not be called unless a custom handler for
`TabView.close-page` is used.

**Parameters**

- `page`: a page of `self`
- `confirm`: whether to confirm or deny closing `page`

### `closePagesAfter`

```ts
closePagesAfter(page: Adw.TabPage): void
```

Requests to close all pages after `page`.

**Parameters**

- `page`: a page of `self`

### `closePagesBefore`

```ts
closePagesBefore(page: Adw.TabPage): void
```

Requests to close all pages before `page`.

**Parameters**

- `page`: a page of `self`

### `getDefaultIcon`

```ts
getDefaultIcon(): Gio.Icon
```

Gets the default icon of `self`.

**Returns** the default icon of `self`.

### `getIsTransferringPage`

```ts
getIsTransferringPage(): boolean
```

Whether a page is being transferred.

The corresponding property will be set to `TRUE` when a drag-n-drop tab
transfer starts on any `AdwTabView`, and to `FALSE` after it ends.

During the transfer, children cannot receive pointer input and a tab can
be safely dropped on the tab view.

**Returns** whether a page is being transferred

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Gets the tab context menu model for `self`.

**Returns** the tab context menu model for `self`

### `getNPages`

```ts
getNPages(): number
```

Gets the number of pages in `self`.

**Returns** the number of pages in `self`

### `getNPinnedPages`

```ts
getNPinnedPages(): number
```

Gets the number of pinned pages in `self`.

See `TabView.setPagePinned()`.

**Returns** the number of pinned pages in `self`

### `getNthPage`

```ts
getNthPage(position: number): Adw.TabPage
```

Gets the `TabPage` representing the child at `position`.

**Parameters**

- `position`: the index of the page in `self`, starting from 0

**Returns** the page object at `position`

### `getPage`

```ts
getPage(child: Gtk.Widget): Adw.TabPage
```

Gets the `TabPage` object representing `child`.

**Parameters**

- `child`: a child in `self`

**Returns** the page object for `child`

### `getPagePosition`

```ts
getPagePosition(page: Adw.TabPage): number
```

Finds the position of `page` in `self`, starting from 0.

**Parameters**

- `page`: a page of `self`

**Returns** the position of `page` in `self`

### `getPages`

```ts
getPages(): Gtk.SelectionModel
```

Returns a `Gio.ListModel` that contains the pages of `self`.

This can be used to keep an up-to-date view.

The model implements `Gtk.SectionModel`, with one section for pinned
pages and one for the rest of the pages.

It also implements `Gtk.SelectionModel` and can be used to track and
change the selected page.

**Returns** a `GtkSelectionModel` for the pages of `self`

### `getSelectedPage`

```ts
getSelectedPage(): Adw.TabPage | null
```

Gets the currently selected page in `self`.

**Returns** the selected page

### `getShortcuts`

```ts
getShortcuts(): Adw.TabViewShortcuts
```

Gets the enabled shortcuts for `self`.

**Returns** the shortcut mask

_Available since 1.2._

### `insert`

```ts
insert(child: Gtk.Widget, position: number): Adw.TabPage
```

Inserts a non-pinned page at `position`.

It's an error to try to insert a page before a pinned page, in that case
`TabView.insertPinned()` should be used instead.

**Parameters**

- `child`: a widget to add
- `position`: the position to add `child` at, starting from 0

**Returns** the page object representing `child`

### `insertPinned`

```ts
insertPinned(child: Gtk.Widget, position: number): Adw.TabPage
```

Inserts a pinned page at `position`.

It's an error to try to insert a pinned page after a non-pinned page, in
that case `TabView.insert()` should be used instead.

**Parameters**

- `child`: a widget to add
- `position`: the position to add `child` at, starting from 0

**Returns** the page object representing `child`

### `invalidateThumbnails`

```ts
invalidateThumbnails(): void
```

Invalidates thumbnails for all pages in `self`.

This is a convenience method, equivalent to calling
`TabPage.invalidateThumbnail()` on each page.

_Available since 1.3._

### `prepend`

```ts
prepend(child: Gtk.Widget): Adw.TabPage
```

Inserts `child` as the first non-pinned page.

**Parameters**

- `child`: a widget to add

**Returns** the page object representing `child`

### `prependPinned`

```ts
prependPinned(child: Gtk.Widget): Adw.TabPage
```

Inserts `child` as the first pinned page.

**Parameters**

- `child`: a widget to add

**Returns** the page object representing `child`

### `removeShortcuts`

```ts
removeShortcuts(shortcuts: Adw.TabViewShortcuts): void
```

Removes `shortcuts` from `self`.

See `TabView.shortcuts` for details.

**Parameters**

- `shortcuts`: the shortcuts to remove

_Available since 1.2._

### `reorderBackward`

```ts
reorderBackward(page: Adw.TabPage): boolean
```

Reorders `page` to before its previous page if possible.

**Parameters**

- `page`: a page of `self`

**Returns** whether `page` was moved

### `reorderFirst`

```ts
reorderFirst(page: Adw.TabPage): boolean
```

Reorders `page` to the first possible position.

**Parameters**

- `page`: a page of `self`

**Returns** whether `page` was moved

### `reorderForward`

```ts
reorderForward(page: Adw.TabPage): boolean
```

Reorders `page` to after its next page if possible.

**Parameters**

- `page`: a page of `self`

**Returns** whether `page` was moved

### `reorderLast`

```ts
reorderLast(page: Adw.TabPage): boolean
```

Reorders `page` to the last possible position.

**Parameters**

- `page`: a page of `self`

**Returns** whether `page` was moved

### `reorderPage`

```ts
reorderPage(page: Adw.TabPage, position: number): boolean
```

Reorders `page` to `position`.

It's a programmer error to try to reorder a pinned page after a non-pinned
one, or a non-pinned page before a pinned one.

**Parameters**

- `page`: a page of `self`
- `position`: the position to insert the page at, starting at 0

**Returns** whether `page` was moved

### `selectNextPage`

```ts
selectNextPage(): boolean
```

Selects the page after the currently selected page.

If the last page was already selected, this function does nothing.

**Returns** whether the selected page was changed

### `selectPreviousPage`

```ts
selectPreviousPage(): boolean
```

Selects the page before the currently selected page.

If the first page was already selected, this function does nothing.

**Returns** whether the selected page was changed

### `setDefaultIcon`

```ts
setDefaultIcon(defaultIcon: Gio.Icon): void
```

Sets the default page icon for `self`.

If a page doesn't provide its own icon via `TabPage.icon`, a default
icon may be used instead for contexts where having an icon is necessary.

`TabBar` will use default icon for pinned tabs in case the page is not
loading, doesn't have an icon and an indicator. Default icon is never used
for tabs that aren't pinned.

`TabOverview` will use default icon for pages with missing thumbnails.

By default, the `adw-tab-icon-missing-symbolic` icon is used.

**Parameters**

- `defaultIcon`: the default icon

### `setMenuModel`

```ts
setMenuModel(menuModel: Gio.MenuModel | null): void
```

Sets the tab context menu model for `self`.

When a context menu is shown for a tab, it will be constructed from the
provided menu model. Use the `TabView.setup-menu` signal to set up
the menu actions for the particular tab.

**Parameters**

- `menuModel`: a menu model

### `setPagePinned`

```ts
setPagePinned(page: Adw.TabPage, pinned: boolean): void
```

Pins or unpins `page`.

Pinned pages are guaranteed to be placed before all non-pinned pages; at any
given moment the first `TabView.nPinnedPages` pages in `self` are
guaranteed to be pinned.

When a page is pinned or unpinned, it's automatically reordered: pinning a
page moves it after other pinned pages; unpinning a page moves it before
other non-pinned pages.

Pinned pages can still be reordered between each other.

`TabBar` will display pinned pages in a compact form, never showing the
title or close button, and only showing a single icon, selected in the
following order:

1. `TabPage.indicatorIcon`
2. A spinner if `TabPage.loading` is `TRUE`
3. `TabPage.icon`
4. `TabView.defaultIcon`

`TabOverview` will not show a thumbnail for pinned pages, and replace
the close button with an unpin button. Unlike `AdwTabBar`, it will still
display the page's title, icon and indicator separately.

Pinned pages cannot be closed by default, see `TabView.close-page`
for how to override that behavior.

Changes the value of the `TabPage.pinned` property.

**Parameters**

- `page`: a page of `self`
- `pinned`: whether `page` should be pinned

### `setSelectedPage`

```ts
setSelectedPage(selectedPage: Adw.TabPage): void
```

Sets the currently selected page in `self`.

**Parameters**

- `selectedPage`: a page in `self`

### `setShortcuts`

```ts
setShortcuts(shortcuts: Adw.TabViewShortcuts): void
```

Sets the enabled shortcuts for `self`.

See `TabViewShortcuts` for the list of the available shortcuts. All of
the shortcuts are enabled by default.

`TabView.addShortcuts()` and `TabView.removeShortcuts()` provide
a convenient way to manage individual shortcuts.

**Parameters**

- `shortcuts`: the new shortcuts

_Available since 1.2._

### `transferPage`

```ts
transferPage(page: Adw.TabPage, otherView: Adw.TabView, position: number): void
```

Transfers `page` from `self` to `other_view`.

The `page` object will be reused.

It's a programmer error to try to insert a pinned page after a non-pinned
one, or a non-pinned page before a pinned one.

**Parameters**

- `page`: a page of `self`
- `otherView`: the tab view to transfer the page to
- `position`: the position to insert the page at, starting at 0
