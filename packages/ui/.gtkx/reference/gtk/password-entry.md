---
description: "A single-line text entry widget for entering passwords and other secrets."
---

# GtkPasswordEntry

A single-line text entry widget for entering passwords and other secrets.



It does not show its contents in clear text, does not allow to copy it
to the clipboard, and it shows a warning when Caps Lock is engaged. If
the underlying platform allows it, `GtkPasswordEntry` will also place
the text in a non-pageable memory area, to avoid it being written out
to disk by the operating system.

Optionally, it can offer a way to reveal the contents in clear text.

`GtkPasswordEntry` provides only minimal API and should be used with
the `Gtk.Editable` API.

## CSS Nodes

```
entry.password
╰── text
    ├── image.caps-lock-indicator
    ┊
```

`GtkPasswordEntry` has a single CSS node with name entry that carries
a .passwordstyle class. The text Css node below it has a child with
name image and style class .caps-lock-indicator for the Caps Lock
icon, and possibly other children.

## Accessibility

`GtkPasswordEntry` uses the `Gtk.AccessibleRole.text_box` role.

```tsx
import { GtkPasswordEntry } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkPasswordEntry**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Gtk.PasswordEntry` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatesDefault`

`boolean` · default `false`

Whether to activate the default widget when Enter is pressed.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `extraMenu`

`Gio.MenuModel | ReactElement`

A menu model whose contents will be appended to
the context menu.

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `placeholderText`

`string` · default `null`

The text that will be displayed in the `GtkPasswordEntry`
when it is empty and unfocused.

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `showPeekIcon`

`boolean` · default `false`

Whether to show an icon for revealing the content.

### `text`

`string` · from `GtkEditable`

The contents of the entry.

### `widthChars`

`number` · default `-1` · from `GtkEditable`

Number of characters to leave space for in the entry.

### `xalign`

`number` · default `0.000000` · from `GtkEditable`

The horizontal alignment, from 0 (left) to 1 (right).

Reversed for RTL layouts.

## Signals

### `onActivate`

```ts
(self: Gtk.PasswordEntry) => void
```

Emitted when the entry is activated.

The keybindings for this signal are all forms of the Enter key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChanged`

```ts
(self: Gtk.PasswordEntry) => void
```

From `GtkEditable`.

Emitted at the end of a single user-visible operation on the
contents.

E.g., a paste operation that replaces the contents of the
selection will cause only one signal emission (even though it
is implemented by first deleting the selection, then inserting
the new content, and may cause multiple ::notify::text signals
to be emitted).

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDeleteText`

```ts
(startPos: number, endPos: number, self: Gtk.PasswordEntry) => void
```

From `GtkEditable`.

Emitted when text is deleted from the widget by the user.

The default handler for this signal will normally be responsible for
deleting the text, so by connecting to this signal and then stopping
the signal with `g_signal_stop_emission()`, it is possible to modify the
range of deleted text, or prevent it from being deleted entirely.

The `start_pos` and `end_pos` parameters are interpreted as for
`Gtk.Editable.deleteText()`.

**Parameters**

- `startPos`: the starting position
- `endPos`: the end position
- `self`: The instance the signal was emitted on.

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Gtk.PasswordEntry) => number
```

From `GtkEditable`.

Emitted when text is inserted into the widget by the user.

The default handler for this signal will normally be responsible
for inserting the text, so by connecting to this signal and then
stopping the signal with `g_signal_stop_emission()`, it is possible
to modify the inserted text, or prevent it from being inserted entirely.

**Parameters**

- `text`: the new text to insert
- `length`: the length of the new text, in bytes, or -1 if new_text is nul-terminated
- `position`: the position, in characters, at which to insert the new text. this is an in-out parameter. After the signal emission is finished, it should point after the newly inserted text.
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.PasswordEntry` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getExtraMenu`

```ts
getExtraMenu(): Gio.MenuModel | null
```

Gets the menu model set with `gtk_password_entry_set_extra_menu()`.

**Returns** the menu model

### `getShowPeekIcon`

```ts
getShowPeekIcon(): boolean
```

Returns whether the entry is showing an icon to
reveal the contents.

**Returns** `true` if an icon is shown

### `setExtraMenu`

```ts
setExtraMenu(model: Gio.MenuModel | null): void
```

Sets a menu model to add when constructing
the context menu for `entry`.

**Parameters**

- `model`: a `GMenuModel`

### `setShowPeekIcon`

```ts
setShowPeekIcon(showPeekIcon: boolean): void
```

Sets whether the entry should have a clickable icon
to reveal the contents.

Setting this to `false` also hides the text again.

**Parameters**

- `showPeekIcon`: whether to show the peek icon
