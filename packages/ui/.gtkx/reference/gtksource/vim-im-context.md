---
description: "Vim emulation."
---

# GtkSourceVimIMContext

Vim emulation.

The `GtkSourceVimIMContext` is a `Gtk.IMContext` implementation that can
be used to provide Vim-like editing controls within a `View`.

The `GtkSourceViMIMContext` will process incoming `Gdk.KeyEvent` as the
user types. It should be used in conjunction with a `Gtk.EventControllerKey`.

Various features supported by `GtkSourceVimIMContext` include:

 - Normal, Insert, Replace, Visual, and Visual Line modes
 - Support for an integrated command bar and current command preview
 - Search and replace
 - Motions and Text Objects
 - History replay
 - Jumplists within the current file
 - Registers including the system and primary clipboards
 - Creation and motion to marks
 - Some commonly used Vim commands

It is recommended that applications display the contents of
`VimIMContext.commandBarText` and
`VimIMContext.commandText` to the user as they represent the
command-bar and current command preview found in Vim.

`GtkSourceVimIMContext` attempts to work with additional `Gtk.IMContext`
implementations such as IBus by querying the `Gtk.TextView` before processing
the command in states which support it (notably Insert and Replace modes).

```c
GtkEventController *key;
GtkIMContext *im_context;
GtkWidget *view;

view = gtk_source_view_new ();
im_context = gtk_source_vim_im_context_new ();
key = gtk_event_controller_key_new ();

gtk_event_controller_key_set_im_context (GTK_EVENT_CONTROLLER_KEY (key), im_context);
gtk_event_controller_set_propagation_phase (key, GTK_PHASE_CAPTURE);
gtk_widget_add_controller (view, key);
gtk_im_context_set_client_widget (im_context, view);

g_object_bind_property (im_context, "command-bar-text", command_bar_label, "label", 0);
g_object_bind_property (im_context, "command-text", command_label, "label", 0);
```
```python
key = Gtk.EventControllerKey.new()
im_context = GtkSource.VimIMContext.new()
buffer = GtkSource.Buffer()
view = GtkSource.View.new_with_buffer(buffer)

key.set_im_context(im_context)
key.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
view.add_controller(key)
im_context.set_client_widget(view)

im_context.bind_property(
    source_property="command-text",
    target=command_label,
    target_property="label",
    flags=GObject.BindingFlags.DEFAULT,
)

im_context.bind_property(
    source_property="command-bar-text",
    target=command_bar_label,
    target_property="label",
    flags=GObject.BindingFlags.DEFAULT,
)
```

_Available since 5.4._

```tsx
import { GtkSourceVimIMContext } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkIMContext](.gtkx/reference/gtk/im-context.md) → **GtkSourceVimIMContext**

## Props

`ref` receives the `GtkSource.VimIMContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `commandBarText`

`string` · default `null` · read-only, observe with `onNotifyCommandBarText`

### `commandText`

`string` · default `null` · read-only, observe with `onNotifyCommandText`

## Signals

### `onEdit`

```ts
(view: GtkSource.View, path: string | null, self: GtkSource.VimIMContext) => void
```

Requests the application open the file found at `path`.

If `path` is `null`, then the current file should be reloaded from storage.

This may be executed in relation to the user running the
`:edit` or `:e` commands.

**Parameters**

- `view`: the `GtkSourceView`
- `path`: the path if provided, otherwise `null`
- `self`: The instance the signal was emitted on.

_Available since 5.4._

### `onExecuteCommand`

```ts
(command: string, self: GtkSource.VimIMContext) => boolean | undefined
```

The signal is emitted when a command should be
executed. This might be something like `:wq` or `:e <path>`.

If the application chooses to implement this, it should return
`true` from this signal to indicate the command has been handled.

**Parameters**

- `command`: the command to execute
- `self`: The instance the signal was emitted on.

**Returns** `true` if handled; otherwise `false`.

_Available since 5.4._

### `onFormatText`

```ts
(begin: Gtk.TextIter, end: Gtk.TextIter, self: GtkSource.VimIMContext) => void
```

Requests that the application format the text between
`begin` and `end`.

**Parameters**

- `begin`: the start location
- `end`: the end location
- `self`: The instance the signal was emitted on.

_Available since 5.4._

### `onWrite`

```ts
(view: GtkSource.View, path: string | null, self: GtkSource.VimIMContext) => void
```

Requests the application save the file.

If a filename was provided, it will be available to the signal handler as `path`.
This may be executed in relation to the user running the `:write` or `:w` commands.

**Parameters**

- `view`: the `GtkSourceView`
- `path`: the path if provided, otherwise `null`
- `self`: The instance the signal was emitted on.

_Available since 5.4._

## Methods

Methods are called on the `GtkSource.VimIMContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `executeCommand`

```ts
executeCommand(command: string): void
```

Executes `command` as if it was typed into the command bar by the
user except that this does not emit the
`VimIMContext.execute-command` signal.

**Parameters**

- `command`: the command text

_Available since 5.4._

### `getCommandBarText`

```ts
getCommandBarText(): string
```

Gets the current command-bar text as it is entered by the user.

**Returns** A string containing the command-bar text

_Available since 5.4._

### `getCommandText`

```ts
getCommandText(): string
```

Gets the current command text as it is entered by the user.

**Returns** A string containing the command text

_Available since 5.4._
