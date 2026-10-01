---
description: "Manages up to three children."
---

# GtkCenterLayout

Manages up to three children.

The start widget is allocated at the start of the layout (left in
left-to-right locales and right in right-to-left ones), and the end
widget at the end.

The center widget is centered regarding the full width of the layout's.

```tsx
import { GtkCenterLayout } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **GtkCenterLayout**

## Props

`ref` receives the `Gtk.CenterLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `shrinkCenterLast`

`boolean` · default `true`

Whether to shrink the center widget after other children.

By default, when there's no space to give all three children their
natural widths, the start and end widgets start shrinking and the
center child keeps natural width until they reach minimum width.

If set to `FALSE`, start and end widgets keep natural width and the
center widget starts shrinking instead.

_Available since 4.12._

## Methods

Methods are called on the `Gtk.CenterLayout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getBaselinePosition`

```ts
getBaselinePosition(): Gtk.BaselinePosition
```

Returns the baseline position of the layout.

**Returns** The current baseline position of `self`.

### `getCenterWidget`

```ts
getCenterWidget(): Gtk.Widget | null
```

Returns the center widget of the layout.

**Returns** the current center widget of `self`

### `getEndWidget`

```ts
getEndWidget(): Gtk.Widget | null
```

Returns the end widget of the layout.

**Returns** the current end widget of `self`

### `getOrientation`

```ts
getOrientation(): Gtk.Orientation
```

Gets the current orienration of the layout manager.

**Returns** The current orientation of `self`

### `getShrinkCenterLast`

```ts
getShrinkCenterLast(): boolean
```

Gets whether `self` shrinks the center widget after other children.

**Returns** whether to shrink the center widget after others

_Available since 4.12._

### `getStartWidget`

```ts
getStartWidget(): Gtk.Widget | null
```

Returns the start widget of the layout.

**Returns** The current start widget of `self`

### `setBaselinePosition`

```ts
setBaselinePosition(baselinePosition: Gtk.BaselinePosition): void
```

Sets the new baseline position of `self`

**Parameters**

- `baselinePosition`: the new baseline position

### `setCenterWidget`

```ts
setCenterWidget(widget: Gtk.Widget | null): void
```

Sets the new center widget of `self`.

To remove the existing center widget, pass `null`.

**Parameters**

- `widget`: the new center widget

### `setEndWidget`

```ts
setEndWidget(widget: Gtk.Widget | null): void
```

Sets the new end widget of `self`.

To remove the existing center widget, pass `null`.

**Parameters**

- `widget`: the new end widget

### `setOrientation`

```ts
setOrientation(orientation: Gtk.Orientation): void
```

Sets the orientation of `self`.

**Parameters**

- `orientation`: the new orientation

### `setShrinkCenterLast`

```ts
setShrinkCenterLast(shrinkCenterLast: boolean): void
```

Sets whether to shrink the center widget after other children.

By default, when there's no space to give all three children their
natural widths, the start and end widgets start shrinking and the
center child keeps natural width until they reach minimum width.

If set to `FALSE`, start and end widgets keep natural width and the
center widget starts shrinking instead.

**Parameters**

- `shrinkCenterLast`: whether to shrink the center widget after others

_Available since 4.12._

### `setStartWidget`

```ts
setStartWidget(widget: Gtk.Widget | null): void
```

Sets the new start widget of `self`.

To remove the existing start widget, pass `null`.

**Parameters**

- `widget`: the new start widget
