---
description: "Asynchronous API to present a file chooser dialog."
---

# GtkFileDialog

Asynchronous API to present a file chooser dialog.

`GtkFileDialog` collects the arguments that are needed to present
the dialog to the user, such as a title for the dialog and whether
it should be modal.

The dialog is shown with `Gtk.FileDialog.open()`,
`Gtk.FileDialog.save()`, etc.

_Available since 4.10._

```tsx
import { GtkFileDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkFileDialog**

## Props

`ref` receives the `Gtk.FileDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `acceptLabel`

`string` · default `null`

Label for the file chooser's accept button.

_Available since 4.10._

### `defaultFilter`

`Gtk.FileFilter | ReactElement`

The default filter.

This filter is initially active in the file chooser dialog.

If the default filter is `NULL`, the first filter of `Gtk.FileDialog.filters`
is used as the default filter. If that property contains no filter, the dialog will
be unfiltered.

If `Gtk.FileDialog.filters` is not `NULL`, the default filter should be
part of the list. If it is not, the dialog may choose to not make it available.

_Available since 4.10._

### `filters`

`Gio.ListModel | ReactElement`

The list of filters.

See `Gtk.FileDialog.defaultFilter` about how these
two properties interact.

_Available since 4.10._

### `initialFile`

`Gio.File | ReactElement`

The initial file.

This file is initially selected in the file chooser dialog

This is a utility property that sets both `Gtk.FileDialog.initialFolder`
and `Gtk.FileDialog.initialName`.

_Available since 4.10._

### `initialFolder`

`Gio.File | ReactElement`

The initial folder.

This is the directory that is initially opened in the file chooser dialog.

_Available since 4.10._

### `initialName`

`string` · default `null`

The initial name.

This is the name of the file that is initially selected in the file chooser dialog.

_Available since 4.10._

### `modal`

`boolean` · default `true`

Whether the file chooser dialog is modal.

_Available since 4.10._

### `title`

`string` · default `null`

A title that may be shown on the file chooser dialog.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.FileDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAcceptLabel`

```ts
getAcceptLabel(): string | null
```

Retrieves the text used by the dialog on its accept button.

**Returns** the label shown on the file chooser's accept button

_Available since 4.10._

### `getDefaultFilter`

```ts
getDefaultFilter(): Gtk.FileFilter | null
```

Gets the filter that will be selected by default
in the file chooser dialog.

**Returns** the default filter

_Available since 4.10._

### `getFilters`

```ts
getFilters(): Gio.ListModel | null
```

Gets the filters that will be offered to the user
in the file chooser dialog.

**Returns** the filters,
  as a list model of `Gtk.FileFilter`

_Available since 4.10._

### `getInitialFile`

```ts
getInitialFile(): Gio.File | null
```

Gets the file that will be initially selected in
the file chooser dialog.

**Returns** the file

_Available since 4.10._

### `getInitialFolder`

```ts
getInitialFolder(): Gio.File | null
```

Gets the folder that will be set as the
initial folder in the file chooser dialog.

**Returns** the folder

_Available since 4.10._

### `getInitialName`

```ts
getInitialName(): string | null
```

Gets the filename that will be initially selected.

**Returns** the name

_Available since 4.10._

### `getModal`

```ts
getModal(): boolean
```

Returns whether the file chooser dialog blocks interaction
with the parent window while it is presented.

**Returns** true if the file chooser dialog is modal

_Available since 4.10._

### `getTitle`

```ts
getTitle(): string
```

Returns the title that will be shown on the file chooser dialog.

**Returns** the title

_Available since 4.10._

### `open`

```ts
open(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>
```

Presents a file chooser dialog to the user.

The file chooser dialog will be set up to select a single file.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** the file that was selected

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `openFinish`

```ts
openFinish(result: Gio.AsyncResult): Gio.File
```

Finishes the `Gtk.FileDialog.open()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the file that was selected

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `openMultiple`

```ts
openMultiple(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.ListModel>
```

Presents a file chooser dialog to the user.

The file chooser dialog will be set up to select multiple files.

The file chooser dialog will initially be opened in the directory
`Gtk.FileDialog.initialFolder`.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** the files that were selected,
  as a list model of `Gio.File`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `openMultipleFinish`

```ts
openMultipleFinish(result: Gio.AsyncResult): Gio.ListModel
```

Finishes the `Gtk.FileDialog.open()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the files that were selected,
  as a list model of `Gio.File`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `openMultipleTextFiles`

```ts
openMultipleTextFiles(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<[Gio.ListModel, string]>
```

Presents a file chooser dialog to the user.

The file chooser dialog will be set up to select multiple files.

The file chooser dialog will initially be opened in the directory
`Gtk.FileDialog.initialFolder`.

In contrast to `Gtk.FileDialog.open()`, this function
lets the user select the text encoding for the files, if possible.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** Tuple of:

- `result`: the files that were selected, as a list model of `Gio.File`
- `encoding`: return location for the text encoding to use

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.18._

### `openMultipleTextFilesFinish`

```ts
openMultipleTextFilesFinish(result: Gio.AsyncResult): [Gio.ListModel, string]
```

Finishes the `Gtk.FileDialog.open()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** Tuple of:

- `result`: the files that were selected, as a list model of `Gio.File`
- `encoding`: return location for the text encoding to use

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.18._

### `openTextFile`

```ts
openTextFile(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<[Gio.File, string]>
```

Initiates a file selection operation by presenting a file chooser
dialog to the user.

In contrast to `Gtk.FileDialog.open()`, this function
lets the user select the text encoding for the file, if possible.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent `GtkWindow`
- `cancellable`: a `GCancellable` to cancel the operation

**Returns** Tuple of:

- `result`: the file that was selected
- `encoding`: return location for the text encoding to use

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.18._

### `openTextFileFinish`

```ts
openTextFileFinish(result: Gio.AsyncResult): [Gio.File, string]
```

Finishes the `Gtk.FileDialog.openTextFile()` call
and returns the resulting file and text encoding.

If the user has explicitly selected a text encoding to use
for the file, then `encoding` will be set to a codeset name that
is suitable for passing to `iconv_open()`. Otherwise, it will
be `NULL`.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: the file that was selected
- `encoding`: return location for the text encoding to use

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.18._

### `save`

```ts
save(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>
```

Presents a file chooser dialog to the user.

The file chooser dialog will be save mode.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** the file that was selected

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `saveFinish`

```ts
saveFinish(result: Gio.AsyncResult): Gio.File
```

Finishes the `Gtk.FileDialog.save()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the file that was selected

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `saveTextFile`

```ts
saveTextFile(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<[Gio.File, string, string]>
```

Initiates a file save operation by presenting a file chooser
dialog to the user.

In contrast to `Gtk.FileDialog.save()`, this function
lets the user select the text encoding and line endings for
the text file, if possible.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent `GtkWindow`
- `cancellable`: a `GCancellable` to cancel the operation

**Returns** Tuple of:

- `result`: the file that was selected.
- `encoding`: return location for the text encoding to use
- `lineEnding`: return location for the line endings to use

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.18._

### `saveTextFileFinish`

```ts
saveTextFileFinish(result: Gio.AsyncResult): [Gio.File, string, string]
```

Finishes the `Gtk.FileDialog.saveTextFile()` call
and returns the resulting file, text encoding and line endings.

If the user has explicitly selected a text encoding to use
for the file, then `encoding` will be set to a codeset name that
is suitable for passing to `iconv_open()`. Otherwise, it will
be `NULL`.

The `line_ending` will be set to one of "\n", "\r\n", "\r" or "",
where the latter means to preserve existing line endings.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: the file that was selected.
- `encoding`: return location for the text encoding to use
- `lineEnding`: return location for the line endings to use

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.18._

### `selectFolder`

```ts
selectFolder(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>
```

Presents a file chooser dialog to the user.

The file chooser dialog will be set up to select a single folder.

If you pass `initial_folder`, the file chooser dialog will initially
be opened in the parent directory of that folder, otherwise, it
will be in the directory `Gtk.FileDialog.initialFolder`.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** the folder that was selected

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `selectFolderFinish`

```ts
selectFolderFinish(result: Gio.AsyncResult): Gio.File
```

Finishes the `Gtk.FileDialog.selectFolder()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the folder that was selected

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `selectMultipleFolders`

```ts
selectMultipleFolders(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.ListModel>
```

Presents a file chooser dialog to the user.

The file chooser dialog will be set up to allow selecting
multiple folders.

The file chooser dialog will initially be opened in the
directory `Gtk.FileDialog.initialFolder`.

The `callback` will be called when the dialog is closed.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** the folders that were selected,
  as a list model of `Gio.File`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `selectMultipleFoldersFinish`

```ts
selectMultipleFoldersFinish(result: Gio.AsyncResult): Gio.ListModel
```

Finishes the `Gtk.FileDialog.selectMultipleFolders()` call.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the folders that were selected,
  as a list model of `Gio.File`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `setAcceptLabel`

```ts
setAcceptLabel(acceptLabel: string | null): void
```

Sets the label shown on the file chooser's accept button.

Leaving the accept label unset or setting it as `NULL` will
fall back to a default label, depending on what API is used
to launch the file dialog.

**Parameters**

- `acceptLabel`: the new accept label

_Available since 4.10._

### `setDefaultFilter`

```ts
setDefaultFilter(filter: Gtk.FileFilter | null): void
```

Sets the filter that will be selected by default
in the file chooser dialog.

If set to `NULL`, the first item in `Gtk.FileDialog.filters`
will be used as the default filter. If that list is empty, the dialog
will be unfiltered.

**Parameters**

- `filter`: the file filter

_Available since 4.10._

### `setFilters`

```ts
setFilters(filters: Gio.ListModel | null): void
```

Sets the filters that will be offered to the user
in the file chooser dialog.

**Parameters**

- `filters`: a list model of `Gtk.FileFilter`

_Available since 4.10._

### `setInitialFile`

```ts
setInitialFile(file: Gio.File | null): void
```

Sets the file that will be initially selected in
the file chooser dialog.

This function is a shortcut for calling both
`Gtk.FileDialog.setInitialFolder()` and
`Gtk.FileDialog.setInitialName()` with the
directory and name of `file`, respectively.

**Parameters**

- `file`: a file

_Available since 4.10._

### `setInitialFolder`

```ts
setInitialFolder(folder: Gio.File | null): void
```

Sets the folder that will be set as the
initial folder in the file chooser dialog.

**Parameters**

- `folder`: a file

_Available since 4.10._

### `setInitialName`

```ts
setInitialName(name: string | null): void
```

Sets the filename that will be initially selected.

For save dialogs, `name` will usually be pre-entered into the
name field.

If a file with this name already exists in the directory set
via `Gtk.FileDialog.initialFolder`, the dialog will
preselect it.

**Parameters**

- `name`: a string

_Available since 4.10._

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the file chooser dialog blocks interaction
with the parent window while it is presented.

**Parameters**

- `modal`: the new value

_Available since 4.10._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title that will be shown on the file chooser dialog.

**Parameters**

- `title`: the new title

_Available since 4.10._
