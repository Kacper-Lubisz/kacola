---
description: "A lines indicator for Carousel."
---

# AdwCarouselIndicatorLines

A lines indicator for `Carousel`.



The `AdwCarouselIndicatorLines` widget shows a set of lines for each page of
a given `Carousel`. The carousel's active page is shown as another line
that moves between them to match the carousel's position.

See also `CarouselIndicatorDots`.

### CSS nodes

`AdwCarouselIndicatorLines` has a single CSS node with name
`carouselindicatorlines`.

```tsx
import { AdwCarouselIndicatorLines } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwCarouselIndicatorLines**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.CarouselIndicatorLines` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `carousel`

`Adw.Carousel | ReactElement`

The displayed carousel.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

## Methods

Methods are called on the `Adw.CarouselIndicatorLines` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCarousel`

```ts
getCarousel(): Adw.Carousel | null
```

Gets the displayed carousel.

**Returns** the displayed carousel

### `setCarousel`

```ts
setCarousel(carousel: Adw.Carousel | null): void
```

Sets the displayed carousel.

**Parameters**

- `carousel`: a carousel
