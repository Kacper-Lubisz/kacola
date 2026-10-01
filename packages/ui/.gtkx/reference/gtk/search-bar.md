---
description: "Reveals a search entry when search is started."
---

# GtkSearchBar

Reveals a search entry when search is started.



It can also contain additional widgets, such as drop-down menus,
or buttons.  The search bar would appear when a search is started
through typing on the keyboard, or the application’s search mode
is toggled on.

For keyboard presses to start a search, the search bar must be told
of a widget to capture key events from through
`Gtk.SearchBar.setKeyCaptureWidget()`. This widget will
typically be the top-level window, or a parent container of the
search bar. Common shortcuts such as Ctrl+F should be handled as an
application action, or through the menu items.

You will also need to tell the search bar about which entry you
are using as your search entry using `Gtk.SearchBar.connectEntry()`.

### Creating a search bar

The following example shows you how to create a more complex search
entry.

[A simple example](https://gitlab.gnome.org/GNOME/gtk/tree/main/examples/search-bar.c)

## Shortcuts and Gestures

`GtkSearchBar` supports the following keyboard shortcuts:

- <kbd>Escape</kbd> hides the search bar.

## CSS nodes

```
searchbar
╰── revealer
    ╰── box
         ├── [child]
         ╰── [button.close]
```

`GtkSearchBar` has a main CSS node with name searchbar. It has a child
node with name revealer that contains a node with name box. The box node
contains both the CSS node of the child widget as well as an optional button
node which gets the .close style class applied.

## Accessibility

`GtkSearchBar` uses the `Gtk.AccessibleRole.search` role.

```tsx
import { GtkSearchBar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSearchBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.SearchBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `keyCaptureWidget`

`Gtk.Widget | ReactElement`

The key capture widget.

### `searchModeEnabled`

`boolean` · default `false`

Whether the search mode is on and the search bar shown.

### `showCloseButton`

`boolean` · default `false`

Whether to show the close button in the search bar.

## Methods

Methods are called on the `Gtk.SearchBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `connectEntry`

```ts
connectEntry(entry: Gtk.Editable): void
```

Connects the `GtkEditable` widget passed as the one to be used in
this search bar.

The entry should be a descendant of the search bar. Calling this
function manually is only required if the entry isn’t the direct
child of the search bar (as in our main example).

**Parameters**

- `entry`: a `GtkEditable`

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `bar`.

**Returns** the child widget of `bar`

### `getKeyCaptureWidget`

```ts
getKeyCaptureWidget(): Gtk.Widget | null
```

Gets the widget that `bar` is capturing key events from.

**Returns** The key capture widget.

### `getSearchMode`

```ts
getSearchMode(): boolean
```

Returns whether the search mode is on or off.

**Returns** whether search mode is toggled on

### `getShowCloseButton`

```ts
getShowCloseButton(): boolean
```

Returns whether the close button is shown.

**Returns** whether the close button is shown

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `bar`.

**Parameters**

- `child`: the child widget

### `setKeyCaptureWidget`

```ts
setKeyCaptureWidget(widget: Gtk.Widget | null): void
```

Sets `widget` as the widget that `bar` will capture key events
from.

If key events are handled by the search bar, the bar will
be shown, and the entry populated with the entered text.

Note that despite the name of this function, the events
are only 'captured' in the bubble phase, which means that
editable child widgets of `widget` will receive text input
before it gets captured. If that is not desired, you can
capture and forward the events yourself with
`Gtk.EventControllerKey.forward()`.

**Parameters**

- `widget`: a `GtkWidget`

### `setSearchMode`

```ts
setSearchMode(searchMode: boolean): void
```

Switches the search mode on or off.

**Parameters**

- `searchMode`: the new state of the search mode

### `setShowCloseButton`

```ts
setShowCloseButton(visible: boolean): void
```

Shows or hides the close button.

Applications that already have a “search” toggle button should not
show a close button in their search bar, as it duplicates the role
of the toggle button.

**Parameters**

- `visible`: whether the close button will be shown or not
