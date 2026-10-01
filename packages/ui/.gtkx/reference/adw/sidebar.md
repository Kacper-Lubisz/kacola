---
description: "Adaptive sidebar widget."
---

# AdwSidebar

Adaptive sidebar widget.



`AdwSidebar` contains `SidebarSection` objects, which in turn contain
`SidebarItem` objects.

To add sections, use `Sidebar.append()`, `Sidebar.prepend()` or
`Sidebar.insert()`.

To remove sections, use `Sidebar.remove()` or
`Sidebar.removeAll()`.

To inspect the items, use `Sidebar.getItem()` or
`Sidebar.items`.

To inspect sections themselves, use `Sidebar.getSection()` or
`Sidebar.sections`.

### Selection and activation

`AdwSidebar` has zero or one selected items. The index of the item can be
accessed and changed via `Sidebar.selected`. Set it to
`Gtk.INVALID_LIST_POSITION` to remove selection.

Selection cannot be permanently disabled.

`Sidebar.selectedItem` can be used to access the selected item.

Connect to the `Sidebar.activated` signal to run code when an item
has been activated. This can be used to toggle the visible pane when used in
a split view.

See also: `ViewSwitcherSidebar`.

### Modes



`AdwSidebar` is adaptive and can act as either a regular sidebar, or a page
of boxed lists.

Use the `Sidebar.mode` to determine its look and behavior.

A typical use case involves using `AdwSidebar` inside the sidebar pane of a
`NavigationSplitView`, and switching mode to page whenever it's
collapsed, as follows:

```xml
<object class="AdwWindow">
  <property name="default-width">800</property>
  <property name="default-height">600</property>
  <child>
    <object class="AdwBreakpoint">
      <condition>max-width: 400sp</condition>
      <setter object="split_view" property="collapsed">True</setter>
      <setter object="sidebar" property="mode">page</setter>
    </object>
  </child>
  <property name="content">
    <object class="AdwNavigationSplitView" id="split_view">
      <property name="sidebar">
        <object class="AdwNavigationPage">
          <property name="title" translatable="yes">Sidebar</property>
          <property name="child">
            <object class="AdwToolbarView">
              <child type="top">
                <object class="AdwHeaderBar"/>
              </child>
              <property name="content">
                <object class="AdwSidebar" id="sidebar">
                  <!-- Calls adw_navigation_split_view_set_show_content (split_view, TRUE); -->
                  <signal name="activated" handler="sidebar_activated_cb"/>
                  <!-- ... -->
                </object>
              </property>
            </object>
          </property>
        </object>
      </property>
      <property name="content">
        <object class="AdwNavigationPage">
          <property name="title" translatable="yes">Content</property>
          <property name="child">
            <!-- ... -->
          </property>
        </object>
      </property>
    </object>
  </property>
</object>
```

When used with `OverlaySplitView`, the sidebar should stay in sidebar
mode, as the sidebar pane is still a sidebar when collapsed.

### Search

`AdwSidebar` supports filtering items via the `Sidebar.filter`
property.

Use `Sidebar.placeholder` to provide an empty state widget. It will
be shown when all items have been filtered out, or the sidebar has no items
otherwise.

### Context Menu

To create a context menu for the sidebar items, use the
`Sidebar.menuModel` property to provide a menu model, and the
`Sidebar.setup-menu` signal to set up actions for the given item.

To set or override the menu for just one section, use
`SidebarSection.menuModel` instead.

### Drag-and-Drop

`AdwSidebar` items can have a drop target for arbitrary content.

Use `Sidebar.setupDropTarget()` to set it up, specifying the
supported content types and drag actions, then connect to
`Sidebar.drop` to handle drops.

In some cases, it may be necessary to determine the used action based on the
dragged content, or the hovered item.

To determine it based on the sidebar item, connect to the
`Sidebar.drop-enter` signal and return the action from its handler.

To determine it based on the content, set `Sidebar.dropPreload` to
`TRUE`, then connect to `Sidebar.drop-value-loaded` signal and return
the action from its handler.

In both cases the action will be passed as a parameter to the
`Sidebar.drop` signal.

Regardless of whether a drop target was set up, dragging content over sidebar
items activates them after a timeout. To disable this behavior for specific
items, set `SidebarItem.dragMotionActivate` to `FALSE` on them.

### `AdwSidebar` as `GtkBuildable`

`AdwSidebar` allows adding sections as children.

Example of an `AdwSidebar` UI definition:

```xml
<object class="AdwSidebar">
  <child>
    <object class="AdwSidebarSection">
      <child>
        <object class="AdwSidebarItem">
          <property name="title" translatable="yes">Recent</property>
          <property name="icon-name">document-open-recent-symbolic</property>
        </object>
      </child>
      <child>
        <object class="AdwSidebarItem">
          <property name="title" translatable="yes">Starred</property>
          <property name="icon-name">starred-symbolic</property>
        </object>
      </child>
    </object>
  </child>
  <child>
    <object class="AdwSidebarSection">
      <property name="title" translatable="yes">Places</property>
      <child>
        <object class="AdwSidebarItem">
          <property name="title" translatable="yes">Music</property>
          <property name="icon-name">folder-music-symbolic</property>
        </object>
      </child>
      <child>
        <object class="AdwSidebarItem">
          <property name="title" translatable="yes">Pictures</property>
          <property name="icon-name">folder-pictures-symbolic</property>
        </object>
      </child>
      <child>
        <object class="AdwSidebarItem">
          <property name="title" translatable="yes">Videos</property>
          <property name="icon-name">folder-videos-symbolic</property>
        </object>
      </child>
    </object>
  </child>
  <child>
    <object class="AdwSidebarSection">
      <child>
        <object class="AdwSidebarItem">
          <property name="title" translatable="yes">Trash</property>
          <property name="icon-name">user-trash-symbolic</property>
        </object>
      </child>
    </object>
  </child>
</object>
```

### CSS nodes

`AdwSidebar` has a main CSS node with the name `sidebar`.

Internally, it's using a `Gtk.ListBox` with the
[`.navigation-sidebar`](style-classes.html#sidebars) style class in sidebar
mode, or an `PreferencesPage` in page mode.

### Accessibility

`AdwSidebar` uses the `Gtk.AccessibleRole.generic` role.

_Available since 1.9._

```tsx
import { AdwSidebar } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwSidebar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.Sidebar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `dropPreload`

`boolean` · default `false`

Whether the drop data should be preloaded on hover.

See `Gtk.DropTarget.preload`.

_Available since 1.9._

### `filter`

`Gtk.Filter | ReactElement`

The item filter.

Can be used to implement search within the sidebar.

Use `Sidebar.placeholder` to provide an empty state.

_Available since 1.9._

### `items`

`Gtk.SelectionModel` · read-only, observe with `onNotifyItems`

A list model with the sidebar's items.

This can be used to keep an up-to-date view.

The model implements `Gtk.SectionModel` and creates sections
corresponding to the sidebar's sections.

The model also implements `Gtk.SelectionModel` and can be used to
track and change the selection.

To only track sections, use `Sidebar.sections` instead.

_Available since 1.9._

### `menuModel`

`Gio.MenuModel | ReactElement`

Context menu model for the items.

When a context menu is shown for an item, it will be constructed from the
provided menu model. Use the `Sidebar.setup-menu` signal to set up
the menu actions for the particular item.

`Sidebar.menuModel` will be preferred over this model if set.

_Available since 1.9._

### `mode`

`Adw.SidebarMode` · default `ADW_SIDEBAR_MODE_SIDEBAR`

Determines the sidebar's look and behavior.



If set to `Adw.SidebarMode.sidebar`, behaves like a sidebar: with a
sidebar style and a persistent selection.

If set to `Adw.SidebarMode.page`, behaves like a page of boxed lists.
In this mode, the selection is invisible and only tracked to determine the
initially selected item once switched back to sidebar mode.

The page mode is intended to be used with `NavigationSplitView` when
collapsed, as the sidebar pane becomes a page there.

When used with `OverlaySplitView`, the sidebar should stay in sidebar
mode, as the sidebar pane is still a sidebar when collapsed.

_Available since 1.9._

### `placeholder`

`Gtk.Widget | ReactElement`

The placeholder widget.

This widget will be shown if the sidebar has no items, or all of its items
have been filtered out by `Sidebar.filter`.

_Available since 1.9._

### `sections`

`Gio.ListModel` · read-only, observe with `onNotifySections`

A list model with the sidebar's sections.

This can be used to keep an up-to-date view.

To track items, use `Sidebar.items` instead.

_Available since 1.9._

### `selected`

`number` · default `4294967295`

The index of the currently selected item.

If set to `Gtk.INVALID_LIST_POSITION`, no item is selected.

If `Sidebar.mode` is set to `Adw.SidebarMode.page`, the
selection is invisible, but still tracked, indicating which item will be
selected once the mode is changed to `Adw.SidebarMode.sidebar`.

See also: `Sidebar.selectedItem`.

_Available since 1.9._

### `selectedItem`

`Adw.SidebarItem` · read-only, observe with `onNotifySelectedItem`

The currently selected item.

This is a convenience property, equivalent to calling
`Sidebar.getItem()` with `Sidebar.selected` provided as the
index.

To change selection, use `Sidebar.selected`.

_Available since 1.9._

## Signals

### `onActivated`

```ts
(index: number, self: Adw.Sidebar) => void
```

Emitted when an item at `index` has been activated.

**Parameters**

- `index`: the item index
- `self`: The instance the signal was emitted on.

_Available since 1.9._

### `onDrop`

```ts
(index: number, value: GObject.Value, preferredAction: Gdk.DragAction, self: Adw.Sidebar) => boolean | undefined
```

Emitted when content is dropped onto the item at `index`.

The content must be of one of the types set up via
`Sidebar.setupDropTarget()`.

See `Gtk.DropTarget.drop`.

**Parameters**

- `index`: index of the item the content was dropped onto
- `value`: the `GValue` being dropped
- `preferredAction`: the preferred drop action
- `self`: The instance the signal was emitted on.

**Returns** whether the drop was accepted

SinceL 1.9

### `onDropEnter`

```ts
(index: number, self: Adw.Sidebar) => Gdk.DragAction | undefined
```

Emitted when the pointer enters the item at `index`.

Applications can use this to set their default drop action even when
`Sidebar.dropPreload` is set to `FALSE`.

See `Gtk.DropTarget.enter`.

**Parameters**

- `index`: index of the hovered item
- `self`: The instance the signal was emitted on.

**Returns** the preferred action for the drop

_Available since 1.9._

### `onDropValueLoaded`

```ts
(index: number, value: GObject.Value, self: Adw.Sidebar) => Gdk.DragAction | undefined
```

Emitted when the dropped content is preloaded for the item at `index`.

In order for data to be preloaded, `Sidebar.dropPreload`
must be set to `TRUE`.

The content must be of one of the types set up via
`Sidebar.setupDropTarget()`.

See `Gtk.DropTarget.value`.

**Parameters**

- `index`: index of the hovered item
- `value`: the `GValue` being dropped
- `self`: The instance the signal was emitted on.

**Returns** the preferred action for the drop

_Available since 1.9._

### `onSetupMenu`

```ts
(item: Adw.SidebarItem | null, self: Adw.Sidebar) => void
```

Emitted when a context menu is opened or closed for `item`.

If the menu has been closed, `item` will be set to `NULL`.

It can be used to set up menu actions before showing the menu, for example
disable actions not applicable to `item`.

**Parameters**

- `item`: an item in `self`
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.Sidebar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(section: Adw.SidebarSection): void
```

Appends `section` to `self`.

**Parameters**

- `section`: a section to append

_Available since 1.9._

### `getDropPreload`

```ts
getDropPreload(): boolean
```

Gets whether drop data should be preloaded on hover.

**Returns** whether drop data should be preloaded on hover

_Available since 1.9._

### `getFilter`

```ts
getFilter(): Gtk.Filter | null
```

Gets the item filter for `self`.

**Returns** the item filter

_Available since 1.9._

### `getItem`

```ts
getItem(index: number): Adw.SidebarItem | null
```

Gets the item at `index` within `self`.

The index starts from 0 at the top of the sidebar, and is same as the one
returned by `SidebarItem.getIndex()`.

Can return `NULL` if `index` is larger or equal to the number of items.

**Parameters**

- `index`: index of the item

**Returns** the item at `index`

_Available since 1.9._

### `getItems`

```ts
getItems(): Gtk.SelectionModel
```

Gets a list model with `self`'s items.

This can be used to keep an up-to-date view.

The model implements `Gtk.SectionModel` and creates sections
corresponding to the sidebar's sections.

The model also implements `Gtk.SelectionModel` and can be used to
track and change the selection.

To only track sections, use `Sidebar.sections` instead.

**Returns** a model containing the items

_Available since 1.9._

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Gets the context menu model for `self`'s items.

**Returns** the context menu model

_Available since 1.9._

### `getMode`

```ts
getMode(): Adw.SidebarMode
```

Gets `self`'s look and behavior.

**Returns** the current mode

_Available since 1.9._

### `getPlaceholder`

```ts
getPlaceholder(): Gtk.Widget | null
```

Gets the placeholder widget for `self`.

**Returns** the placeholder widget

_Available since 1.9._

### `getSection`

```ts
getSection(index: number): Adw.SidebarSection | null
```

Gets the section at `index` within `self`.

Can return `NULL` if `index` is larger or equal to the number of sections.

**Parameters**

- `index`: index of the section

**Returns** the section at `index`

_Available since 1.9._

### `getSections`

```ts
getSections(): Gio.ListModel
```

Gets a list model with `self`'s sections.

This can be used to keep an up-to-date view.

To track items, use `Sidebar.items` instead.

**Returns** a model containing the sections

_Available since 1.9._

### `getSelected`

```ts
getSelected(): number
```

Gets the index of the currently selected item.

See also: `Sidebar.getSelectedItem()`.

**Returns** index of the currently selected item

_Available since 1.9._

### `getSelectedItem`

```ts
getSelectedItem(): Adw.SidebarItem | null
```

Gets the currently selected item.

This is a convenience method, equivalent to calling `Sidebar.getItem()`
with `Sidebar.selected` provided as the index.

To change selection, use `Sidebar.setSelected()`.

**Returns** the selected item

_Available since 1.9._

### `insert`

```ts
insert(section: Adw.SidebarSection, position: number): void
```

Inserts `section` at `position` to `self`.

If `position` is -1, or larger than the total number of sections in `self`,
the section will be appended to the end.

**Parameters**

- `section`: a section to insert
- `position`: position to insert `section` at

_Available since 1.9._

### `prepend`

```ts
prepend(section: Adw.SidebarSection): void
```

Prepends `section` to `self`.

**Parameters**

- `section`: a section to prepend

_Available since 1.9._

### `remove`

```ts
remove(section: Adw.SidebarSection): void
```

Removes `section` from `self`.

**Parameters**

- `section`: a section to remove

_Available since 1.9._

### `removeAll`

```ts
removeAll(): void
```

Removes all sections from `self`.

_Available since 1.9._

### `setDropPreload`

```ts
setDropPreload(preload: boolean): void
```

Sets whether drop data should be preloaded on hover.

See `Gtk.DropTarget.preload`.

**Parameters**

- `preload`: whether to preload drop data

_Available since 1.9._

### `setFilter`

```ts
setFilter(filter: Gtk.Filter | null): void
```

Sets the item filter for `self`.

Can be used to implement search within the sidebar.

Use `Sidebar.placeholder` to provide an empty state.

**Parameters**

- `filter`: the item filter

_Available since 1.9._

### `setMenuModel`

```ts
setMenuModel(menuModel: Gio.MenuModel | null): void
```

Sets the context menu model for `self`'s items.

When a context menu is shown for an item, it will be constructed from the
provided menu model. Use the `Sidebar.setup-menu` signal to set up
the menu actions for the particular item.

`Sidebar.menuModel` will be preferred over this model if set.

**Parameters**

- `menuModel`: a menu model

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

**Parameters**

- `mode`: the new mode

_Available since 1.9._

### `setPlaceholder`

```ts
setPlaceholder(placeholder: Gtk.Widget | null): void
```

Sets the placeholder widget for `self`.

This widget will be shown if `self` has no items, or all of its items have
been filtered out by `Sidebar.filter`.

**Parameters**

- `placeholder`: the placeholder widget

_Available since 1.9._

### `setSelected`

```ts
setSelected(selected: number): void
```

Selects the item at `selected`.

If set to `Gtk.INVALID_LIST_POSITION`, no item is selected.

If `Sidebar.mode` is set to `Adw.SidebarMode.page`, the
selection is invisible, but still tracked, indicating which item will be
selected once the mode is changed to `Adw.SidebarMode.sidebar`.

See also: `Sidebar.selectedItem`.

**Parameters**

- `selected`: index of the newly selected item

_Available since 1.9._

### `setupDropTarget`

```ts
setupDropTarget(actions: Gdk.DragAction, types: (bigint | AnyClass<TypedClass>)[] | null): void
```

Sets up a drop target on the items.

This allows to drag arbitrary content onto items.

The `Sidebar.drop` signal can be used to handle the drop.

**Parameters**

- `actions`: the supported actions
- `types`: all supported `GType`s that can be dropped

_Available since 1.9._
