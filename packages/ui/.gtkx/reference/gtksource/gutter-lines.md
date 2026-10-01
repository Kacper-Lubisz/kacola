---
description: "Collected information about visible lines."
---

# GtkSourceGutterLines

Collected information about visible lines.

The `GtkSourceGutterLines` object is used to collect information about
visible lines.

Use this from your `GutterRenderer.query-data` to collect the
necessary information on visible lines. Doing so reduces the number of
passes through the text btree allowing GtkSourceView to reach more
frames-per-second while performing kinetic scrolling.

```tsx
import { GtkSourceGutterLines } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceGutterLines**

## Props

`ref` receives the `GtkSource.GutterLines` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `GtkSource.GutterLines` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addClass`

```ts
addClass(line: number, name: string): void
```

Adds the class `name` to `line`.

`name` will be converted to a `GLib.Quark` as part of this process. A
faster version of this function is available via
`GutterLines.addQclass()` for situations where the `GLib.Quark` is
known ahead of time.

**Parameters**

- `line`: a line number starting from zero
- `name`: a class name

### `addQclass`

```ts
addQclass(line: number, qname: GLib.Quark): void
```

Adds the class denoted by `qname` to `line`.

You may check if a line has `qname` by calling
`GutterLines.hasQclass()`.

You can remove `qname` by calling
`GutterLines.removeQclass()`.

**Parameters**

- `line`: a line number starting from zero
- `qname`: a class name as a `GQuark`

### `getBuffer`

```ts
getBuffer(): Gtk.TextBuffer
```

Gets the `Gtk.TextBuffer` that the `GtkSourceGutterLines` represents.

**Returns** a `GtkTextBuffer`

### `getFirst`

```ts
getFirst(): number
```

Gets the line number (starting from 0) for the first line that is
user visible.

**Returns** a line number starting from 0

### `getIterAtLine`

```ts
getIterAtLine(line: number): Gtk.TextIter
```

Gets a `GtkTextIter` for the current buffer at `line`

**Parameters**

- `line`: the line number

**Returns** a location for a `GtkTextIter`

### `getLast`

```ts
getLast(): number
```

Gets the line number (starting from 0) for the last line that is
user visible.

**Returns** a line number starting from 0

### `getLineExtent`

```ts
getLineExtent(line: number, mode: GtkSource.GutterRendererAlignmentMode): [number, number]
```

Gets the Y range for a line based on `mode`.

The value for `y` is relative to the renderers widget coordinates.

**Parameters**

- `line`: a line number starting from zero
- `mode`: a `GtkSourceGutterRendererAlignmentMode`

**Returns** Tuple of:

- `y`: a location for the Y position in widget coordinates
- `height`: the line height based on `mode`

_Available since 5.18._

### `getLineYrange`

```ts
getLineYrange(line: number, mode: GtkSource.GutterRendererAlignmentMode): [number, number]
```

Gets the Y range for a line based on `mode`.

The value for `y` is relative to the renderers widget coordinates.

**Parameters**

- `line`: a line number starting from zero
- `mode`: a `GtkSourceGutterRendererAlignmentMode`

**Returns** Tuple of:

- `y`: a location for the Y position in widget coordinates
- `height`: the line height based on `mode`

### `getView`

```ts
getView(): Gtk.TextView
```

Gets the `Gtk.TextView` that the `GtkSourceGutterLines` represents.

**Returns** a `GtkTextView`

### `hasAnyClass`

```ts
hasAnyClass(line: number): boolean
```

Checks to see if the line has any GQuark classes set. This can be
used to help renderer implementations avoid work if nothing has
been set on the class.

**Parameters**

- `line`: a line contained within `lines`

**Returns** `true` if any quark was set for the line

_Available since 5.6._

### `hasClass`

```ts
hasClass(line: number, name: string): boolean
```

Checks to see if `GutterLines.addClass()` was called with
the `name` for `line`.

A faster version of this function is provided via
`GutterLines.hasQclass()` for situations where the quark
is known ahead of time.

**Parameters**

- `line`: a line number starting from zero
- `name`: a class name that may be converted, to a `GQuark`

**Returns** `true` if `line` contains `name`

### `hasQclass`

```ts
hasQclass(line: number, qname: GLib.Quark): boolean
```

Checks to see if `GutterLines.addQclass()` was called with
the quark denoted by `qname` for `line`.

**Parameters**

- `line`: a line number starting from zero
- `qname`: a `GQuark` containing the class name

**Returns** `true` if `line` contains `qname`

### `isCursor`

```ts
isCursor(line: number): boolean
```

Checks to see if `line` contains the insertion cursor.

**Parameters**

- `line`: a line number starting from zero

**Returns** `true` if the insertion cursor is on `line`

### `isPrelit`

```ts
isPrelit(line: number): boolean
```

Checks to see if `line` is marked as prelit. Generally, this means
the mouse pointer is over the line within the gutter.

**Parameters**

- `line`: a line number starting from zero

**Returns** `true` if the line is prelit

### `isSelected`

```ts
isSelected(line: number): boolean
```

Checks to see if the view had a selection and if that selection overlaps
`line` in some way.

**Parameters**

- `line`: a line number starting from zero

**Returns** `true` if the line contains a selection

### `removeClass`

```ts
removeClass(line: number, name: string): void
```

Removes the class matching `name` from `line`.

A faster version of this function is available via
`GutterLines.removeQclass()` for situations where the
`GQuark` is known ahead of time.

**Parameters**

- `line`: a line number starting from zero
- `name`: a class name

### `removeQclass`

```ts
removeQclass(line: number, qname: GLib.Quark): void
```

Reverses a call to `GutterLines.addQclass()` by removing
the `GLib.Quark` matching `qname`.

**Parameters**

- `line`: a line number starting from zero
- `qname`: a `GQuark` to remove from `line`
