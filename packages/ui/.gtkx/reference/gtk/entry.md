---
description: "A single-line text entry widget."
---

# GtkEntry

A single-line text entry widget.



A fairly large set of key bindings are supported by default. If the
entered text is longer than the allocation of the widget, the widget
will scroll so that the cursor position is visible.

When using an entry for passwords and other sensitive information, it
can be put into “password mode” using `Gtk.Entry.setVisibility()`.
In this mode, entered text is displayed using a “invisible” character.
By default, GTK picks the best invisible character that is available
in the current font, but it can be changed with
`Gtk.Entry.setInvisibleChar()`.

`GtkEntry` has the ability to display progress or activity
information behind the text. To make an entry display such information,
use `Gtk.Entry.setProgressFraction()` or
`Gtk.Entry.setProgressPulseStep()`.

Additionally, `GtkEntry` can show icons at either side of the entry.
These icons can be activatable by clicking, can be set up as drag source
and can have tooltips. To add an icon, use
`Gtk.Entry.setIconFromGicon()` or one of the various other functions
that set an icon from an icon name or a paintable. To trigger an action when
the user clicks an icon, connect to the `Gtk.Entry.icon-press` signal.
To allow DND operations from an icon, use
`Gtk.Entry.setIconDragSource()`. To set a tooltip on an icon, use
`Gtk.Entry.setIconTooltipText()` or the corresponding function
for markup.

Note that functionality or information that is only available by clicking
on an icon in an entry may not be accessible at all to users which are not
able to use a mouse or other pointing device. It is therefore recommended
that any such functionality should also be available by other means, e.g.
via the context menu of the entry.

## CSS nodes

```
entry[.flat][.warning][.error]
├── text[.readonly]
├── image.left
├── image.right
╰── [progress[.pulse]]
```

`GtkEntry` has a main node with the name entry. Depending on the properties
of the entry, the style classes .read-only and .flat may appear. The style
classes .warning and .error may also be used with entries.

When the entry shows icons, it adds subnodes with the name image and the
style class .left or .right, depending on where the icon appears.

When the entry shows progress, it adds a subnode with the name progress.
The node has the style class .pulse when the shown progress is pulsing.

For all the subnodes added to the text node in various situations,
see `Gtk.Text`.

## GtkEntry as GtkBuildable

The `GtkEntry` implementation of the `GtkBuildable` interface supports a
custom `<attributes>` element, which supports any number of `<attribute>`
elements. The `<attribute>` element has attributes named “name“, “value“,
“start“ and “end“ and allows you to specify `PangoAttribute` values for
this label.

An example of a UI definition fragment specifying Pango attributes:
```xml
<object class="GtkEntry">
  <attributes>
    <attribute name="weight" value="PANGO_WEIGHT_BOLD"/>
    <attribute name="background" value="red" start="5" end="10"/>
  </attributes>
</object>
```

The start and end attributes specify the range of characters to which the
Pango attribute applies. If start and end are not specified, the attribute
is applied to the whole text. Note that specifying ranges does not make much
sense with translatable attributes. Use markup embedded in the translatable
content instead.

## Accessibility

`GtkEntry` uses the `Gtk.AccessibleRole.text_box` role.

```tsx
import { GtkEntry } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkEntry**

Implements `GtkAccessible`, `GtkBuildable`, `GtkCellEditable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Gtk.Entry` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatesDefault`

`boolean` · default `false`

Whether to activate the default widget when Enter is pressed.

### `attributes`

`Pango.AttrList`

A list of Pango attributes to apply to the text of the entry.

This is mainly useful to change the size or weight of the text.

The `PangoAttribute`'s `start_index` and `end_index` must refer to the
`Gtk.EntryBuffer` text, i.e. without the preedit string.

### `buffer`

`Gtk.EntryBuffer | ReactElement`

The buffer object which actually stores the text.

### `completion`

`Gtk.EntryCompletion | ReactElement` · deprecated since 4.10

The auxiliary completion object to use with the entry.

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `editingCanceled`

`boolean` · default `false` · from `GtkCellEditable`

Indicates whether editing on the cell has been canceled.

### `enableEmojiCompletion`

`boolean` · default `false`

Whether to suggest Emoji replacements for :-delimited names
like `:heart:`.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `extraMenu`

`Gio.MenuModel | ReactElement`

A menu model whose contents will be appended to the context menu.

### `hasFrame`

`boolean` · default `true`

Whether the entry should draw a frame.

### `imModule`

`string` · default `null`

Which IM (input method) module should be used for this entry.

See `Gtk.IMContext`.

Setting this to a non-`null` value overrides the system-wide IM
module setting. See the GtkSettings `Gtk.Settings.gtkImModule`
property.

### `inputHints`

`Gtk.InputHints` · default `GTK_INPUT_HINT_NONE`

Additional hints that allow input methods to fine-tune their behavior.

Also see `Gtk.Entry.inputPurpose`

### `inputPurpose`

`Gtk.InputPurpose` · default `GTK_INPUT_PURPOSE_FREE_FORM`

The purpose of this text field.

This property can be used by on-screen keyboards and other input
methods to adjust their behaviour.

Note that setting the purpose to `GTK_INPUT_PURPOSE_PASSWORD` or
`GTK_INPUT_PURPOSE_PIN` is independent from setting
`Gtk.Entry.visibility`.

### `invisibleChar`

`number` · default `42`

The character to use when masking entry contents (“password mode”).

### `invisibleCharSet`

`boolean` · default `false`

Whether the invisible char has been set for the `GtkEntry`.

### `maxLength`

`number` · default `0`

Maximum number of characters for this entry.

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `menuEntryIconPrimaryText`

`string` · default `null`

Text for an item in the context menu to activate the primary icon action.

When the primary icon is activatable and this property has been set, a new entry
in the context menu of this GtkEntry will appear with this text. Selecting that
menu entry will result in the primary icon being activated, exactly in the same way
as it would be activated from a mouse click.

This simplifies adding accessibility support to applications using activatable
icons. The activatable icons aren't focusable when navigating the interface with
the keyboard This is why Gtk recommends to also add those actions in the context
menu. This set of methods greatly simplifies this, by adding a menu item that, when
enabled, calls the same callback than clicking on the icon.

_Available since 4.20._

### `menuEntryIconSecondaryText`

`string` · default `null`

Text for an item in the context menu to activate the secondary icon action.

When the primary icon is activatable and this property has been set, a new entry
in the context menu of this GtkEntry will appear with this text. Selecting that
menu entry will result in the primary icon being activated, exactly in the same way
as it would be activated from a mouse click.

This simplifies adding accessibility support to applications using activatable
icons. The activatable icons aren't focusable when navigating the interface with
the keyboard This is why Gtk recommends to also add those actions in the context
menu. This set of methods greatly simplifies this, by adding a menu item that, when
enabled, calls the same callback than clicking on the icon.

_Available since 4.20._

### `overwriteMode`

`boolean` · default `false`

If text is overwritten when typing in the `GtkEntry`.

### `placeholderText`

`string` · default `null`

The text that will be displayed in the `GtkEntry` when it is empty
and unfocused.

### `primaryIconActivatable`

`boolean` · default `true`

Whether the primary icon is activatable.

GTK emits the `Gtk.Entry.icon-press` and
`Gtk.Entry.icon-release` signals only on sensitive,
activatable icons.

Sensitive, but non-activatable icons can be used for purely
informational purposes.

### `primaryIconGicon`

`Gio.Icon | ReactElement`

The `GIcon` to use for the primary icon for the entry.

### `primaryIconName`

`string` · default `null`

The icon name to use for the primary icon for the entry.

### `primaryIconPaintable`

`Gdk.Paintable | ReactElement`

A `GdkPaintable` to use as the primary icon for the entry.

### `primaryIconSensitive`

`boolean` · default `true`

Whether the primary icon is sensitive.

An insensitive icon appears grayed out. GTK does not emit the
`Gtk.Entry.icon-press` and `Gtk.Entry.icon-release`
signals and does not allow DND from insensitive icons.

An icon should be set insensitive if the action that would trigger
when clicked is currently not available.

### `primaryIconStorageType`

`Gtk.ImageType` · default `GTK_IMAGE_EMPTY` · read-only, observe with `onNotifyPrimaryIconStorageType`

The representation which is used for the primary icon of the entry.

### `primaryIconTooltipMarkup`

`string` · default `null`

The contents of the tooltip on the primary icon, with markup.

Also see `Gtk.Entry.setIconTooltipMarkup()`.

### `primaryIconTooltipText`

`string` · default `null`

The contents of the tooltip on the primary icon.

Also see `Gtk.Entry.setIconTooltipText()`.

### `progressFraction`

`number` · default `0.000000`

The current fraction of the task that's been completed.

### `progressPulseStep`

`number` · default `0.000000`

The fraction of total entry width to move the progress
bouncing block for each pulse.

See `Gtk.Entry.progressPulse()`.

### `scrollOffset`

`number` · default `0` · read-only, observe with `onNotifyScrollOffset`

Number of pixels of the entry scrolled off the screen to the left.

### `secondaryIconActivatable`

`boolean` · default `true`

Whether the secondary icon is activatable.

GTK emits the `Gtk.Entry.icon-press` and
`Gtk.Entry.icon-release` signals only on sensitive,
activatable icons.

Sensitive, but non-activatable icons can be used for purely
informational purposes.

### `secondaryIconGicon`

`Gio.Icon | ReactElement`

The `GIcon` to use for the secondary icon for the entry.

### `secondaryIconName`

`string` · default `null`

The icon name to use for the secondary icon for the entry.

### `secondaryIconPaintable`

`Gdk.Paintable | ReactElement`

A `GdkPaintable` to use as the secondary icon for the entry.

### `secondaryIconSensitive`

`boolean` · default `true`

Whether the secondary icon is sensitive.

An insensitive icon appears grayed out. GTK does not emit the
[signal@Gtk.Entry::icon-press[ and `Gtk.Entry.icon-release`
signals and does not allow DND from insensitive icons.

An icon should be set insensitive if the action that would trigger
when clicked is currently not available.

### `secondaryIconStorageType`

`Gtk.ImageType` · default `GTK_IMAGE_EMPTY` · read-only, observe with `onNotifySecondaryIconStorageType`

The representation which is used for the secondary icon of the entry.

### `secondaryIconTooltipMarkup`

`string` · default `null`

The contents of the tooltip on the secondary icon, with markup.

Also see `Gtk.Entry.setIconTooltipMarkup()`.

### `secondaryIconTooltipText`

`string` · default `null`

The contents of the tooltip on the secondary icon.

Also see `Gtk.Entry.setIconTooltipText()`.

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `showEmojiIcon`

`boolean` · default `false`

Whether the entry will show an Emoji icon in the secondary icon position
to open the Emoji chooser.

### `tabs`

`Pango.TabArray`

A list of tabstops to apply to the text of the entry.

### `text`

`string` · from `GtkEditable`

The contents of the entry.

### `textLength`

`number` · default `0` · read-only, observe with `onNotifyTextLength`

The length of the text in the `GtkEntry`.

### `truncateMultiline`

`boolean` · default `false`

When `true`, pasted multi-line text is truncated to the first line.

### `visibility`

`boolean` · default `true`

Whether the entry should show the “invisible char” instead of the
actual text (“password mode”).

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
(self: Gtk.Entry) => void
```

Emitted when the entry is activated.

The keybindings for this signal are all forms of the Enter key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChanged`

```ts
(self: Gtk.Entry) => void
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
(startPos: number, endPos: number, self: Gtk.Entry) => void
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

### `onEditingDone`

```ts
(self: Gtk.Entry) => void
```

From `GtkCellEditable`.

This signal is a sign for the cell renderer to update its
value from the `cell_editable`.

Implementations of `GtkCellEditable` are responsible for
emitting this signal when they are done editing, e.g.
`GtkEntry` emits this signal when the user presses Enter. Typical things to
do in a handler for ::editing-done are to capture the edited value,
disconnect the `cell_editable` from signals on the `GtkCellRenderer`, etc.

`gtk_cell_editable_editing_done()` is a convenience method
for emitting `GtkCellEditable::editing-done`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onIconPress`

```ts
(iconPos: Gtk.EntryIconPosition, self: Gtk.Entry) => void
```

Emitted when an activatable icon is clicked.

**Parameters**

- `iconPos`: The position of the clicked icon
- `self`: The instance the signal was emitted on.

### `onIconRelease`

```ts
(iconPos: Gtk.EntryIconPosition, self: Gtk.Entry) => void
```

Emitted on the button release from a mouse click
over an activatable icon.

**Parameters**

- `iconPos`: The position of the clicked icon
- `self`: The instance the signal was emitted on.

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Gtk.Entry) => number
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

### `onRemoveWidget`

```ts
(self: Gtk.Entry) => void
```

From `GtkCellEditable`.

This signal is meant to indicate that the cell is finished
editing, and the `cell_editable` widget is being removed and may
subsequently be destroyed.

Implementations of `GtkCellEditable` are responsible for
emitting this signal when they are done editing. It must
be emitted after the `GtkCellEditable::editing-done` signal,
to give the cell renderer a chance to update the cell's value
before the widget is removed.

`gtk_cell_editable_remove_widget()` is a convenience method
for emitting `GtkCellEditable::remove-widget`.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Entry` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActivatesDefault`

```ts
getActivatesDefault(): boolean
```

Retrieves the value set by `gtk_entry_set_activates_default()`.

**Returns** `true` if the entry will activate the default widget

### `getAlignment`

```ts
getAlignment(): number
```

Gets the value set by `gtk_entry_set_alignment()`.

See also: `Gtk.Editable.xalign`

**Returns** the alignment

### `getAttributes`

```ts
getAttributes(): Pango.AttrList | null
```

Gets the attribute list of the `GtkEntry`.

See `Gtk.Entry.setAttributes()`.

**Returns** the attribute list

### `getBuffer`

```ts
getBuffer(): Gtk.EntryBuffer
```

Get the `GtkEntryBuffer` object which holds the text for
this widget.

**Returns** A `GtkEntryBuffer` object.

### `getCompletion`

```ts
getCompletion(): Gtk.EntryCompletion | null
```

Returns the auxiliary completion object currently
in use by `entry`.

**Returns** The auxiliary
  completion object currently in use by `entry`

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `getCurrentIconDragSource`

```ts
getCurrentIconDragSource(): number
```

Returns the index of the icon which is the source of the
current  DND operation, or -1.

**Returns** index of the icon which is the source of the
  current DND operation, or -1.

### `getExtraMenu`

```ts
getExtraMenu(): Gio.MenuModel | null
```

Gets the menu model set with `gtk_entry_set_extra_menu()`.

**Returns** the menu model

### `getHasFrame`

```ts
getHasFrame(): boolean
```

Gets the value set by `gtk_entry_set_has_frame()`.

**Returns** whether the entry has a beveled frame

### `getIconActivatable`

```ts
getIconActivatable(iconPos: Gtk.EntryIconPosition): boolean
```

Returns whether the icon is activatable.

**Parameters**

- `iconPos`: Icon position

**Returns** `true` if the icon is activatable.

### `getIconArea`

```ts
getIconArea(iconPos: Gtk.EntryIconPosition): Gdk.Rectangle
```

Gets the area where entry’s icon at `icon_pos` is drawn.

This function is useful when drawing something to the
entry in a draw callback.

If the entry is not realized or has no icon at the given
position, `icon_area` is filled with zeros. Otherwise,
`icon_area` will be filled with the icon's allocation,
relative to `entry`'s allocation.

**Parameters**

- `iconPos`: Icon position

**Returns** Return location for the icon’s area

### `getIconAtPos`

```ts
getIconAtPos(x: number, y: number): number
```

Finds the icon at the given position and return its index.

The position’s coordinates are relative to the `entry`’s
top left corner. If `x`, `y` doesn’t lie inside an icon,
-1 is returned. This function is intended for use in a
`Gtk.Widget.query-tooltip` signal handler.

**Parameters**

- `x`: the x coordinate of the position to find, relative to `entry`
- `y`: the y coordinate of the position to find, relative to `entry`

**Returns** the index of the icon at the given position, or -1

### `getIconGicon`

```ts
getIconGicon(iconPos: Gtk.EntryIconPosition): Gio.Icon | null
```

Retrieves the `GIcon` used for the icon.

`null` will be returned if there is no icon or if the icon was
set by some other method (e.g., by `GdkPaintable` or icon name).

**Parameters**

- `iconPos`: Icon position

**Returns** A `GIcon`

### `getIconName`

```ts
getIconName(iconPos: Gtk.EntryIconPosition): string | null
```

Retrieves the icon name used for the icon.

`null` is returned if there is no icon or if the icon was set
by some other method (e.g., by `GdkPaintable` or gicon).

**Parameters**

- `iconPos`: Icon position

**Returns** An icon name

### `getIconPaintable`

```ts
getIconPaintable(iconPos: Gtk.EntryIconPosition): Gdk.Paintable | null
```

Retrieves the `GdkPaintable` used for the icon.

If no `GdkPaintable` was used for the icon, `null` is returned.

**Parameters**

- `iconPos`: Icon position

**Returns** A `GdkPaintable`
  if no icon is set for this position or the icon set is not
  a `GdkPaintable`.

### `getIconSensitive`

```ts
getIconSensitive(iconPos: Gtk.EntryIconPosition): boolean
```

Returns whether the icon appears sensitive or insensitive.

**Parameters**

- `iconPos`: Icon position

**Returns** `true` if the icon is sensitive.

### `getIconStorageType`

```ts
getIconStorageType(iconPos: Gtk.EntryIconPosition): Gtk.ImageType
```

Gets the type of representation being used by the icon
to store image data.

If the icon has no image data, the return value will
be `GTK_IMAGE_EMPTY`.

**Parameters**

- `iconPos`: Icon position

**Returns** image representation being used

### `getIconTooltipMarkup`

```ts
getIconTooltipMarkup(iconPos: Gtk.EntryIconPosition): string | null
```

Gets the contents of the tooltip on the icon at the specified
position in `entry`.

**Parameters**

- `iconPos`: the icon position

**Returns** the tooltip text

### `getIconTooltipText`

```ts
getIconTooltipText(iconPos: Gtk.EntryIconPosition): string | null
```

Gets the contents of the tooltip on the icon at the specified
position in `entry`.

**Parameters**

- `iconPos`: the icon position

**Returns** the tooltip text

### `getInputHints`

```ts
getInputHints(): Gtk.InputHints
```

Gets the input hints of this `GtkEntry`.

**Returns** the input hints

### `getInputPurpose`

```ts
getInputPurpose(): Gtk.InputPurpose
```

Gets the input purpose of the `GtkEntry`.

**Returns** the input purpose

### `getInvisibleChar`

```ts
getInvisibleChar(): string
```

Retrieves the character displayed in place of the actual text
in “password mode”.

**Returns** the current invisible char, or 0, if the entry does not
  show invisible text at all.

### `getMaxLength`

```ts
getMaxLength(): number
```

Retrieves the maximum allowed length of the text in `entry`.

See `Gtk.Entry.setMaxLength()`.

**Returns** the maximum allowed number of characters
  in `GtkEntry`, or 0 if there is no maximum.

### `getMenuEntryIconText`

```ts
getMenuEntryIconText(iconPos: Gtk.EntryIconPosition): string | null
```

Gets the text that will be used in the context menu of the `GtkEntry`
when the specified icon is activatable. Selecting this item in the menu
results, from all aspects, the same than clicking on the specified icon.
This greatly simplifies making accessible applications, because the icons
aren't focusable when using keyboard navigation. This is why Gtk recommends
to add the same action to the context menu.

**Parameters**

- `iconPos`: either `GTK_ENTRY_ICON_PRIMARY` or `GTK_ENTRY_ICON_SECONDARY`

**Returns** the text that will be used in the menu item,
  or NULL if no menu item is desired.

_Available since 4.20._

### `getOverwriteMode`

```ts
getOverwriteMode(): boolean
```

Gets whether the `GtkEntry` is in overwrite mode.

**Returns** whether the text is overwritten when typing.

### `getPlaceholderText`

```ts
getPlaceholderText(): string | null
```

Retrieves the text that will be displayed when `entry`
is empty and unfocused

**Returns** a pointer to the
  placeholder text as a string. This string points to
  internally allocated storage in the widget and must
  not be freed, modified or stored. If no placeholder
  text has been set, `null` will be returned.

### `getProgressFraction`

```ts
getProgressFraction(): number
```

Returns the current fraction of the task that’s been completed.

See `Gtk.Entry.setProgressFraction()`.

**Returns** a fraction from 0.0 to 1.0

### `getProgressPulseStep`

```ts
getProgressPulseStep(): number
```

Retrieves the pulse step set with
`gtk_entry_set_progress_pulse_step()`.

**Returns** a fraction from 0.0 to 1.0

### `getTabs`

```ts
getTabs(): Pango.TabArray | null
```

Gets the tabstops of the `GtkEntry`.

See `Gtk.Entry.setTabs()`.

**Returns** the tabstops

### `getTextLength`

```ts
getTextLength(): number
```

Retrieves the current length of the text in `entry`.

This is equivalent to getting `entry`'s `GtkEntryBuffer`
and calling `Gtk.EntryBuffer.getLength()` on it.

**Returns** the current number of characters
  in `GtkEntry`, or 0 if there are none.

### `getVisibility`

```ts
getVisibility(): boolean
```

Retrieves whether the text in `entry` is visible.

See `Gtk.Entry.setVisibility()`.

**Returns** `true` if the text is currently visible

### `grabFocusWithoutSelecting`

```ts
grabFocusWithoutSelecting(): boolean
```

Causes `entry` to have keyboard focus.

It behaves like `Gtk.Widget.grabFocus()`, except that it doesn't
select the contents of the entry. You only want to call this on some
special entries which the user usually doesn't want to replace all text
in, such as search-as-you-type entries.

**Returns** `true` if focus is now inside `self`

### `progressPulse`

```ts
progressPulse(): void
```

Indicates that some progress is made, but you don’t
know how much.

Causes the entry’s progress indicator to enter “activity
mode”, where a block bounces back and forth. Each call to
`gtk_entry_progress_pulse()` causes the block to move by a
little bit (the amount of movement per pulse is determined
by `Gtk.Entry.setProgressPulseStep()`).

### `resetImContext`

```ts
resetImContext(): void
```

Reset the input method context of the entry if needed.

This can be necessary in the case where modifying the buffer
would confuse on-going input method behavior.

### `setActivatesDefault`

```ts
setActivatesDefault(setting: boolean): void
```

Sets whether pressing Enter in the `entry` will activate the default
widget for the window containing the entry.

This usually means that the dialog containing the entry will be closed,
since the default widget is usually one of the dialog buttons.

**Parameters**

- `setting`: `true` to activate window’s default widget on Enter keypress

### `setAlignment`

```ts
setAlignment(xalign: number): void
```

Sets the alignment for the contents of the entry.

This controls the horizontal positioning of the contents when
the displayed text is shorter than the width of the entry.

See also: `Gtk.Editable.xalign`

**Parameters**

- `xalign`: The horizontal alignment, from 0 (left) to 1 (right). Reversed for RTL layouts

### `setAttributes`

```ts
setAttributes(attrs: Pango.AttrList): void
```

Sets a `PangoAttrList`.

The attributes in the list are applied to the entry text.

Since the attributes will be applied to text that changes
as the user types, it makes most sense to use attributes
with unlimited extent.

**Parameters**

- `attrs`: a `PangoAttrList`

### `setBuffer`

```ts
setBuffer(buffer: Gtk.EntryBuffer): void
```

Set the `GtkEntryBuffer` object which holds the text for
this widget.

**Parameters**

- `buffer`: a `GtkEntryBuffer`

### `setCompletion`

```ts
setCompletion(completion: Gtk.EntryCompletion | null): void
```

Sets `completion` to be the auxiliary completion object
to use with `entry`.

All further configuration of the completion mechanism is
done on `completion` using the `GtkEntryCompletion` API.
Completion is disabled if `completion` is set to `null`.

**Parameters**

- `completion`: The `GtkEntryCompletion`

> **Deprecated since 4.10.** GtkEntryCompletion will be removed in GTK 5.

### `setExtraMenu`

```ts
setExtraMenu(model: Gio.MenuModel | null): void
```

Sets a menu model to add when constructing
the context menu for `entry`.

**Parameters**

- `model`: a `GMenuModel`

### `setHasFrame`

```ts
setHasFrame(setting: boolean): void
```

Sets whether the entry has a beveled frame around it.

**Parameters**

- `setting`: new value

### `setIconActivatable`

```ts
setIconActivatable(iconPos: Gtk.EntryIconPosition, activatable: boolean): void
```

Sets whether the icon is activatable.

**Parameters**

- `iconPos`: Icon position
- `activatable`: `true` if the icon should be activatable

### `setIconDragSource`

```ts
setIconDragSource(iconPos: Gtk.EntryIconPosition, provider: Gdk.ContentProvider, actions: Gdk.DragAction): void
```

Sets up the icon at the given position as drag source.

This makes it so that GTK will start a drag
operation when the user clicks and drags the icon.

**Parameters**

- `iconPos`: icon position
- `provider`: a `GdkContentProvider`
- `actions`: a bitmask of the allowed drag actions

### `setIconFromGicon`

```ts
setIconFromGicon(iconPos: Gtk.EntryIconPosition, icon: Gio.Icon | null): void
```

Sets the icon shown in the entry at the specified position
from the current icon theme.

If the icon isn’t known, a “broken image” icon will be
displayed instead.

If `icon` is `null`, no icon will be shown in the
specified position.

**Parameters**

- `iconPos`: The position at which to set the icon
- `icon`: The icon to set

### `setIconFromIconName`

```ts
setIconFromIconName(iconPos: Gtk.EntryIconPosition, iconName: string | null): void
```

Sets the icon shown in the entry at the specified position
from the current icon theme.

If the icon name isn’t known, a “broken image” icon will be
displayed instead.

If `icon_name` is `null`, no icon will be shown in the
specified position.

**Parameters**

- `iconPos`: The position at which to set the icon
- `iconName`: An icon name

### `setIconFromPaintable`

```ts
setIconFromPaintable(iconPos: Gtk.EntryIconPosition, paintable: Gdk.Paintable | null): void
```

Sets the icon shown in the specified position using a `GdkPaintable`.

If `paintable` is `null`, no icon will be shown in the specified position.

**Parameters**

- `iconPos`: Icon position
- `paintable`: A `GdkPaintable`

### `setIconSensitive`

```ts
setIconSensitive(iconPos: Gtk.EntryIconPosition, sensitive: boolean): void
```

Sets the sensitivity for the specified icon.

**Parameters**

- `iconPos`: Icon position
- `sensitive`: Specifies whether the icon should appear sensitive or insensitive

### `setIconTooltipMarkup`

```ts
setIconTooltipMarkup(iconPos: Gtk.EntryIconPosition, tooltip: string | null): void
```

Sets `tooltip` as the contents of the tooltip for the icon at
the specified position.

`tooltip` is assumed to be marked up with Pango Markup.

Use `null` for `tooltip` to remove an existing tooltip.

See also `Gtk.Widget.setTooltipMarkup()` and
`Gtk.Entry.setIconTooltipText()`.

**Parameters**

- `iconPos`: the icon position
- `tooltip`: the contents of the tooltip for the icon

### `setIconTooltipText`

```ts
setIconTooltipText(iconPos: Gtk.EntryIconPosition, tooltip: string | null): void
```

Sets `tooltip` as the contents of the tooltip for the icon
at the specified position.

Use `null` for `tooltip` to remove an existing tooltip.

See also `Gtk.Widget.setTooltipText()` and
`Gtk.Entry.setIconTooltipMarkup()`.

If you unset the widget tooltip via
`Gtk.Widget.setTooltipText()` or
`Gtk.Widget.setTooltipMarkup()`, this sets
`Gtk.Widget.hasTooltip` to `false`, which suppresses
icon tooltips too. You can resolve this by then calling
`Gtk.Widget.setHasTooltip()` to set
`Gtk.Widget.hasTooltip` back to `true`, or
setting at least one non-empty tooltip on any icon
achieves the same result.

**Parameters**

- `iconPos`: the icon position
- `tooltip`: the contents of the tooltip for the icon

### `setInputHints`

```ts
setInputHints(hints: Gtk.InputHints): void
```

Set additional hints which allow input methods to
fine-tune their behavior.

**Parameters**

- `hints`: the hints

### `setInputPurpose`

```ts
setInputPurpose(purpose: Gtk.InputPurpose): void
```

Sets the input purpose which can be used by input methods
to adjust their behavior.

**Parameters**

- `purpose`: the purpose

### `setInvisibleChar`

```ts
setInvisibleChar(ch: string): void
```

Sets the character to use in place of the actual text
in “password mode”.

See `Gtk.Entry.setVisibility()` for how to enable
“password mode”.

By default, GTK picks the best invisible char available in
the current font. If you set the invisible char to 0, then
the user will get no feedback at all; there will be no text
on the screen as they type.

**Parameters**

- `ch`: a Unicode character

### `setMaxLength`

```ts
setMaxLength(max: number): void
```

Sets the maximum allowed length of the contents of the widget.

If the current contents are longer than the given length, then
they will be truncated to fit. The length is in characters.

This is equivalent to getting `entry`'s `GtkEntryBuffer` and
calling `Gtk.EntryBuffer.setMaxLength()` on it.

**Parameters**

- `max`: the maximum length of the entry, or 0 for no maximum. (other than the maximum length of entries.) The value passed in will be clamped to the range 0-65536.

### `setMenuEntryIconText`

```ts
setMenuEntryIconText(iconPos: Gtk.EntryIconPosition, text: string): void
```

Sets the text that will be used in the context menu of the `GtkEntry`
when the specified icon is activatable. Selecting this item in the menu
results, from all aspects, the same than clicking on the specified icon.
This greatly simplifies making accessible applications, because the icons
aren't focusable when using keyboard navigation. This is why Gtk recommends
to add the same action to the context menu.

**Parameters**

- `iconPos`: either `GTK_ENTRY_ICON_PRIMARY` or `GTK_ENTRY_ICON_SECONDARY`
- `text`: the text used for the menu item in the context menu, or NULL to not add a menu item.

_Available since 4.20._

### `setOverwriteMode`

```ts
setOverwriteMode(overwrite: boolean): void
```

Sets whether the text is overwritten when typing in the `GtkEntry`.

**Parameters**

- `overwrite`: new value

### `setPlaceholderText`

```ts
setPlaceholderText(text: string | null): void
```

Sets text to be displayed in `entry` when it is empty.

This can be used to give a visual hint of the expected
contents of the `GtkEntry`.

**Parameters**

- `text`: a string to be displayed when `entry` is empty and unfocused

### `setProgressFraction`

```ts
setProgressFraction(fraction: number): void
```

Causes the entry’s progress indicator to “fill in” the given
fraction of the bar.

The fraction should be between 0.0 and 1.0, inclusive.

**Parameters**

- `fraction`: fraction of the task that’s been completed

### `setProgressPulseStep`

```ts
setProgressPulseStep(fraction: number): void
```

Sets the fraction of total entry width to move the progress
bouncing block for each pulse.

Use `Gtk.Entry.progressPulse()` to pulse
the progress.

**Parameters**

- `fraction`: fraction between 0.0 and 1.0

### `setTabs`

```ts
setTabs(tabs: Pango.TabArray | null): void
```

Sets a `PangoTabArray`.

The tabstops in the array are applied to the entry text.

**Parameters**

- `tabs`: a `PangoTabArray`

### `setVisibility`

```ts
setVisibility(visible: boolean): void
```

Sets whether the contents of the entry are visible or not.

When visibility is set to `false`, characters are displayed
as the invisible char, and will also appear that way when
the text in the entry widget is copied elsewhere.

By default, GTK picks the best invisible character available
in the current font, but it can be changed with
`Gtk.Entry.setInvisibleChar()`.

Note that you probably want to set `Gtk.Entry.inputPurpose`
to `GTK_INPUT_PURPOSE_PASSWORD` or `GTK_INPUT_PURPOSE_PIN` to
inform input methods about the purpose of this entry,
in addition to setting visibility to `false`.

**Parameters**

- `visible`: `true` if the contents of the entry are displayed as plaintext

### `unsetInvisibleChar`

```ts
unsetInvisibleChar(): void
```

Unsets the invisible char, so that the default invisible char
is used again. See `Gtk.Entry.setInvisibleChar()`.
