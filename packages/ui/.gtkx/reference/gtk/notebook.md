---
description: "Switches between children using tabs."
---

# GtkNotebook

Switches between children using tabs.



There are many configuration options for `GtkNotebook`. Among
other things, you can choose on which edge the tabs appear
(see `Gtk.Notebook.setTabPos()`), whether, if there are
too many tabs to fit the notebook should be made bigger or scrolling
arrows added (see `Gtk.Notebook.setScrollable()`), and whether
there will be a popup menu allowing the users to switch pages.
(see `Gtk.Notebook.popupEnable()`).

## GtkNotebook as GtkBuildable

The `GtkNotebook` implementation of the `GtkBuildable` interface
supports placing children into tabs by specifying “tab” as the
“type” attribute of a `<child>` element. Note that the content
of the tab must be created before the tab can be filled.
A tab child can be specified without specifying a `<child>`
type attribute.

To add a child widget in the notebooks action area, specify
"action-start" or “action-end” as the “type” attribute of the
`<child>` element.

An example of a UI definition fragment with `GtkNotebook`:

```xml
<object class="GtkNotebook">
  <child>
    <object class="GtkLabel" id="notebook-content">
      <property name="label">Content</property>
    </object>
  </child>
  <child type="tab">
    <object class="GtkLabel" id="notebook-tab">
      <property name="label">Tab</property>
    </object>
  </child>
</object>
```

## Shortcuts and Gestures

`GtkNotebook` supports the following keyboard shortcuts:

- <kbd>Shift</kbd>+<kbd>F10</kbd> or <kbd>Menu</kbd> opens the context menu.
- <kbd>Home</kbd> moves the focus to the first tab.
- <kbd>End</kbd> moves the focus to the last tab.

Additionally, the following signals have default keybindings:

- `Gtk.Notebook.change-current-page`
- `Gtk.Notebook.focus-tab`
- `Gtk.Notebook.move-focus-out`
- `Gtk.Notebook.reorder-tab`
- `Gtk.Notebook.select-page`

Tabs support drag-and-drop between notebooks sharing the same `group-name`,
or to new windows by handling the `::create-window` signal.

## Actions

`GtkNotebook` defines a set of built-in actions:

- `menu.popup` opens the tabs context menu.

## CSS nodes

```
notebook
├── header.top
│   ├── [<action widget>]
│   ├── tabs
│   │   ├── [arrow]
│   │   ├── tab
│   │   │   ╰── <tab label>
┊   ┊   ┊
│   │   ├── tab[.reorderable-page]
│   │   │   ╰── <tab label>
│   │   ╰── [arrow]
│   ╰── [<action widget>]
│
╰── stack
    ├── <child>
    ┊
    ╰── <child>
```

`GtkNotebook` has a main CSS node with name `notebook`, a subnode
with name `header` and below that a subnode with name `tabs` which
contains one subnode per tab with name `tab`.

If action widgets are present, their CSS nodes are placed next
to the `tabs` node. If the notebook is scrollable, CSS nodes with
name `arrow` are placed as first and last child of the `tabs` node.

The main node gets the `.frame` style class when the notebook
has a border (see `Gtk.Notebook.setShowBorder()`).

The header node gets one of the style class `.top`, `.bottom`,
`.left` or `.right`, depending on where the tabs are placed. For
reorderable pages, the tab node gets the `.reorderable-page` class.

A `tab` node gets the `.dnd` style class while it is moved with drag-and-drop.

The nodes are always arranged from left-to-right, regardless of text direction.

## Accessibility

`GtkNotebook` uses the following roles:

 - `Gtk.AccessibleRole.group` for the notebook widget
 - `Gtk.AccessibleRole.tab_list` for the list of tabs
 - `Gtk.AccessibleRole.tab` role for each tab
 - `Gtk.AccessibleRole.tab_panel` for each page

```tsx
import { GtkNotebook } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkNotebook**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Notebook` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `enablePopup`

`boolean` · default `false`

If `true`, pressing the right mouse button on the notebook shows a page switching menu.

### `groupName`

`string` · default `null`

Group name for tab drag and drop.

### `page`

`number` · default `-1`

The index of the current page.

### `pages`

`Gio.ListModel` · read-only, observe with `onNotifyPages`

A selection model with the pages.

### `scrollable`

`boolean` · default `false`

If `true`, scroll arrows are added if there are too many pages to fit.

### `showBorder`

`boolean` · default `true`

Whether the border should be shown.

### `showTabs`

`boolean` · default `true`

Whether tabs should be shown.

### `tabPos`

`Gtk.PositionType` · default `GTK_POS_TOP`

Which side of the notebook holds the tabs.

## Signals

### `onChangeCurrentPage`

```ts
(page: number, self: Gtk.Notebook) => boolean | undefined
```

Emitted when the current page should be changed.

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>PgUp</kbd>,
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>PgDn</kbd>,
<kbd>Ctrl</kbd>+<kbd>PgUp</kbd> and <kbd>Ctrl</kbd>+<kbd>PgDn</kbd>.

**Parameters**

- `page`: the page index
- `self`: The instance the signal was emitted on.

**Returns** whether the page was changed

### `onCreateWindow`

```ts
(page: Gtk.Widget, self: Gtk.Notebook) => Gtk.Notebook | null | undefined
```

The ::create-window signal is emitted when a detachable
tab is dropped on the root window.

A handler for this signal can create a window containing
a notebook where the tab will be attached. It is also
responsible for moving/resizing the window and adding the
necessary properties to the notebook (e.g. the
`GtkNotebook`:group-name ).

**Parameters**

- `page`: the tab of `notebook` that is being detached
- `self`: The instance the signal was emitted on.

**Returns** a `GtkNotebook` that
  `page` should be added to

### `onFocusTab`

```ts
(tab: Gtk.NotebookTab, self: Gtk.Notebook) => boolean | undefined
```

Emitted when a tab should be focused.

**Parameters**

- `tab`: the notebook tab
- `self`: The instance the signal was emitted on.

**Returns** whether the tab has been focused

### `onMoveFocusOut`

```ts
(direction: Gtk.DirectionType, self: Gtk.Notebook) => void
```

Emitted when focus was moved out.

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>Tab</kbd>,
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd>,
<kbd>Ctrl</kbd>+<kbd>←</kbd>, <kbd>Ctrl</kbd>+<kbd>→</kbd>,
<kbd>Ctrl</kbd>+<kbd>↑</kbd> and <kbd>Ctrl</kbd>+<kbd>↓</kbd>.

**Parameters**

- `direction`: the direction to move the focus
- `self`: The instance the signal was emitted on.

### `onPageAdded`

```ts
(child: Gtk.Widget, pageNum: number, self: Gtk.Notebook) => void
```

the ::page-added signal is emitted in the notebook
right after a page is added to the notebook.

**Parameters**

- `child`: the child `GtkWidget` affected
- `pageNum`: the new page number for `child`
- `self`: The instance the signal was emitted on.

### `onPageRemoved`

```ts
(child: Gtk.Widget, pageNum: number, self: Gtk.Notebook) => void
```

the ::page-removed signal is emitted in the notebook
right after a page is removed from the notebook.

**Parameters**

- `child`: the child `GtkWidget` affected
- `pageNum`: the `child` page number
- `self`: The instance the signal was emitted on.

### `onPageReordered`

```ts
(child: Gtk.Widget, pageNum: number, self: Gtk.Notebook) => void
```

the ::page-reordered signal is emitted in the notebook
right after a page has been reordered.

**Parameters**

- `child`: the child `GtkWidget` affected
- `pageNum`: the new page number for `child`
- `self`: The instance the signal was emitted on.

### `onReorderTab`

```ts
(direction: Gtk.DirectionType, moveToLast: boolean, self: Gtk.Notebook) => boolean | undefined
```

Emitted when the tab should be reordered.

The default bindings for this signal are
<kbd>Alt</kbd>+<kbd>Home</kbd>, <kbd>Alt</kbd>+<kbd>End</kbd>,
<kbd>Alt</kbd>+<kbd>PgUp</kbd>, <kbd>Alt</kbd>+<kbd>PgDn</kbd>,
<kbd>Alt</kbd>+<kbd>←</kbd>, <kbd>Alt</kbd>+<kbd>→</kbd>,
<kbd>Alt</kbd>+<kbd>↑</kbd> and <kbd>Alt</kbd>+<kbd>↓</kbd>.

**Parameters**

- `direction`: the direction to move the tab
- `moveToLast`: whether to move to the last position
- `self`: The instance the signal was emitted on.

**Returns** whether the tab was moved.

### `onSelectPage`

```ts
(moveFocus: boolean, self: Gtk.Notebook) => boolean | undefined
```

Emitted when a page should be selected.

The default binding for this signal is <kbd>␣</kbd>.

**Parameters**

- `moveFocus`: whether to move focus
- `self`: The instance the signal was emitted on.

**Returns** whether the page was selected

### `onSwitchPage`

```ts
(page: Gtk.Widget, pageNum: number, self: Gtk.Notebook) => void
```

Emitted when the user or a function changes the current page.

**Parameters**

- `page`: the new current page
- `pageNum`: the index of the page
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Notebook` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `appendPage`

```ts
appendPage(child: Gtk.Widget, tabLabel: Gtk.Widget | null): number
```

Appends a page to `notebook`.

**Parameters**

- `child`: the `GtkWidget` to use as the contents of the page
- `tabLabel`: the `GtkWidget` to be used as the label for the page, or `null` to use the default label, “page N”

**Returns** the index (starting from 0) of the appended
  page in the notebook, or -1 if function fails

### `appendPageMenu`

```ts
appendPageMenu(child: Gtk.Widget, tabLabel: Gtk.Widget | null, menuLabel: Gtk.Widget | null): number
```

Appends a page to `notebook`, specifying the widget to use as the
label in the popup menu.

**Parameters**

- `child`: the `GtkWidget` to use as the contents of the page
- `tabLabel`: the `GtkWidget` to be used as the label for the page, or `null` to use the default label, “page N”
- `menuLabel`: the widget to use as a label for the page-switch menu, if that is enabled. If `null`, and `tab_label` is a `GtkLabel` or `null`, then the menu label will be a newly created label with the same text as `tab_label`; if `tab_label` is not a `GtkLabel`, `menu_label` must be specified if the page-switch menu is to be used.

**Returns** the index (starting from 0) of the appended
  page in the notebook, or -1 if function fails

### `detachTab`

```ts
detachTab(child: Gtk.Widget): void
```

Removes the child from the notebook.

This function is very similar to `Gtk.Notebook.removePage()`,
but additionally informs the notebook that the removal
is happening as part of a tab DND operation, which should
not be cancelled.

**Parameters**

- `child`: a child

### `getActionWidget`

```ts
getActionWidget(packType: Gtk.PackType): Gtk.Widget | null
```

Gets one of the action widgets.

See `Gtk.Notebook.setActionWidget()`.

**Parameters**

- `packType`: pack type of the action widget to receive

**Returns** The action widget
  with the given `pack_type` or `null` when this action
  widget has not been set

### `getCurrentPage`

```ts
getCurrentPage(): number
```

Returns the page number of the current page.

**Returns** the index (starting from 0) of the current
  page in the notebook. If the notebook has no pages,
  then -1 will be returned.

### `getGroupName`

```ts
getGroupName(): string | null
```

Gets the current group name for `notebook`.

**Returns** the group name,
  or `null` if none is set

### `getMenuLabel`

```ts
getMenuLabel(child: Gtk.Widget): Gtk.Widget | null
```

Retrieves the menu label widget of the page containing `child`.

**Parameters**

- `child`: a widget contained in a page of `notebook`

**Returns** the menu label, or `null`
  if the notebook page does not have a menu label other than
  the default (the tab label).

### `getMenuLabelText`

```ts
getMenuLabelText(child: Gtk.Widget): string | null
```

Retrieves the text of the menu label for the page containing
`child`.

**Parameters**

- `child`: the child widget of a page of the notebook.

**Returns** the text of the tab label, or `null` if
  the widget does not have a menu label other than the default
  menu label, or the menu label widget is not a `GtkLabel`.
  The string is owned by the widget and must not be freed.

### `getNPages`

```ts
getNPages(): number
```

Gets the number of pages in a notebook.

**Returns** the number of pages in the notebook

### `getNthPage`

```ts
getNthPage(pageNum: number): Gtk.Widget | null
```

Returns the child widget contained in page number `page_num`.

**Parameters**

- `pageNum`: the index of a page in the notebook, or -1 to get the last page

**Returns** the child widget, or `null` if `page_num`
is out of bounds

### `getPage`

```ts
getPage(child: Gtk.Widget): Gtk.NotebookPage
```

Returns the `GtkNotebookPage` for `child`.

**Parameters**

- `child`: a child of `notebook`

**Returns** the `GtkNotebookPage` for `child`

### `getPages`

```ts
getPages(): Gio.ListModel
```

Returns a `GListModel` that contains the pages of the notebook.

This can be used to keep an up-to-date view. The model also
implements `Gtk.SelectionModel` and can be used to track
and modify the visible page.

**Returns** a
  `GListModel` for the notebook's children

### `getScrollable`

```ts
getScrollable(): boolean
```

Returns whether the tab label area has arrows for scrolling.

**Returns** `true` if arrows for scrolling are present

### `getShowBorder`

```ts
getShowBorder(): boolean
```

Returns whether a bevel will be drawn around the notebook pages.

**Returns** `true` if the bevel is drawn

### `getShowTabs`

```ts
getShowTabs(): boolean
```

Returns whether the tabs of the notebook are shown.

**Returns** `true` if the tabs are shown

### `getTabDetachable`

```ts
getTabDetachable(child: Gtk.Widget): boolean
```

Returns whether the tab contents can be detached from `notebook`.

**Parameters**

- `child`: a child `GtkWidget`

**Returns** `true` if the tab is detachable.

### `getTabLabel`

```ts
getTabLabel(child: Gtk.Widget): Gtk.Widget | null
```

Returns the tab label widget for the page `child`.

`null` is returned if `child` is not in `notebook` or
if no tab label has specifically been set for `child`.

**Parameters**

- `child`: the page

**Returns** the tab label

### `getTabLabelText`

```ts
getTabLabelText(child: Gtk.Widget): string | null
```

Retrieves the text of the tab label for the page containing
`child`.

**Parameters**

- `child`: a widget contained in a page of `notebook`

**Returns** the text of the tab label, or `null` if
  the tab label widget is not a `GtkLabel`. The string is owned
  by the widget and must not be freed.

### `getTabPos`

```ts
getTabPos(): Gtk.PositionType
```

Gets the edge at which the tabs are drawn.

**Returns** the edge at which the tabs are drawn

### `getTabReorderable`

```ts
getTabReorderable(child: Gtk.Widget): boolean
```

Gets whether the tab can be reordered via drag and drop or not.

**Parameters**

- `child`: a child `GtkWidget`

**Returns** `true` if the tab is reorderable.

### `insertPage`

```ts
insertPage(child: Gtk.Widget, tabLabel: Gtk.Widget | null, position: number): number
```

Insert a page into `notebook` at the given position.

**Parameters**

- `child`: the `GtkWidget` to use as the contents of the page
- `tabLabel`: the `GtkWidget` to be used as the label for the page, or `null` to use the default label, “page N”
- `position`: the index (starting at 0) at which to insert the page, or -1 to append the page after all other pages

**Returns** the index (starting from 0) of the inserted
  page in the notebook, or -1 if function fails

### `insertPageMenu`

```ts
insertPageMenu(child: Gtk.Widget, tabLabel: Gtk.Widget | null, menuLabel: Gtk.Widget | null, position: number): number
```

Insert a page into `notebook` at the given position, specifying
the widget to use as the label in the popup menu.

**Parameters**

- `child`: the `GtkWidget` to use as the contents of the page
- `tabLabel`: the `GtkWidget` to be used as the label for the page, or `null` to use the default label, “page N”
- `menuLabel`: the widget to use as a label for the page-switch menu, if that is enabled. If `null`, and `tab_label` is a `GtkLabel` or `null`, then the menu label will be a newly created label with the same text as `tab_label`; if `tab_label` is not a `GtkLabel`, `menu_label` must be specified if the page-switch menu is to be used.
- `position`: the index (starting at 0) at which to insert the page, or -1 to append the page after all other pages.

**Returns** the index (starting from 0) of the inserted
  page in the notebook

### `nextPage`

```ts
nextPage(): void
```

Switches to the next page.

Nothing happens if the current page is the last page.

### `pageNum`

```ts
pageNum(child: Gtk.Widget): number
```

Finds the index of the page which contains the given child
widget.

**Parameters**

- `child`: a `GtkWidget`

**Returns** the index of the page containing `child`, or
  -1 if `child` is not in the notebook

### `popupDisable`

```ts
popupDisable(): void
```

Disables the popup menu.

### `popupEnable`

```ts
popupEnable(): void
```

Enables the popup menu.

If the user clicks with the right mouse button on the tab labels,
a menu with all the pages will be popped up.

### `prependPage`

```ts
prependPage(child: Gtk.Widget, tabLabel: Gtk.Widget | null): number
```

Prepends a page to `notebook`.

**Parameters**

- `child`: the `GtkWidget` to use as the contents of the page
- `tabLabel`: the `GtkWidget` to be used as the label for the page, or `null` to use the default label, “page N”

**Returns** the index (starting from 0) of the prepended
  page in the notebook, or -1 if function fails

### `prependPageMenu`

```ts
prependPageMenu(child: Gtk.Widget, tabLabel: Gtk.Widget | null, menuLabel: Gtk.Widget | null): number
```

Prepends a page to `notebook`, specifying the widget to use as the
label in the popup menu.

**Parameters**

- `child`: the `GtkWidget` to use as the contents of the page
- `tabLabel`: the `GtkWidget` to be used as the label for the page, or `null` to use the default label, “page N”
- `menuLabel`: the widget to use as a label for the page-switch menu, if that is enabled. If `null`, and `tab_label` is a `GtkLabel` or `null`, then the menu label will be a newly created label with the same text as `tab_label`; if `tab_label` is not a `GtkLabel`, `menu_label` must be specified if the page-switch menu is to be used.

**Returns** the index (starting from 0) of the prepended
  page in the notebook, or -1 if function fails

### `prevPage`

```ts
prevPage(): void
```

Switches to the previous page.

Nothing happens if the current page is the first page.

### `removePage`

```ts
removePage(pageNum: number): void
```

Removes a page from the notebook given its index
in the notebook.

**Parameters**

- `pageNum`: the index of a notebook page, starting from 0. If -1, the last page will be removed.

### `reorderChild`

```ts
reorderChild(child: Gtk.Widget, position: number): void
```

Reorders the page containing `child`, so that it appears in position
`position`.

If `position` is greater than or equal to the number of children in
the list or negative, `child` will be moved to the end of the list.

**Parameters**

- `child`: the child to move
- `position`: the new position, or -1 to move to the end

### `setActionWidget`

```ts
setActionWidget(widget: Gtk.Widget, packType: Gtk.PackType): void
```

Sets `widget` as one of the action widgets.

Depending on the pack type the widget will be placed before
or after the tabs. You can use a `GtkBox` if you need to pack
more than one widget on the same side.

**Parameters**

- `widget`: a `GtkWidget`
- `packType`: pack type of the action widget

### `setCurrentPage`

```ts
setCurrentPage(pageNum: number): void
```

Switches to the page number `page_num`.

Note that due to historical reasons, GtkNotebook refuses
to switch to a page unless the child widget is visible.
Therefore, it is recommended to show child widgets before
adding them to a notebook.

**Parameters**

- `pageNum`: index of the page to switch to, starting from 0. If negative, the last page will be used. If greater than the number of pages in the notebook, nothing will be done.

### `setGroupName`

```ts
setGroupName(groupName: string | null): void
```

Sets a group name for `notebook`.

Notebooks with the same name will be able to exchange tabs
via drag and drop. A notebook with a `null` group name will
not be able to exchange tabs with any other notebook.

**Parameters**

- `groupName`: the name of the notebook group, or `null` to unset it

### `setMenuLabel`

```ts
setMenuLabel(child: Gtk.Widget, menuLabel: Gtk.Widget | null): void
```

Changes the menu label for the page containing `child`.

**Parameters**

- `child`: the child widget
- `menuLabel`: the menu label, or `null` for default

### `setMenuLabelText`

```ts
setMenuLabelText(child: Gtk.Widget, menuText: string): void
```

Creates a new label and sets it as the menu label of `child`.

**Parameters**

- `child`: the child widget
- `menuText`: the label text

### `setScrollable`

```ts
setScrollable(scrollable: boolean): void
```

Sets whether the tab label area will have arrows for
scrolling if there are too many tabs to fit in the area.

**Parameters**

- `scrollable`: `true` if scroll arrows should be added

### `setShowBorder`

```ts
setShowBorder(showBorder: boolean): void
```

Sets whether a bevel will be drawn around the notebook pages.

This only has a visual effect when the tabs are not shown.

**Parameters**

- `showBorder`: `true` if a bevel should be drawn around the notebook

### `setShowTabs`

```ts
setShowTabs(showTabs: boolean): void
```

Sets whether to show the tabs for the notebook or not.

**Parameters**

- `showTabs`: `true` if the tabs should be shown

### `setTabDetachable`

```ts
setTabDetachable(child: Gtk.Widget, detachable: boolean): void
```

Sets whether the tab can be detached from `notebook` to another
notebook or widget.

Note that two notebooks must share a common group identifier
(see `Gtk.Notebook.setGroupName()`) to allow automatic tabs
interchange between them.

If you want a widget to interact with a notebook through DnD
(i.e.: accept dragged tabs from it) it must be set as a drop
destination by adding to it a `Gtk.DropTarget` controller that accepts
the GType `GTK_TYPE_NOTEBOOK_PAGE`. The `:value` of said drop target will be
preloaded with a `Gtk.NotebookPage` object that corresponds to the
dropped tab, so you can process the value via `::accept` or `::drop` signals.

Note that you should use `Gtk.Notebook.detachTab()` instead
of `Gtk.Notebook.removePage()` if you want to remove the tab
from the source notebook as part of accepting a drop. Otherwise,
the source notebook will think that the dragged tab was removed
from underneath the ongoing drag operation, and will initiate a
drag cancel animation.

```c
static void
on_drag_data_received (GtkWidget        *widget,
                       GdkDrop          *drop,
                       GtkSelectionData *data,
                       guint             time,
                       gpointer          user_data)
{
  GtkDrag *drag;
  GtkWidget *notebook;
  GtkWidget **child;

  drag = gtk_drop_get_drag (drop);
  notebook = g_object_get_data (drag, "gtk-notebook-drag-origin");
  child = (void*) gtk_selection_data_get_data (data);

  // process_widget (*child);

  gtk_notebook_detach_tab (GTK_NOTEBOOK (notebook), *child);
}
```

If you want a notebook to accept drags from other widgets,
you will have to set your own DnD code to do it.

**Parameters**

- `child`: a child `GtkWidget`
- `detachable`: whether the tab is detachable or not

### `setTabLabel`

```ts
setTabLabel(child: Gtk.Widget, tabLabel: Gtk.Widget | null): void
```

Changes the tab label for `child`.

If `null` is specified for `tab_label`, then the page will
have the label “page N”.

**Parameters**

- `child`: the page
- `tabLabel`: the tab label widget to use, or `null` for default tab label

### `setTabLabelText`

```ts
setTabLabelText(child: Gtk.Widget, tabText: string): void
```

Creates a new label and sets it as the tab label for the page
containing `child`.

**Parameters**

- `child`: the page
- `tabText`: the label text

### `setTabPos`

```ts
setTabPos(pos: Gtk.PositionType): void
```

Sets the edge at which the tabs are drawn.

**Parameters**

- `pos`: the edge to draw the tabs at

### `setTabReorderable`

```ts
setTabReorderable(child: Gtk.Widget, reorderable: boolean): void
```

Sets whether the notebook tab can be reordered
via drag and drop or not.

**Parameters**

- `child`: a child `GtkWidget`
- `reorderable`: whether the tab is reorderable or not
