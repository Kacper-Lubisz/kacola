---
description: "GtkFileChooserWidget is a widget for choosing files."
---

# GtkFileChooserWidget

`GtkFileChooserWidget` is a widget for choosing files.

It exposes the `Gtk.FileChooser` interface, and you should
use the methods of this interface to interact with the
widget.

## Shortcuts and Gestures

`GtkFileChooserWidget` supports the following keyboard shortcuts:

- <kbd>Shift</kbd>+<kbd>F10</kbd> or <kbd>Menu</kbd> opens the context menu.

The following signals have default keybindings:

- `Gtk.FileChooserWidget.desktop-folder`
- `Gtk.FileChooserWidget.down-folder`
- `Gtk.FileChooserWidget.home-folder`
- `Gtk.FileChooserWidget.location-popup`
- `Gtk.FileChooserWidget.location-popup-on-paste`
- `Gtk.FileChooserWidget.location-toggle-popup`
- `Gtk.FileChooserWidget.places-shortcut`
- `Gtk.FileChooserWidget.quick-bookmark`
- `Gtk.FileChooserWidget.recent-shortcut`
- `Gtk.FileChooserWidget.search-shortcut`
- `Gtk.FileChooserWidget.show-hidden`
- `Gtk.FileChooserWidget.up-folder`

## CSS nodes

`GtkFileChooserWidget` has a single CSS node with name filechooser.

> **Deprecated since 4.10.** Direct use of `GtkFileChooserWidget` is deprecated

```tsx
import { GtkFileChooserWidget } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFileChooserWidget**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkFileChooser`.

## Props

`ref` receives the `Gtk.FileChooserWidget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `action`

`Gtk.FileChooserAction` · default `GTK_FILE_CHOOSER_ACTION_OPEN` · deprecated since 4.10 · from `GtkFileChooser`

The type of operation that the file chooser is performing.

> **Deprecated since 4.10.** Use `Gtk.FileDialog` instead

### `createFolders`

`boolean` · default `true` · deprecated since 4.10 · from `GtkFileChooser`

Whether a file chooser not in `GTK_FILE_CHOOSER_ACTION_OPEN` mode
will offer the user to create new folders.

> **Deprecated since 4.10.** Use `Gtk.FileDialog` instead

### `filter`

`Gtk.FileFilter | ReactElement` · deprecated since 4.10 · from `GtkFileChooser`

The current filter for selecting files that are displayed.

> **Deprecated since 4.10.** Use `Gtk.FileDialog` instead

### `filters`

`Gio.ListModel` · read-only, observe with `onNotifyFilters` · deprecated since 4.10 · from `GtkFileChooser`

A `GListModel` containing the filters that have been
added with `gtk_file_chooser_add_filter()`.

The returned object should not be modified. It may
or may not be updated for later changes.

> **Deprecated since 4.10.** Use `Gtk.FileDialog` instead

### `searchMode`

`boolean` · default `false`

Whether search mode is enabled.

### `selectMultiple`

`boolean` · default `false` · deprecated since 4.10 · from `GtkFileChooser`

Whether to allow multiple files to be selected.

> **Deprecated since 4.10.** Use `Gtk.FileDialog` instead

### `shortcutFolders`

`Gio.ListModel` · read-only, observe with `onNotifyShortcutFolders` · deprecated since 4.10 · from `GtkFileChooser`

A `GListModel` containing the shortcut folders that have been
added with `gtk_file_chooser_add_shortcut_folder()`.

The returned object should not be modified. It may
or may not be updated for later changes.

> **Deprecated since 4.10.** Use `Gtk.FileDialog` instead

### `showTime`

`boolean` · default `false` · read-only, observe with `onNotifyShowTime`

Whether to show the time.

_Available since 4.10._

### `subtitle`

`string` · read-only, observe with `onNotifySubtitle`

The subtitle of the file chooser widget.

## Signals

### `onDesktopFolder`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser show the user's Desktop
folder in the file list.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>D</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDownFolder`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser go to a child of the
current folder in the file hierarchy. The subfolder that will
be used is displayed in the path bar widget of the file chooser.
For example, if the path bar is showing "/foo/bar/baz", with bar
currently displayed, then this will cause the file chooser to
switch to the "baz" subfolder.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>Down</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onHomeFolder`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser show the user's home
folder in the file list.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>Home</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onLocationPopup`

```ts
(path: string, self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser show a "Location" prompt which
the user can use to manually type the name of the file he wishes to select.

The default bindings for this signal are <kbd>Control</kbd>-<kbd>L</kbd>
with a `path` string of "" (the empty string). It is also bound to
<kbd>/</kbd> with a `path` string of "`/`" (a slash):  this lets you
type `/` and immediately type a path name. On Unix systems, this is
bound to <kbd>~</kbd> (tilde) with a `path` string of "~" itself for
access to home directories.

**Parameters**

- `path`: a string that gets put in the text entry for the file name
- `self`: The instance the signal was emitted on.

### `onLocationPopupOnPaste`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser show a "Location" prompt
when the user pastes into a `GtkFileChooserWidget`.

The default binding for this signal is <kbd>Control</kbd>-<kbd>V</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onLocationTogglePopup`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to toggle the visibility of a "Location" prompt
which the user can use to manually type the name of the file
he wishes to select.

The default binding for this signal is <kbd>Control</kbd>-<kbd>L</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPlacesShortcut`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to move the focus to the places sidebar.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>P</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onQuickBookmark`

```ts
(bookmarkIndex: number, self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser switch to the bookmark
specified in the `bookmark_index` parameter. For example, if
you have three bookmarks, you can pass 0, 1, 2 to this signal
to switch to each of them, respectively.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>1</kbd>,
<kbd>Alt</kbd>-<kbd>2</kbd>, etc. until <kbd>Alt</kbd>-<kbd>0</kbd>.
Note that in the default binding, that <kbd>Alt</kbd>-<kbd>1</kbd> is
actually defined to switch to the bookmark at index 0, and so on
successively.

**Parameters**

- `bookmarkIndex`: the number of the bookmark to switch to
- `self`: The instance the signal was emitted on.

### `onRecentShortcut`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser show the Recent location.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>R</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSearchShortcut`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser show the search entry.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>S</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onShowHidden`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser display hidden files.

The default binding for this signal is <kbd>Control</kbd>-<kbd>H</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUpFolder`

```ts
(self: Gtk.FileChooserWidget) => void
```

Emitted when the user asks for it.

This is a [keybinding signal](class.SignalAction.html).

This is used to make the file chooser go to the parent
of the current folder in the file hierarchy.

The default binding for this signal is <kbd>Alt</kbd>-<kbd>Up</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.
