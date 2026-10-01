---
description: "Represents a printer."
---

# GtkPrinter

Represents a printer.

You only need to deal directly with printers if you use the
non-portable `Gtk.PrintUnixDialog` API.

A `GtkPrinter` allows to get status information about the printer,
such as its description, its location, the number of queued jobs,
etc. Most importantly, a `GtkPrinter` object can be used to create
a `Gtk.PrintJob` object, which lets you print to the printer.

```tsx
import { GtkPrinter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPrinter**

## Props

`ref` receives the `Gtk.Printer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `acceptingJobs`

`boolean` · default `true` · read-only, observe with `onNotifyAcceptingJobs`

`true` if the printer is accepting jobs.

### `acceptsPdf`

`boolean` · default `false` · construct-only

`true` if this printer can accept PDF.

### `acceptsPs`

`boolean` · default `true` · construct-only

`true` if this printer can accept PostScript.

### `iconName`

`string` · default `printer` · read-only, observe with `onNotifyIconName`

Icon name to use for the printer.

### `isVirtual`

`boolean` · default `false` · construct-only

`false` if this represents a real hardware device.

### `jobCount`

`number` · default `0` · read-only, observe with `onNotifyJobCount`

Number of jobs queued in the printer.

### `location`

`string` · read-only, observe with `onNotifyLocation`

Information about the location of the printer.

### `name`

`string` · construct-only

The name of the printer.

### `paused`

`boolean` · default `false` · read-only, observe with `onNotifyPaused`

`true` if this printer is paused.

A paused printer still accepts jobs, but it does
not print them.

### `stateMessage`

`string` · read-only, observe with `onNotifyStateMessage`

String giving the current status of the printer.

## Signals

### `onDetailsAcquired`

```ts
(success: boolean, self: Gtk.Printer) => void
```

Emitted in response to a request for detailed information
about a printer from the print backend.

The `success` parameter indicates if the information was
actually obtained.

**Parameters**

- `success`: `true` if the details were successfully acquired
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Printer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `acceptsPdf`

```ts
acceptsPdf(): boolean
```

Returns whether the printer accepts input in
PDF format.

**Returns** `true` if `printer` accepts PDF

### `acceptsPs`

```ts
acceptsPs(): boolean
```

Returns whether the printer accepts input in
PostScript format.

**Returns** `true` if `printer` accepts PostScript

### `compare`

```ts
compare(b: Gtk.Printer): number
```

Compares two printers.

**Parameters**

- `b`: another `GtkPrinter`

**Returns** 0 if the printer match, a negative value if `a` < `b`,
  or a positive value if `a` > `b`

### `getBackend`

```ts
getBackend(): Gtk.PrintBackend
```

Returns the backend of the printer.

**Returns** the backend of `printer`

### `getCapabilities`

```ts
getCapabilities(): Gtk.PrintCapabilities
```

Returns the printer’s capabilities.

This is useful when you’re using `GtkPrintUnixDialog`’s
manual-capabilities setting and need to know which settings
the printer can handle and which you must handle yourself.

This will return 0 unless the printer’s details are
available, see `Gtk.Printer.hasDetails()` and
`Gtk.Printer.requestDetails()`.

**Returns** the printer’s capabilities

### `getDefaultPageSize`

```ts
getDefaultPageSize(): Gtk.PageSetup
```

Returns default page size of `printer`.

**Returns** a newly allocated `GtkPageSetup` with default page size
  of the printer.

### `getDescription`

```ts
getDescription(): string
```

Gets the description of the printer.

**Returns** the description of `printer`

### `getHardMargins`

```ts
getHardMargins(): [boolean, number, number, number, number]
```

Retrieve the hard margins of `printer`.

These are the margins that define the area at the borders
of the paper that the printer cannot print to.

Note: This will not succeed unless the printer’s details are
available, see `Gtk.Printer.hasDetails()` and
`Gtk.Printer.requestDetails()`.

**Returns** Tuple of:

- `result`: `true` iff the hard margins were retrieved
- `top`: a location to store the top margin in
- `bottom`: a location to store the bottom margin in
- `left`: a location to store the left margin in
- `right`: a location to store the right margin in

### `getHardMarginsForPaperSize`

```ts
getHardMarginsForPaperSize(paperSize: Gtk.PaperSize): [boolean, number, number, number, number]
```

Retrieve the hard margins of `printer` for `paper_size`.

These are the margins that define the area at the borders
of the paper that the printer cannot print to.

Note: This will not succeed unless the printer’s details are
available, see `Gtk.Printer.hasDetails()` and
`Gtk.Printer.requestDetails()`.

**Parameters**

- `paperSize`: a `GtkPaperSize`

**Returns** Tuple of:

- `result`: `true` iff the hard margins were retrieved
- `top`: a location to store the top margin in
- `bottom`: a location to store the bottom margin in
- `left`: a location to store the left margin in
- `right`: a location to store the right margin in

### `getIconName`

```ts
getIconName(): string
```

Gets the name of the icon to use for the printer.

**Returns** the icon name for `printer`

### `getJobCount`

```ts
getJobCount(): number
```

Gets the number of jobs currently queued on the printer.

**Returns** the number of jobs on `printer`

### `getLocation`

```ts
getLocation(): string
```

Returns a description of the location of the printer.

**Returns** the location of `printer`

### `getName`

```ts
getName(): string
```

Returns the name of the printer.

**Returns** the name of `printer`

### `getStateMessage`

```ts
getStateMessage(): string
```

Returns the state message describing the current state
of the printer.

**Returns** the state message of `printer`

### `hasDetails`

```ts
hasDetails(): boolean
```

Returns whether the printer details are available.

**Returns** `true` if `printer` details are available

### `isAcceptingJobs`

```ts
isAcceptingJobs(): boolean
```

Returns whether the printer is accepting jobs

**Returns** `true` if `printer` is accepting jobs

### `isActive`

```ts
isActive(): boolean
```

Returns whether the printer is currently active (i.e.
accepts new jobs).

**Returns** `true` if `printer` is active

### `isDefault`

```ts
isDefault(): boolean
```

Returns whether the printer is the default printer.

**Returns** `true` if `printer` is the default

### `isPaused`

```ts
isPaused(): boolean
```

Returns whether the printer is currently paused.

A paused printer still accepts jobs, but it is not
printing them.

**Returns** `true` if `printer` is paused

### `isVirtual`

```ts
isVirtual(): boolean
```

Returns whether the printer is virtual (i.e. does not
represent actual printer hardware, but something like
a CUPS class).

**Returns** `true` if `printer` is virtual

### `listPapers`

```ts
listPapers(): Gtk.PageSetup[]
```

Lists all the paper sizes `printer` supports.

This will return and empty list unless the printer’s details
are available, see `Gtk.Printer.hasDetails()` and
`Gtk.Printer.requestDetails()`.

**Returns** a newly
  allocated list of newly allocated `GtkPageSetup`s.

### `requestDetails`

```ts
requestDetails(): void
```

Requests the printer details.

When the details are available, the
`Gtk.Printer.details-acquired` signal
will be emitted on `printer`.
