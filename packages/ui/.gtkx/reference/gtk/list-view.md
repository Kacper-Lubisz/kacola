---
description: "Presents a large dynamic list of items."
---

# GtkListView

Presents a large dynamic list of items.

`GtkListView` uses its factory to generate one row widget for each visible
item and shows them in a linear display, either vertically or horizontally.

The `Gtk.ListView.showSeparators` property offers a simple way to
display separators between the rows.

`GtkListView` allows the user to select items according to the selection
characteristics of the model. For models that allow multiple selected items,
it is possible to turn on _rubberband selection_, using
`Gtk.ListView.enableRubberband`.

If you need multiple columns with headers, see `Gtk.ColumnView`.

To learn more about the list widget framework, see the
[overview](section-list-widget.html).

An example of using `GtkListView`:
```c
static void
setup_listitem_cb (GtkListItemFactory *factory,
                   GtkListItem        *list_item)
{
  GtkWidget *image;

  image = gtk_image_new ();
  gtk_image_set_icon_size (GTK_IMAGE (image), GTK_ICON_SIZE_LARGE);
  gtk_list_item_set_child (list_item, image);
}

static void
bind_listitem_cb (GtkListItemFactory *factory,
                  GtkListItem        *list_item)
{
  GtkWidget *image;
  GAppInfo *app_info;

  image = gtk_list_item_get_child (list_item);
  app_info = gtk_list_item_get_item (list_item);
  gtk_image_set_from_gicon (GTK_IMAGE (image), g_app_info_get_icon (app_info));
}

static void
activate_cb (GtkListView  *list,
             guint         position,
             gpointer      unused)
{
  GAppInfo *app_info;

  app_info = g_list_model_get_item (G_LIST_MODEL (gtk_list_view_get_model (list)), position);
  g_app_info_launch (app_info, NULL, NULL, NULL);
  g_object_unref (app_info);
}

...

  model = create_application_list ();

  factory = gtk_signal_list_item_factory_new ();
  g_signal_connect (factory, "setup", G_CALLBACK (setup_listitem_cb), NULL);
  g_signal_connect (factory, "bind", G_CALLBACK (bind_listitem_cb), NULL);

  list = gtk_list_view_new (GTK_SELECTION_MODEL (gtk_single_selection_new (model)), factory);

  g_signal_connect (list, "activate", G_CALLBACK (activate_cb), NULL);

  gtk_scrolled_window_set_child (GTK_SCROLLED_WINDOW (sw), list);
```

## Actions

`GtkListView` defines a set of built-in actions:

- `list.activate-item` activates the item at given position by emitting
  the `Gtk.ListView.activate` signal.

## CSS nodes

```
listview[.separators][.rich-list][.navigation-sidebar][.data-table]
├── row[.activatable]
│
├── row[.activatable]
│
┊
╰── [rubberband]
```

`GtkListView` uses a single CSS node named `listview`. It may carry the
`.separators` style class, when `Gtk.ListView.showSeparators`
property is set. Each child widget uses a single CSS node named `row`.
If the `Gtk.ListItem.activatable` property is set, the
corresponding row will have the `.activatable` style class. For
rubberband selection, a node with name `rubberband` is used.

The main listview node may also carry style classes to select
the style of [list presentation](section-list-widget.html#list-styles):
.rich-list, .navigation-sidebar or .data-table.

## Accessibility

`GtkListView` uses the `Gtk.AccessibleRole.list` role, and the list
items use the `Gtk.AccessibleRole.list_item` role.

```tsx
import { GtkListView } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBase](.gtkx/reference/gtk/list-base.md) → **GtkListView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.ListView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableRubberband`

`boolean` · default `false`

Allow rubberband selection.

### `factory`

`Gtk.ListItemFactory | ReactElement`

Factory for populating list items.

The factory must be for configuring `Gtk.ListItem` objects.

### `headerFactory`

`Gtk.ListItemFactory | ReactElement`

Factory for creating header widgets.

The factory must be for configuring `Gtk.ListHeader` objects.

_Available since 4.12._

### `model`

`Gtk.SelectionModel | ReactElement`

Model for the items displayed.

### `showSeparators`

`boolean` · default `false`

Show separators between rows.

### `singleClickActivate`

`boolean` · default `false`

Activate rows on single click and select them on hover.

### `tabBehavior`

`Gtk.ListTabBehavior` · default `GTK_LIST_TAB_ALL`

Behavior of the <kbd>Tab</kbd> key

_Available since 4.12._

## Signals

### `onActivate`

```ts
(position: number, self: Gtk.ListView) => void
```

Emitted when a row has been activated by the user.

Activation usually happens via the list.activate-item action of
the `GtkListView`.

This allows for a convenient way to handle activation in a listview.
See `Gtk.ListItem.setActivatable()` for details on how to use
this signal.

**Parameters**

- `position`: position of item to activate
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ListView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getEnableRubberband`

```ts
getEnableRubberband(): boolean
```

Returns whether rows can be selected by dragging with the mouse.

**Returns** true if rubberband selection is enabled

### `getFactory`

```ts
getFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate list items.

**Returns** The factory in use

### `getHeaderFactory`

```ts
getHeaderFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate section headers.

**Returns** The factory in use

_Available since 4.12._

### `getModel`

```ts
getModel(): Gtk.SelectionModel | null
```

Gets the model that's currently used to read the items displayed.

**Returns** The model in use

### `getShowSeparators`

```ts
getShowSeparators(): boolean
```

Returns whether the listview should show separators
between rows.

**Returns** true if the listview shows separators

### `getSingleClickActivate`

```ts
getSingleClickActivate(): boolean
```

Returns whether rows will be activated on single click and
selected on hover.

**Returns** true if rows are activated on single click

### `getTabBehavior`

```ts
getTabBehavior(): Gtk.ListTabBehavior
```

Gets the behavior set for the <kbd>Tab</kbd> key.

**Returns** The behavior of the <kbd>Tab</kbd> key

_Available since 4.12._

### `scrollTo`

```ts
scrollTo(pos: number, flags: Gtk.ListScrollFlags, scroll: Gtk.ScrollInfo | null): void
```

Scrolls to the item at the given position and performs the actions
specified in `flags`.

This function works no matter if the listview is shown or focused.
If it isn't, then the changes will take effect once that happens.

**Parameters**

- `pos`: position of the item. Must be less than the number of items in the view.
- `flags`: actions to perform
- `scroll`: details of how to perform the scroll operation or `null` to scroll into view

_Available since 4.12._

### `setEnableRubberband`

```ts
setEnableRubberband(enableRubberband: boolean): void
```

Sets whether selections can be changed by dragging with the mouse.

**Parameters**

- `enableRubberband`: whether to enable rubberband selection

### `setFactory`

```ts
setFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for populating list items.

**Parameters**

- `factory`: the factory to use

### `setHeaderFactory`

```ts
setHeaderFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for populating the
`Gtk.ListHeader` objects used in section headers.

If this factory is set to `NULL`, the list will not show
section headers.

**Parameters**

- `factory`: the factory to use

_Available since 4.12._

### `setModel`

```ts
setModel(model: Gtk.SelectionModel | null): void
```

Sets the model to use.

This must be a `Gtk.SelectionModel` to use.

**Parameters**

- `model`: the model to use

### `setShowSeparators`

```ts
setShowSeparators(showSeparators: boolean): void
```

Sets whether the listview should show separators
between rows.

**Parameters**

- `showSeparators`: whether to show separators

### `setSingleClickActivate`

```ts
setSingleClickActivate(singleClickActivate: boolean): void
```

Sets whether rows should be activated on single click and
selected on hover.

**Parameters**

- `singleClickActivate`: whether to activate items on single click

### `setTabBehavior`

```ts
setTabBehavior(tabBehavior: Gtk.ListTabBehavior): void
```

Sets the <kbd>Tab</kbd> key behavior.

This influences how the <kbd>Tab</kbd> and
<kbd>Shift</kbd>+<kbd>Tab</kbd> keys move the
focus in the listview.

**Parameters**

- `tabBehavior`: The desired tab behavior

_Available since 4.12._
