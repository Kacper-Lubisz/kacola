---
description: "High-level, portable printing API."
---

# GtkPrintOperation

High-level, portable printing API.

It looks a bit different than other GTK dialogs such as the
`GtkFileChooser`, since some platforms don’t expose enough
infrastructure to implement a good print dialog. On such
platforms, `GtkPrintOperation` uses the native print dialog.
On platforms which do not provide a native print dialog, GTK
uses its own, see `Gtk.PrintUnixDialog`.

The typical way to use the high-level printing API is to create
a `GtkPrintOperation` object with `Gtk.PrintOperation.new()`
when the user selects to print. Then you set some properties on it,
e.g. the page size, any `Gtk.PrintSettings` from previous print
operations, the number of pages, the current page, etc.

Then you start the print operation by calling `Gtk.PrintOperation.run()`.
It will then show a dialog, let the user select a printer and options.
When the user finished the dialog, various signals will be emitted on
the `GtkPrintOperation`, the main one being
`Gtk.PrintOperation.draw-page`, which you are supposed to handle
and render the page on the provided `Gtk.PrintContext` using Cairo.

## The high-level printing API

```c
static GtkPrintSettings *settings = NULL;

static void
do_print (void)
{
  GtkPrintOperation *print;
  GtkPrintOperationResult res;

  print = gtk_print_operation_new ();

  if (settings != NULL)
    gtk_print_operation_set_print_settings (print, settings);

  g_signal_connect (print, "begin_print", G_CALLBACK (begin_print), NULL);
  g_signal_connect (print, "draw_page", G_CALLBACK (draw_page), NULL);

  res = gtk_print_operation_run (print, GTK_PRINT_OPERATION_ACTION_PRINT_DIALOG,
                                 GTK_WINDOW (main_window), NULL);

  if (res == GTK_PRINT_OPERATION_RESULT_APPLY)
    {
      if (settings != NULL)
        g_object_unref (settings);
      settings = g_object_ref (gtk_print_operation_get_print_settings (print));
    }

  g_object_unref (print);
}
```

By default `GtkPrintOperation` uses an external application to do
print preview. To implement a custom print preview, an application
must connect to the preview signal. The functions
`Gtk.PrintOperationPreview.renderPage()`,
`Gtk.PrintOperationPreview.endPreview()` and
`Gtk.PrintOperationPreview.isSelected()`
are useful when implementing a print preview.

```tsx
import { GtkPrintOperation } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPrintOperation**

Implements `GtkPrintOperationPreview`.

## Props

`ref` receives the `Gtk.PrintOperation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowAsync`

`boolean` · default `false`

Determines whether the print operation may run asynchronously or not.

Some systems don't support asynchronous printing, but those that do
will return `GTK_PRINT_OPERATION_RESULT_IN_PROGRESS` as the status, and
emit the `Gtk.PrintOperation.done` signal when the operation
is actually done.

The Windows port does not support asynchronous operation at all (this
is unlikely to change). On other platforms, all actions except for
`GTK_PRINT_OPERATION_ACTION_EXPORT` support asynchronous operation.

### `currentPage`

`number` · default `-1`

The current page in the document.

If this is set before `Gtk.PrintOperation.run()`,
the user will be able to select to print only the current page.

Note that this only makes sense for pre-paginated documents.

### `customTabLabel`

`string` · default `null`

Used as the label of the tab containing custom widgets.

Note that this property may be ignored on some platforms.

If this is `null`, GTK uses a default label.

### `defaultPageSetup`

`Gtk.PageSetup | ReactElement`

The `GtkPageSetup` used by default.

This page setup will be used by `Gtk.PrintOperation.run()`,
but it can be overridden on a per-page basis by connecting
to the `Gtk.PrintOperation.request-page-setup` signal.

### `embedPageSetup`

`boolean` · default `false`

If `true`, page size combo box and orientation combo box
are embedded into page setup page.

### `exportFilename`

`string` · default `null`

The name of a file to generate instead of showing the print dialog.

Currently, PDF is the only supported format.

The intended use of this property is for implementing
“Export to PDF” actions.

“Print to PDF” support is independent of this and is done
by letting the user pick the “Print to PDF” item from the
list of printers in the print dialog.

### `hasSelection`

`boolean` · default `false`

Determines whether there is a selection in your application.

This can allow your application to print the selection.
This is typically used to make a "Selection" button sensitive.

### `jobName`

`string`

A string used to identify the job (e.g. in monitoring
applications like eggcups).

If you don't set a job name, GTK picks a default one
by numbering successive print jobs.

### `nPages`

`number` · default `-1`

The number of pages in the document.

This must be set to a positive number before the rendering
starts. It may be set in a `Gtk.PrintOperation.begin-print`
signal handler.

Note that the page numbers passed to the
`Gtk.PrintOperation.request-page-setup` and
`Gtk.PrintOperation.draw-page` signals are 0-based, i.e.
if the user chooses to print all pages, the last ::draw-page signal
will be for page `n_pages` - 1.

### `nPagesToPrint`

`number` · default `-1` · read-only, observe with `onNotifyNPagesToPrint`

The number of pages that will be printed.

Note that this value is set during print preparation phase
(`GTK_PRINT_STATUS_PREPARING`), so this value should never be
get before the data generation phase (`GTK_PRINT_STATUS_GENERATING_DATA`).
You can connect to the `Gtk.PrintOperation.status-changed` signal
and call `Gtk.PrintOperation.getNPagesToPrint()` when
print status is `GTK_PRINT_STATUS_GENERATING_DATA`.

This is typically used to track the progress of print operation.

### `printSettings`

`Gtk.PrintSettings | ReactElement`

The `GtkPrintSettings` used for initializing the dialog.

Setting this property is typically used to re-establish
print settings from a previous print operation, see
`Gtk.PrintOperation.run()`.

### `showProgress`

`boolean` · default `false`

Determines whether to show a progress dialog during the
print operation.

### `status`

`Gtk.PrintStatus` · default `GTK_PRINT_STATUS_INITIAL` · read-only, observe with `onNotifyStatus`

The status of the print operation.

### `statusString`

`string` · read-only, observe with `onNotifyStatusString`

A string representation of the status of the print operation.

The string is translated and suitable for displaying the print
status e.g. in a `GtkStatusbar`.

See the `Gtk.PrintOperation.status` property for a status
value that is suitable for programmatic use.

### `supportSelection`

`boolean` · default `false`

If `true`, the print operation will support print of selection.

This allows the print dialog to show a "Selection" button.

### `trackPrintStatus`

`boolean` · default `false`

If `true`, the print operation will try to continue report on
the status of the print job in the printer queues and printer.

This can allow your application to show things like “out of paper”
issues, and when the print job actually reaches the printer.
However, this is often implemented using polling, and should
not be enabled unless needed.

### `unit`

`Gtk.Unit` · default `GTK_UNIT_NONE`

The transformation for the cairo context obtained from
`GtkPrintContext` is set up in such a way that distances
are measured in units of `unit`.

### `useFullPage`

`boolean` · default `false`

If `true`, the transformation for the cairo context obtained
from `GtkPrintContext` puts the origin at the top left corner
of the page.

This may not be the top left corner of the sheet, depending on
page orientation and the number of pages per sheet. Otherwise,
the origin is at the top left corner of the imageable area (i.e.
inside the margins).

## Signals

### `onBeginPrint`

```ts
(context: Gtk.PrintContext, self: Gtk.PrintOperation) => void
```

Emitted after the user has finished changing print settings
in the dialog, before the actual rendering starts.

A typical use for ::begin-print is to use the parameters from the
`Gtk.PrintContext` and paginate the document accordingly,
and then set the number of pages with
`Gtk.PrintOperation.setNPages()`.

**Parameters**

- `context`: the `GtkPrintContext` for the current operation
- `self`: The instance the signal was emitted on.

### `onCreateCustomWidget`

```ts
(self: Gtk.PrintOperation) => GObject.Object | null | undefined
```

Emitted when displaying the print dialog.

If you return a widget in a handler for this signal it will be
added to a custom tab in the print dialog. You typically return a
container widget with multiple widgets in it.

The print dialog owns the returned widget, and its lifetime is not
controlled by the application. However, the widget is guaranteed
to stay around until the `Gtk.PrintOperation.custom-widget-apply`
signal is emitted on the operation. Then you can read out any
information you need from the widgets.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** A custom widget that gets embedded in
  the print dialog

### `onCustomWidgetApply`

```ts
(widget: Gtk.Widget, self: Gtk.PrintOperation) => void
```

Emitted right before ::begin-print if you added
a custom widget in the ::create-custom-widget handler.

When you get this signal you should read the information from the
custom widgets, as the widgets are not guaranteed to be around at a
later time.

**Parameters**

- `widget`: the custom widget added in ::create-custom-widget
- `self`: The instance the signal was emitted on.

### `onDone`

```ts
(result: Gtk.PrintOperationResult, self: Gtk.PrintOperation) => void
```

Emitted when the print operation run has finished doing
everything required for printing.

`result` gives you information about what happened during the run.
If `result` is `GTK_PRINT_OPERATION_RESULT_ERROR` then you can call
`Gtk.PrintOperation.getError()` for more information.

If you enabled print status tracking then
`Gtk.PrintOperation.isFinished()` may still return `false`
after the ::done signal was emitted.

**Parameters**

- `result`: the result of the print operation
- `self`: The instance the signal was emitted on.

### `onDrawPage`

```ts
(context: Gtk.PrintContext, pageNr: number, self: Gtk.PrintOperation) => void
```

Emitted for every page that is printed.

The signal handler must render the `page_nr`'s page onto the cairo
context obtained from `context` using
`Gtk.PrintContext.getCairoContext()`.

```c
static void
draw_page (GtkPrintOperation *operation,
           GtkPrintContext   *context,
           int                page_nr,
           gpointer           user_data)
{
  cairo_t *cr;
  PangoLayout *layout;
  double width, text_height;
  int layout_height;
  PangoFontDescription *desc;
  
  cr = gtk_print_context_get_cairo_context (context);
  width = gtk_print_context_get_width (context);
  
  cairo_rectangle (cr, 0, 0, width, HEADER_HEIGHT);
  
  cairo_set_source_rgb (cr, 0.8, 0.8, 0.8);
  cairo_fill (cr);
  
  layout = gtk_print_context_create_pango_layout (context);
  
  desc = pango_font_description_from_string ("sans 14");
  pango_layout_set_font_description (layout, desc);
  pango_font_description_free (desc);
  
  pango_layout_set_text (layout, "some text", -1);
  pango_layout_set_width (layout, width * PANGO_SCALE);
  pango_layout_set_alignment (layout, PANGO_ALIGN_CENTER);
     		      
  pango_layout_get_size (layout, NULL, &layout_height);
  text_height = (double)layout_height / PANGO_SCALE;
  
  cairo_move_to (cr, width / 2,  (HEADER_HEIGHT - text_height) / 2);
  pango_cairo_show_layout (cr, layout);
  
  g_object_unref (layout);
}
```

Use `Gtk.PrintOperation.setUseFullPage()` and
`Gtk.PrintOperation.setUnit()` before starting the print
operation to set up the transformation of the cairo context
according to your needs.

**Parameters**

- `context`: the `GtkPrintContext` for the current operation
- `pageNr`: the number of the currently printed page (0-based)
- `self`: The instance the signal was emitted on.

### `onEndPrint`

```ts
(context: Gtk.PrintContext, self: Gtk.PrintOperation) => void
```

Emitted after all pages have been rendered.

A handler for this signal can clean up any resources that have
been allocated in the `Gtk.PrintOperation.begin-print` handler.

**Parameters**

- `context`: the `GtkPrintContext` for the current operation
- `self`: The instance the signal was emitted on.

### `onGotPageSize`

```ts
(context: Gtk.PrintContext, pageSetup: Gtk.PageSetup, self: Gtk.PrintOperation) => void
```

From `GtkPrintOperationPreview`.

Emitted once for each page that gets rendered to the preview.

A handler for this signal should update the `context`
according to `page_setup` and set up a suitable cairo
context, using `Gtk.PrintContext.setCairoContext()`.

**Parameters**

- `context`: the current `GtkPrintContext`
- `pageSetup`: the `GtkPageSetup` for the current page
- `self`: The instance the signal was emitted on.

### `onPaginate`

```ts
(context: Gtk.PrintContext, self: Gtk.PrintOperation) => boolean | undefined
```

Emitted after the ::begin-print signal, but before the actual rendering
starts.

It keeps getting emitted until a connected signal handler returns `true`.

The ::paginate signal is intended to be used for paginating a document
in small chunks, to avoid blocking the user interface for a long
time. The signal handler should update the number of pages using
`Gtk.PrintOperation.setNPages()`, and return `true` if the document
has been completely paginated.

If you don't need to do pagination in chunks, you can simply do
it all in the ::begin-print handler, and set the number of pages
from there.

**Parameters**

- `context`: the `GtkPrintContext` for the current operation
- `self`: The instance the signal was emitted on.

**Returns** `true` if pagination is complete

### `onPreview`

```ts
(preview: Gtk.PrintOperationPreview, context: Gtk.PrintContext, parent: Gtk.Window | null, self: Gtk.PrintOperation) => boolean | undefined
```

Gets emitted when a preview is requested from the native dialog.

The default handler for this signal uses an external viewer
application to preview.

To implement a custom print preview, an application must return
`true` from its handler for this signal. In order to use the
provided `context` for the preview implementation, it must be
given a suitable cairo context with
`Gtk.PrintContext.setCairoContext()`.

The custom preview implementation can use
`Gtk.PrintOperationPreview.isSelected()` and
`Gtk.PrintOperationPreview.renderPage()` to find pages which
are selected for print and render them. The preview must be
finished by calling `Gtk.PrintOperationPreview.endPreview()`
(typically in response to the user clicking a close button).

**Parameters**

- `preview`: the `GtkPrintOperationPreview` for the current operation
- `context`: the `GtkPrintContext` that will be used
- `parent`: the `GtkWindow` to use as window parent
- `self`: The instance the signal was emitted on.

**Returns** `true` if the listener wants to take over control of the preview

### `onReady`

```ts
(context: Gtk.PrintContext, self: Gtk.PrintOperation) => void
```

From `GtkPrintOperationPreview`.

The ::ready signal gets emitted once per preview operation,
before the first page is rendered.

A handler for this signal can be used for setup tasks.

**Parameters**

- `context`: the current `GtkPrintContext`
- `self`: The instance the signal was emitted on.

### `onRequestPageSetup`

```ts
(context: Gtk.PrintContext, pageNr: number, setup: Gtk.PageSetup, self: Gtk.PrintOperation) => void
```

Emitted once for every page that is printed.

This gives the application a chance to modify the page setup.
Any changes done to `setup` will be in force only for printing
this page.

**Parameters**

- `context`: the `GtkPrintContext` for the current operation
- `pageNr`: the number of the currently printed page (0-based)
- `setup`: the `GtkPageSetup`
- `self`: The instance the signal was emitted on.

### `onStatusChanged`

```ts
(self: Gtk.PrintOperation) => void
```

Emitted at between the various phases of the print operation.

See `Gtk.PrintStatus` for the phases that are being discriminated.
Use `Gtk.PrintOperation.getStatus()` to find out the current
status.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUpdateCustomWidget`

```ts
(widget: Gtk.Widget, setup: Gtk.PageSetup, settings: Gtk.PrintSettings, self: Gtk.PrintOperation) => void
```

Emitted after change of selected printer.

The actual page setup and print settings are passed to the custom
widget, which can actualize itself according to this change.

**Parameters**

- `widget`: the custom widget added in ::create-custom-widget
- `setup`: actual page setup
- `settings`: actual print settings
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.PrintOperation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `cancel`

```ts
cancel(): void
```

Cancels a running print operation.

This function may be called from a `Gtk.PrintOperation.begin-print`,
`Gtk.PrintOperation.paginate` or `Gtk.PrintOperation.draw-page`
signal handler to stop the currently running print operation.

### `drawPageFinish`

```ts
drawPageFinish(): void
```

Signal that drawing of particular page is complete.

It is called after completion of page drawing (e.g. drawing
in another thread). If `Gtk.PrintOperation.setDeferDrawing()`
was called before, then this function has to be called by application.
Otherwise it is called by GTK itself.

### `getDefaultPageSetup`

```ts
getDefaultPageSetup(): Gtk.PageSetup
```

Returns the default page setup.

**Returns** the default page setup

### `getEmbedPageSetup`

```ts
getEmbedPageSetup(): boolean
```

Gets whether page setup selection combos are embedded

**Returns** whether page setup selection combos are embedded

### `getError`

```ts
getError(): void
```

Call this when the result of a print operation is
`GTK_PRINT_OPERATION_RESULT_ERROR`.

It can be called either after `Gtk.PrintOperation.run()`
returns, or in the `Gtk.PrintOperation.done` signal
handler.

The returned `GError` will contain more details on what went wrong.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `getHasSelection`

```ts
getHasSelection(): boolean
```

Gets whether there is a selection.

**Returns** whether there is a selection

### `getNPagesToPrint`

```ts
getNPagesToPrint(): number
```

Returns the number of pages that will be printed.

Note that this value is set during print preparation phase
(`GTK_PRINT_STATUS_PREPARING`), so this function should never be
called before the data generation phase (`GTK_PRINT_STATUS_GENERATING_DATA`).
You can connect to the `Gtk.PrintOperation.status-changed`
signal and call `gtk_print_operation_get_n_pages_to_print()` when
print status is `GTK_PRINT_STATUS_GENERATING_DATA`.

This is typically used to track the progress of print operation.

**Returns** the number of pages that will be printed

### `getPrintSettings`

```ts
getPrintSettings(): Gtk.PrintSettings | null
```

Returns the current print settings.

Note that the return value is `null` until either
`Gtk.PrintOperation.setPrintSettings()` or
`Gtk.PrintOperation.run()` have been called.

**Returns** the current print settings of `op`.

### `getStatus`

```ts
getStatus(): Gtk.PrintStatus
```

Returns the status of the print operation.

Also see `Gtk.PrintOperation.getStatusString()`.

**Returns** the status of the print operation

### `getStatusString`

```ts
getStatusString(): string
```

Returns a string representation of the status of the
print operation.

The string is translated and suitable for displaying
the print status e.g. in a `GtkStatusbar`.

Use `Gtk.PrintOperation.getStatus()` to obtain
a status value that is suitable for programmatic use.

**Returns** a string representation of the status
   of the print operation

### `getSupportSelection`

```ts
getSupportSelection(): boolean
```

Gets whether the application supports print of selection

**Returns** whether the application supports print of selection

### `isFinished`

```ts
isFinished(): boolean
```

A convenience function to find out if the print operation
is finished.

a print operation is finished if its status is either
`GTK_PRINT_STATUS_FINISHED` or `GTK_PRINT_STATUS_FINISHED_ABORTED`.

Note: when you enable print status tracking the print operation
can be in a non-finished state even after done has been called, as
the operation status then tracks the print job status on the printer.

**Returns** `true`, if the print operation is finished.

### `run`

```ts
run(action: Gtk.PrintOperationAction, parent: Gtk.Window | null): Gtk.PrintOperationResult
```

Runs the print operation.

Normally that this function does not return until the rendering
of all pages is complete. You can connect to the
`Gtk.PrintOperation.status-changed` signal on `op` to obtain
some information about the progress of the print operation.

Furthermore, it may use a recursive mainloop to show the print dialog.

If you set the [Gtk.PrintOperation:allow-async] property, the operation
will run asynchronously if this is supported on the platform. The
`Gtk.PrintOperation.done` signal will be emitted with the result
of the operation when the it is done (i.e. when the dialog is canceled,
or when the print succeeds or fails).

```c
if (settings != NULL)
  gtk_print_operation_set_print_settings (print, settings);

if (page_setup != NULL)
  gtk_print_operation_set_default_page_setup (print, page_setup);

g_signal_connect (print, "begin-print",
                  G_CALLBACK (begin_print), &data);
g_signal_connect (print, "draw-page",
                  G_CALLBACK (draw_page), &data);

res = gtk_print_operation_run (print,
                               GTK_PRINT_OPERATION_ACTION_PRINT_DIALOG,
                               parent,
                               &error);

if (res == GTK_PRINT_OPERATION_RESULT_ERROR)
 {
   error_dialog = gtk_message_dialog_new (GTK_WINDOW (parent),
  			                     GTK_DIALOG_DESTROY_WITH_PARENT,
					     GTK_MESSAGE_ERROR,
					     GTK_BUTTONS_CLOSE,
					     "Error printing file:\n%s",
					     error->message);
   g_signal_connect (error_dialog, "response",
                     G_CALLBACK (gtk_window_destroy), NULL);
   gtk_window_present (GTK_WINDOW (error_dialog));
   g_error_free (error);
 }
else if (res == GTK_PRINT_OPERATION_RESULT_APPLY)
 {
   if (settings != NULL)
g_object_unref (settings);
   settings = g_object_ref (gtk_print_operation_get_print_settings (print));
 }
```

Note that `gtk_print_operation_run()` can only be called once on a
given `GtkPrintOperation`.

**Parameters**

- `action`: the action to start
- `parent`: Transient parent of the dialog

**Returns** the result of the print operation. A return value of
  `GTK_PRINT_OPERATION_RESULT_APPLY` indicates that the printing was
  completed successfully. In this case, it is a good idea to obtain
  the used print settings with
  `Gtk.PrintOperation.getPrintSettings()`
  and store them for reuse with the next print operation. A value of
  `GTK_PRINT_OPERATION_RESULT_IN_PROGRESS` means the operation is running
  asynchronously, and will emit the `Gtk.PrintOperation.done`
  signal when done.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setAllowAsync`

```ts
setAllowAsync(allowAsync: boolean): void
```

Sets whether `gtk_print_operation_run()` may return
before the print operation is completed.

Note that some platforms may not allow asynchronous
operation.

**Parameters**

- `allowAsync`: `true` to allow asynchronous operation

### `setCurrentPage`

```ts
setCurrentPage(currentPage: number): void
```

Sets the current page.

If this is called before `Gtk.PrintOperation.run()`,
the user will be able to select to print only the current page.

Note that this only makes sense for pre-paginated documents.

**Parameters**

- `currentPage`: the current page, 0-based

### `setCustomTabLabel`

```ts
setCustomTabLabel(label: string | null): void
```

Sets the label for the tab holding custom widgets.

**Parameters**

- `label`: the label to use, or `null` to use the default label

### `setDefaultPageSetup`

```ts
setDefaultPageSetup(defaultPageSetup: Gtk.PageSetup | null): void
```

Makes `default_page_setup` the default page setup for `op`.

This page setup will be used by `Gtk.PrintOperation.run()`,
but it can be overridden on a per-page basis by connecting
to the `Gtk.PrintOperation.request-page-setup` signal.

**Parameters**

- `defaultPageSetup`: a `GtkPageSetup`

### `setDeferDrawing`

```ts
setDeferDrawing(): void
```

Sets up the `GtkPrintOperation` to wait for calling of
[method@Gtk.PrintOperation.draw_page_finish from application.

This can be used for drawing page in another thread.

This function must be called in the callback of the
`Gtk.PrintOperation.draw-page` signal.

### `setEmbedPageSetup`

```ts
setEmbedPageSetup(embed: boolean): void
```

Embed page size combo box and orientation combo box into page setup page.

Selected page setup is stored as default page setup in `GtkPrintOperation`.

**Parameters**

- `embed`: `true` to embed page setup selection in the `GtkPrintUnixDialog`

### `setExportFilename`

```ts
setExportFilename(filename: string): void
```

Sets up the `GtkPrintOperation` to generate a file instead
of showing the print dialog.

The intended use of this function is for implementing
“Export to PDF” actions. Currently, PDF is the only supported
format.

“Print to PDF” support is independent of this and is done
by letting the user pick the “Print to PDF” item from the list
of printers in the print dialog.

**Parameters**

- `filename`: the filename for the exported file

### `setHasSelection`

```ts
setHasSelection(hasSelection: boolean): void
```

Sets whether there is a selection to print.

Application has to set number of pages to which the selection
will draw by `Gtk.PrintOperation.setNPages()` in a handler
for the `Gtk.PrintOperation.begin-print` signal.

**Parameters**

- `hasSelection`: `true` indicates that a selection exists

### `setJobName`

```ts
setJobName(jobName: string): void
```

Sets the name of the print job.

The name is used to identify the job (e.g. in monitoring
applications like eggcups).

If you don’t set a job name, GTK picks a default one by
numbering successive print jobs.

**Parameters**

- `jobName`: a string that identifies the print job

### `setNPages`

```ts
setNPages(nPages: number): void
```

Sets the number of pages in the document.

This must be set to a positive number before the rendering
starts. It may be set in a `Gtk.PrintOperation.begin-print`
signal handler.

Note that the page numbers passed to the
`Gtk.PrintOperation.request-page-setup`
and `Gtk.PrintOperation.draw-page` signals are 0-based, i.e.
if the user chooses to print all pages, the last ::draw-page signal
will be for page `n_pages` - 1.

**Parameters**

- `nPages`: the number of pages

### `setPrintSettings`

```ts
setPrintSettings(printSettings: Gtk.PrintSettings | null): void
```

Sets the print settings for `op`.

This is typically used to re-establish print settings
from a previous print operation, see `Gtk.PrintOperation.run()`.

**Parameters**

- `printSettings`: `GtkPrintSettings`

### `setShowProgress`

```ts
setShowProgress(showProgress: boolean): void
```

If `show_progress` is `true`, the print operation will show
a progress dialog during the print operation.

**Parameters**

- `showProgress`: `true` to show a progress dialog

### `setSupportSelection`

```ts
setSupportSelection(supportSelection: boolean): void
```

Sets whether selection is supported by `GtkPrintOperation`.

**Parameters**

- `supportSelection`: `true` to support selection

### `setTrackPrintStatus`

```ts
setTrackPrintStatus(trackStatus: boolean): void
```

If track_status is `true`, the print operation will try to continue
report on the status of the print job in the printer queues and printer.

This can allow your application to show things like “out of paper”
issues, and when the print job actually reaches the printer.

This function is often implemented using some form of polling,
so it should not be enabled unless needed.

**Parameters**

- `trackStatus`: `true` to track status after printing

### `setUnit`

```ts
setUnit(unit: Gtk.Unit): void
```

Sets up the transformation for the cairo context obtained from
`GtkPrintContext` in such a way that distances are measured in
units of `unit`.

**Parameters**

- `unit`: the unit to use

### `setUseFullPage`

```ts
setUseFullPage(fullPage: boolean): void
```

If `full_page` is `true`, the transformation for the cairo context
obtained from `GtkPrintContext` puts the origin at the top left
corner of the page.

This may not be the top left corner of the sheet, depending on page
orientation and the number of pages per sheet). Otherwise, the origin
is at the top left corner of the imageable area (i.e. inside the margins).

**Parameters**

- `fullPage`: `true` to set up the `GtkPrintContext` for the full page
