---
description: "A dots indicator for Carousel."
---

# AdwCarouselIndicatorDots

A dots indicator for `Carousel`.



The `AdwCarouselIndicatorDots` widget shows a set of dots for each page of a
given `Carousel`. The dot representing the carousel's active page is
larger and more opaque than the others, the transition to the active and
inactive state is gradual to match the carousel's position.

See also `CarouselIndicatorLines`.

### CSS nodes

`AdwCarouselIndicatorDots` has a single CSS node with name
`carouselindicatordots`.

```tsx
import { AdwCarouselIndicatorDots } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwCarouselIndicatorDots**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.CarouselIndicatorDots` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `carousel`

`Adw.Carousel | ReactElement`

The displayed carousel.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

## Methods

Methods are called on the `Adw.CarouselIndicatorDots` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

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
