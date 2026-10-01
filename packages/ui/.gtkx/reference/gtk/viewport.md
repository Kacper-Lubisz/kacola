---
description: "Implements scrollability for widgets that don't support scrolling on their own."
---

# GtkViewport

Implements scrollability for widgets that don't support scrolling
on their own.

Use `GtkViewport` to scroll child widgets such as `GtkGrid`,
`GtkBox`, and so on.

The `GtkViewport` will start scrolling content only if allocated
less than the child widget’s minimum size in a given orientation.

## CSS nodes

`GtkViewport` has a single CSS node with name `viewport`.

## Accessibility

Until GTK 4.10, `GtkViewport` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkViewport` uses the `Gtk.AccessibleRole.generic` role.

```tsx
import { GtkViewport } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkViewport**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `Gtk.Viewport` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `scrollToFocus`

`boolean` · default `true`

Whether to scroll when the focus changes.

Before 4.6.2, this property was mistakenly defaulting to FALSE, so if your
code needs to work with older versions, consider setting it explicitly to
TRUE.

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.

## Methods

Methods are called on the `Gtk.Viewport` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `viewport`.

**Returns** the child widget of `viewport`

### `getScrollToFocus`

```ts
getScrollToFocus(): boolean
```

Gets whether the viewport is scrolling to keep the focused
child in view.

**Returns** `true` if the viewport keeps the focus child scrolled to view

### `scrollTo`

```ts
scrollTo(descendant: Gtk.Widget, scroll: Gtk.ScrollInfo | null): void
```

Scrolls a descendant of the viewport into view.

The viewport and the descendant must be visible and mapped for
this function to work, otherwise no scrolling will be performed.

**Parameters**

- `descendant`: a descendant widget of the viewport
- `scroll`: details of how to perform the scroll operation or NULL to scroll into view

_Available since 4.12._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `viewport`.

**Parameters**

- `child`: the child widget

### `setScrollToFocus`

```ts
setScrollToFocus(scrollToFocus: boolean): void
```

Sets whether the viewport should automatically scroll
to keep the focused child in view.

**Parameters**

- `scrollToFocus`: whether to keep the focus widget scrolled to view
