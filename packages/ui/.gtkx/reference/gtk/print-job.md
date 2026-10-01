---
description: "Represents a job that is sent to a printer."
---

# GtkPrintJob

Represents a job that is sent to a printer.

You only need to deal directly with print jobs if you use the
non-portable `Gtk.PrintUnixDialog` API.

Use `Gtk.PrintJob.getSurface()` to obtain the cairo surface
onto which the pages must be drawn. Use `Gtk.PrintJob.send()`
to send the finished job to the printer. If you don’t use cairo
`GtkPrintJob` also supports printing of manually generated PostScript,
via `Gtk.PrintJob.setSourceFile()`.

```tsx
import { GtkPrintJob } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPrintJob**

## Props

`ref` receives the `Gtk.PrintJob` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `pageSetup`

`Gtk.PageSetup` · construct-only

Page setup.

### `printer`

`Gtk.Printer` · construct-only

The printer to send the job to.

### `settings`

`Gtk.PrintSettings` · construct-only

Printer settings.

### `title`

`string` · default `null` · construct-only

The title of the print job.

### `trackPrintStatus`

`boolean` · default `false`

`true` if the print job will continue to emit status-changed
signals after the print data has been setn to the printer.

## Signals

### `onStatusChanged`

```ts
(self: Gtk.PrintJob) => void
```

Emitted when the status of a job changes.

The signal handler can use `Gtk.PrintJob.getStatus()`
to obtain the new status.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.PrintJob` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getCollate`

```ts
getCollate(): boolean
```

Gets whether this job is printed collated.

**Returns** whether the job is printed collated

### `getNumCopies`

```ts
getNumCopies(): number
```

Gets the number of copies of this job.

**Returns** the number of copies

### `getNUp`

```ts
getNUp(): number
```

Gets the n-up setting for this job.

**Returns** the n-up setting

### `getNUpLayout`

```ts
getNUpLayout(): Gtk.NumberUpLayout
```

Gets the n-up layout setting for this job.

**Returns** the n-up layout

### `getPageRanges`

```ts
getPageRanges(): Gtk.PageRange[]
```

Gets the page ranges for this job.

**Returns** a pointer to an
  array of `GtkPageRange` structs

### `getPages`

```ts
getPages(): Gtk.PrintPages
```

Gets the `GtkPrintPages` setting for this job.

**Returns** the `GtkPrintPages` setting

### `getPageSet`

```ts
getPageSet(): Gtk.PageSet
```

Gets the `GtkPageSet` setting for this job.

**Returns** the `GtkPageSet` setting

### `getPrinter`

```ts
getPrinter(): Gtk.Printer
```

Gets the `GtkPrinter` of the print job.

**Returns** the printer of `job`

### `getReverse`

```ts
getReverse(): boolean
```

Gets whether this job is printed reversed.

**Returns** whether the job is printed reversed.

### `getRotate`

```ts
getRotate(): boolean
```

Gets whether the job is printed rotated.

**Returns** whether the job is printed rotated

### `getScale`

```ts
getScale(): number
```

Gets the scale for this job.

**Returns** the scale

### `getSettings`

```ts
getSettings(): Gtk.PrintSettings
```

Gets the `GtkPrintSettings` of the print job.

**Returns** the settings of `job`

### `getStatus`

```ts
getStatus(): Gtk.PrintStatus
```

Gets the status of the print job.

**Returns** the status of `job`

### `getSurface`

```ts
getSurface(): cairo.Surface
```

Gets a cairo surface onto which the pages of
the print job should be rendered.

**Returns** the cairo surface of `job`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `getTitle`

```ts
getTitle(): string
```

Gets the job title.

**Returns** the title of `job`

### `getTrackPrintStatus`

```ts
getTrackPrintStatus(): boolean
```

Returns whether jobs will be tracked after printing.

For details, see `Gtk.PrintJob.setTrackPrintStatus()`.

**Returns** `true` if print job status will be reported after printing

### `send`

```ts
send(callback: Gtk.PrintJobCompleteFunc): void
```

Sends the print job off to the printer.

**Parameters**

- `callback`: function to call when the job completes or an error occurs

### `setCollate`

```ts
setCollate(collate: boolean): void
```

Sets whether this job is printed collated.

**Parameters**

- `collate`: whether the job is printed collated

### `setNumCopies`

```ts
setNumCopies(numCopies: number): void
```

Sets the number of copies for this job.

**Parameters**

- `numCopies`: the number of copies

### `setNUp`

```ts
setNUp(nUp: number): void
```

Sets the n-up setting for this job.

**Parameters**

- `nUp`: the n-up value

### `setNUpLayout`

```ts
setNUpLayout(layout: Gtk.NumberUpLayout): void
```

Sets the n-up layout setting for this job.

**Parameters**

- `layout`: the n-up layout setting

### `setPageRanges`

```ts
setPageRanges(ranges: Gtk.PageRange[]): void
```

Sets the page ranges for this job.

**Parameters**

- `ranges`: pointer to an array of `GtkPageRange` structs

### `setPages`

```ts
setPages(pages: Gtk.PrintPages): void
```

Sets the `GtkPrintPages` setting for this job.

**Parameters**

- `pages`: the `GtkPrintPages` setting

### `setPageSet`

```ts
setPageSet(pageSet: Gtk.PageSet): void
```

Sets the `GtkPageSet` setting for this job.

**Parameters**

- `pageSet`: a `GtkPageSet` setting

### `setReverse`

```ts
setReverse(reverse: boolean): void
```

Sets whether this job is printed reversed.

**Parameters**

- `reverse`: whether the job is printed reversed

### `setRotate`

```ts
setRotate(rotate: boolean): void
```

Sets whether this job is printed rotated.

**Parameters**

- `rotate`: whether to print rotated

### `setScale`

```ts
setScale(scale: number): void
```

Sets the scale for this job.

1.0 means unscaled.

**Parameters**

- `scale`: the scale

### `setSourceFd`

```ts
setSourceFd(fd: number): boolean
```

Make the `GtkPrintJob` send an existing document to the
printing system.

The file can be in any format understood by the platforms
printing system (typically PostScript, but on many platforms
PDF may work too). See `Gtk.Printer.acceptsPdf()` and
`Gtk.Printer.acceptsPs()`.

This is similar to `Gtk.PrintJob.setSourceFile()`,
but takes expects an open file descriptor for the file,
instead of a filename.

**Parameters**

- `fd`: a file descriptor

**Returns** `false` if an error occurred

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setSourceFile`

```ts
setSourceFile(filename: string): boolean
```

Make the `GtkPrintJob` send an existing document to the
printing system.

The file can be in any format understood by the platforms
printing system (typically PostScript, but on many platforms
PDF may work too). See `Gtk.Printer.acceptsPdf()` and
`Gtk.Printer.acceptsPs()`.

**Parameters**

- `filename`: the file to be printed

**Returns** `false` if an error occurred

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setTrackPrintStatus`

```ts
setTrackPrintStatus(trackStatus: boolean): void
```

If track_status is `true`, the print job will try to continue report
on the status of the print job in the printer queues and printer.

This can allow your application to show things like “out of paper”
issues, and when the print job actually reaches the printer.

This function is often implemented using some form of polling,
so it should not be enabled unless needed.

**Parameters**

- `trackStatus`: `true` to track status after printing
