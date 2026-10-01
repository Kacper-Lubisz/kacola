---
description: "The interface for GTK input methods."
---

# GtkIMContext

The interface for GTK input methods.

`GtkIMContext` is used by GTK text input widgets like `GtkText`
to map from key events to Unicode character strings.

An input method may consume multiple key events in sequence before finally
outputting the composed result. This is called *preediting*, and an input
method may provide feedback about this process by displaying the intermediate
composition states as preedit text. To do so, the `GtkIMContext` will emit
`Gtk.IMContext.preedit-start`, `Gtk.IMContext.preedit-changed`
and `Gtk.IMContext.preedit-end` signals.

For instance, the built-in GTK input method `Gtk.IMContextSimple`
implements the input of arbitrary Unicode code points by holding down the
<kbd>Control</kbd> and <kbd>Shift</kbd> keys and then typing <kbd>u</kbd>
followed by the hexadecimal digits of the code point. When releasing the
<kbd>Control</kbd> and <kbd>Shift</kbd> keys, preediting ends and the
character is inserted as text. For example,

    Ctrl+Shift+u 2 0 A C

results in the € sign.

Additional input methods can be made available for use by GTK widgets as
loadable modules. An input method module is a small shared library which
provides a `GIOExtension` for the extension point named "gtk-im-module".

To connect a widget to the users preferred input method, you should use
`Gtk.IMMulticontext`.

```tsx
import { GtkIMContext } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkIMContext**

## Props

`ref` receives the `Gtk.IMContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `inputHints`

`Gtk.InputHints` · default `GTK_INPUT_HINT_NONE`

Additional hints that allow input methods to fine-tune
their behaviour.

### `inputPurpose`

`Gtk.InputPurpose` · default `GTK_INPUT_PURPOSE_FREE_FORM`

The purpose of the text field that the `GtkIMContext is connected to.

This property can be used by on-screen keyboards and other input
methods to adjust their behaviour.

## Signals

### `onCommit`

```ts
(str: string, self: Gtk.IMContext) => void
```

The ::commit signal is emitted when a complete input sequence
has been entered by the user.

If the commit comes after a preediting sequence, the
::commit signal is emitted after ::preedit-end.

This can be a single character immediately after a key press or
the final result of preediting.

**Parameters**

- `str`: the completed character(s) entered by the user
- `self`: The instance the signal was emitted on.

### `onDeleteSurrounding`

```ts
(offset: number, nChars: number, self: Gtk.IMContext) => boolean | undefined
```

The ::delete-surrounding signal is emitted when the input method
needs to delete all or part of the context surrounding the cursor.

**Parameters**

- `offset`: the character offset from the cursor position of the text to be deleted. A negative value indicates a position before the cursor.
- `nChars`: the number of characters to be deleted
- `self`: The instance the signal was emitted on.

**Returns** `true` if the signal was handled.

### `onInvalidComposition`

```ts
(str: string, self: Gtk.IMContext) => boolean | undefined
```

Emitted when the filtered keys do not compose to a single valid character.

**Parameters**

- `str`: the completed character(s) entered by the user
- `self`: The instance the signal was emitted on.

**Returns** true if the IM context avoid beeping on invalid composition

_Available since 4.22._

### `onPreeditChanged`

```ts
(self: Gtk.IMContext) => void
```

The ::preedit-changed signal is emitted whenever the preedit sequence
currently being entered has changed.

It is also emitted at the end of a preedit sequence, in which case
`Gtk.IMContext.getPreeditString()` returns the empty string.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPreeditEnd`

```ts
(self: Gtk.IMContext) => void
```

The ::preedit-end signal is emitted when a preediting sequence
has been completed or canceled.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPreeditStart`

```ts
(self: Gtk.IMContext) => void
```

The ::preedit-start signal is emitted when a new preediting sequence
starts.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onRetrieveSurrounding`

```ts
(self: Gtk.IMContext) => boolean | undefined
```

The ::retrieve-surrounding signal is emitted when the input method
requires the context surrounding the cursor.

The callback should set the input method surrounding context by
calling the `Gtk.IMContext.setSurrounding()` method.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** `true` if the signal was handled.

## Methods

Methods are called on the `Gtk.IMContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `activateOsk`

```ts
activateOsk(event: Gdk.Event | null): boolean
```

Requests the platform to show an on-screen keyboard for user input.

This method will return `true` if this request was actually performed
to the platform, other environmental factors may result in an on-screen
keyboard effectively not showing up.

**Parameters**

- `event`: a `Gdk.Event`

**Returns** `true` if an on-screen keyboard could be requested to the platform.

_Available since 4.14._

### `deleteSurrounding`

```ts
deleteSurrounding(offset: number, nChars: number): boolean
```

Asks the widget that the input context is attached to delete
characters around the cursor position by emitting the
`::delete_surrounding` signal.

Note that `offset` and `n_chars` are in characters not in bytes
which differs from the usage other places in `GtkIMContext`.

In order to use this function, you should first call
`Gtk.IMContext.getSurrounding()` to get the current context,
and call this function immediately afterwards to make sure that you
know what you are deleting. You should also account for the fact
that even if the signal was handled, the input context might not
have deleted all the characters that were requested to be deleted.

This function is used by an input method that wants to make
substitutions in the existing text in response to new input.
It is not useful for applications.

**Parameters**

- `offset`: offset from cursor position in chars; a negative value means start before the cursor.
- `nChars`: number of characters to delete.

**Returns** `true` if the signal was handled.

### `filterKey`

```ts
filterKey(press: boolean, surface: Gdk.Surface, device: Gdk.Device, time: number, keycode: number, state: Gdk.ModifierType, group: number): boolean
```

Allow an input method to forward key press and release events
to another input method without necessarily having a `GdkEvent`
available.

**Parameters**

- `press`: whether to forward a key press or release event
- `surface`: the surface the event is for
- `device`: the device that the event is for
- `time`: the timestamp for the event
- `keycode`: the keycode for the event
- `state`: modifier state for the event
- `group`: the active keyboard group for the event

**Returns** `true` if the input method handled the key event.

### `filterKeypress`

```ts
filterKeypress(event: Gdk.Event): boolean
```

Allow an input method to internally handle key press and release
events.

If this function returns `true`, then no further processing
should be done for this key event.

**Parameters**

- `event`: the key event

**Returns** `true` if the input method handled the key event.

### `focusIn`

```ts
focusIn(): void
```

Notify the input method that the widget to which this
input context corresponds has gained focus.

The input method may, for example, change the displayed
feedback to reflect this change.

### `focusOut`

```ts
focusOut(): void
```

Notify the input method that the widget to which this
input context corresponds has lost focus.

The input method may, for example, change the displayed
feedback or reset the contexts state to reflect this change.

### `getPreeditString`

```ts
getPreeditString(): [string, Pango.AttrList, number]
```

Retrieve the current preedit string for the input context,
and a list of attributes to apply to the string.

This string should be displayed inserted at the insertion point.

**Returns** Tuple of:

- `str`: location to store the retrieved string. The string retrieved must be freed with `g_free()`.
- `attrs`: location to store the retrieved attribute list. When you are done with this list, you must unreference it with `Pango.AttrList.unref()`.
- `cursorPos`: location to store position of cursor (in characters) within the preedit string.

### `getSurrounding`

```ts
getSurrounding(): [boolean, string, number]
```

Retrieves context around the insertion point.

Input methods typically want context in order to constrain input text
based on existing text; this is important for languages such as Thai
where only some sequences of characters are allowed.

This function is implemented by emitting the
`Gtk.IMContext.retrieve-surrounding` signal on the input method;
in response to this signal, a widget should provide as much context as
is available, up to an entire paragraph, by calling
`Gtk.IMContext.setSurrounding()`.

Note that there is no obligation for a widget to respond to the
`::retrieve-surrounding` signal, so input methods must be prepared to
function without context.

**Returns** Tuple of:

- `result`: `TRUE` if surrounding text was provided; in this case you must free the result stored in `text`.
- `text`: location to store a UTF-8 encoded string of text holding context around the insertion point. If the function returns `true`, then you must free the result stored in this location with `g_free()`.
- `cursorIndex`: location to store byte index of the insertion cursor within `text`.

> **Deprecated since 4.2.** Use `Gtk.IMContext.getSurroundingWithSelection()` instead.

### `getSurroundingWithSelection`

```ts
getSurroundingWithSelection(): [boolean, string, number, number]
```

Retrieves context around the insertion point.

Input methods typically want context in order to constrain input
text based on existing text; this is important for languages such
as Thai where only some sequences of characters are allowed.

This function is implemented by emitting the
`Gtk.IMContext.retrieve-surrounding` signal on the input method;
in response to this signal, a widget should provide as much context as
is available, up to an entire paragraph, by calling
`Gtk.IMContext.setSurroundingWithSelection()`.

Note that there is no obligation for a widget to respond to the
`::retrieve-surrounding` signal, so input methods must be prepared to
function without context.

**Returns** Tuple of:

- `result`: `TRUE` if surrounding text was provided; in this case you must free the result stored in `text`.
- `text`: location to store a UTF-8 encoded string of text holding context around the insertion point. If the function returns `true`, then you must free the result stored in this location with `g_free()`.
- `cursorIndex`: location to store byte index of the insertion cursor within `text`.
- `anchorIndex`: location to store byte index of the selection bound within `text`

_Available since 4.2._

### `reset`

```ts
reset(): void
```

Notify the input method that a change such as a change in cursor
position has been made.

This will typically cause the input method to clear the preedit state.

### `setClientWidget`

```ts
setClientWidget(widget: Gtk.Widget | null): void
```

Set the client widget for the input context.

This is the `GtkWidget` holding the input focus. This widget is
used in order to correctly position status windows, and may
also be used for purposes internal to the input method.

**Parameters**

- `widget`: the client widget. This may be `null` to indicate that the previous client widget no longer exists.

### `setCursorLocation`

```ts
setCursorLocation(area: Gdk.Rectangle): void
```

Notify the input method that a change in cursor
position has been made.

The location is relative to the client widget.

**Parameters**

- `area`: new location

### `setSurrounding`

```ts
setSurrounding(text: string, len: number, cursorIndex: number): void
```

Sets surrounding context around the insertion point and preedit
string.

This function is expected to be called in response to the
`Gtk.IMContext.retrieve-surrounding` signal, and will
likely have no effect if called at other times.

**Parameters**

- `text`: text surrounding the insertion point, as UTF-8. the preedit string should not be included within `text`
- `len`: the length of `text`, or -1 if `text` is nul-terminated
- `cursorIndex`: the byte index of the insertion cursor within `text`.

> **Deprecated since 4.2.** Use `Gtk.IMContext.setSurroundingWithSelection()` instead

### `setSurroundingWithSelection`

```ts
setSurroundingWithSelection(text: string, len: number, cursorIndex: number, anchorIndex: number): void
```

Sets surrounding context around the insertion point and preedit
string. This function is expected to be called in response to the
`Gtk.IMContext.retrieve_surrounding` signal, and will likely
have no effect if called at other times.

**Parameters**

- `text`: text surrounding the insertion point, as UTF-8. the preedit string should not be included within `text`
- `len`: the length of `text`, or -1 if `text` is nul-terminated
- `cursorIndex`: the byte index of the insertion cursor within `text`
- `anchorIndex`: the byte index of the selection bound within `text`

_Available since 4.2._

### `setUsePreedit`

```ts
setUsePreedit(usePreedit: boolean): void
```

Sets whether the IM context should use the preedit string
to display feedback.

If `use_preedit` is `false` (default is `true`), then the IM context
may use some other method to display feedback, such as displaying
it in a child of the root window.

**Parameters**

- `usePreedit`: whether the IM context should use the preedit string.
