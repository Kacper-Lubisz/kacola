---
description: "A paginated scrolling widget."
---

# AdwCarousel

A paginated scrolling widget.



The `AdwCarousel` widget can be used to display a set of pages with
swipe-based navigation between them.

`CarouselIndicatorDots` and `CarouselIndicatorLines` can be used
to provide page indicators for `AdwCarousel`.

### CSS nodes

`AdwCarousel` has a single CSS node with name `carousel`.

```tsx
import { AdwCarousel } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwCarousel**

Implements `AdwSwipeable`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.Carousel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowLongSwipes`

`boolean` · default `false`

Whether to allow swiping for more than one page at a time.

If the value is `FALSE`, each swipe can only move to the adjacent pages.

### `allowMouseDrag`

`boolean` · default `true`

Sets whether the `AdwCarousel` can be dragged with mouse pointer.

If the value is `FALSE`, dragging is only available on touch.

### `allowScrollWheel`

`boolean` · default `true`

Whether the widget will respond to scroll wheel events.

If the value is `FALSE`, wheel events will be ignored.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `interactive`

`boolean` · default `true`

Whether the carousel can be navigated.

This can be used to temporarily disable the carousel to only allow
navigating it in a certain state.

### `nPages`

`number` · default `0` · read-only, observe with `onNotifyNPages`

The number of pages in a `AdwCarousel`.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `position`

`number` · default `0.000000` · read-only, observe with `onNotifyPosition`

Current scrolling position, unitless.

1 matches 1 page. Use `Carousel.scrollTo()` for changing it.

### `revealDuration`

`number` · default `0`

Page reveal duration, in milliseconds.

Reveal duration is used when animating adding or removing pages.

### `scrollParams`

`Adw.SpringParams`

Scroll animation spring parameters.

The default value is equivalent to:

```c
adw_spring_params_new (1, 0.5, 500)
```

### `spacing`

`number` · default `0`

Spacing between pages in pixels.

## Signals

### `onPageChanged`

```ts
(index: number, self: Adw.Carousel) => void
```

This signal is emitted after a page has been changed.

It can be used to implement "infinite scrolling" by amending the pages
after every scroll.

::: note
    An empty carousel is indicated by `(int)index == -1`.

**Parameters**

- `index`: current page
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.Carousel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(child: Gtk.Widget): void
```

Appends `child` to `self`.

**Parameters**

- `child`: a widget to add

### `getAllowLongSwipes`

```ts
getAllowLongSwipes(): boolean
```

Gets whether to allow swiping for more than one page at a time.

**Returns** `TRUE` if long swipes are allowed

### `getAllowMouseDrag`

```ts
getAllowMouseDrag(): boolean
```

Sets whether `self` can be dragged with mouse pointer.

**Returns** whether `self` can be dragged with mouse pointer

### `getAllowScrollWheel`

```ts
getAllowScrollWheel(): boolean
```

Gets whether `self` will respond to scroll wheel events.

**Returns** `TRUE` if `self` will respond to scroll wheel events

### `getInteractive`

```ts
getInteractive(): boolean
```

Gets whether `self` can be navigated.

**Returns** whether `self` can be navigated

### `getNPages`

```ts
getNPages(): number
```

Gets the number of pages in `self`.

**Returns** the number of pages in `self`

### `getNthPage`

```ts
getNthPage(n: number): Gtk.Widget
```

Gets the page at position `n`.

**Parameters**

- `n`: index of the page

**Returns** the page

### `getPosition`

```ts
getPosition(): number
```

Gets current scroll position in `self`, unitless.

1 matches 1 page. Use `Carousel.scrollTo()` for changing it.

**Returns** the scroll position

### `getRevealDuration`

```ts
getRevealDuration(): number
```

Gets the page reveal duration, in milliseconds.

**Returns** the duration

### `getScrollParams`

```ts
getScrollParams(): Adw.SpringParams
```

Gets the scroll animation spring parameters for `self`.

**Returns** the animation parameters

### `getSpacing`

```ts
getSpacing(): number
```

Gets spacing between pages in pixels.

**Returns** spacing between pages

### `insert`

```ts
insert(child: Gtk.Widget, position: number): void
```

Inserts `child` into `self` at position `position`.

If position is -1, or larger than the number of pages,
`child` will be appended to the end.

**Parameters**

- `child`: a widget to add
- `position`: the position to insert `child` at

### `prepend`

```ts
prepend(child: Gtk.Widget): void
```

Prepends `child` to `self`.

**Parameters**

- `child`: a widget to add

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes `child` from `self`.

**Parameters**

- `child`: a widget to remove

### `reorder`

```ts
reorder(child: Gtk.Widget, position: number): void
```

Moves `child` into position `position`.

If position is -1, or larger than the number of pages, `child` will be moved
at the end.

**Parameters**

- `child`: a widget to add
- `position`: the position to move `child` to

### `scrollTo`

```ts
scrollTo(widget: Gtk.Widget, animate: boolean): void
```

Scrolls to `widget`.

If `animate` is `TRUE`, the transition will be animated.

**Parameters**

- `widget`: a child of `self`
- `animate`: whether to animate the transition

### `setAllowLongSwipes`

```ts
setAllowLongSwipes(allowLongSwipes: boolean): void
```

Sets whether to allow swiping for more than one page at a time.

If `allow_long_swipes` is `FALSE`, each swipe can only move to the adjacent
pages.

**Parameters**

- `allowLongSwipes`: whether to allow long swipes

### `setAllowMouseDrag`

```ts
setAllowMouseDrag(allowMouseDrag: boolean): void
```

Sets whether `self` can be dragged with mouse pointer.

If `allow_mouse_drag` is `FALSE`, dragging is only available on touch.

**Parameters**

- `allowMouseDrag`: whether `self` can be dragged with mouse pointer

### `setAllowScrollWheel`

```ts
setAllowScrollWheel(allowScrollWheel: boolean): void
```

Sets whether `self` will respond to scroll wheel events.

If `allow_scroll_wheel` is `FALSE`, wheel events will be ignored.

**Parameters**

- `allowScrollWheel`: whether `self` will respond to scroll wheel events

### `setInteractive`

```ts
setInteractive(interactive: boolean): void
```

Sets whether `self` can be navigated.

This can be used to temporarily disable the carousel to only allow navigating
it in a certain state.

**Parameters**

- `interactive`: whether `self` can be navigated

### `setRevealDuration`

```ts
setRevealDuration(revealDuration: number): void
```

Sets the page reveal duration, in milliseconds.

Reveal duration is used when animating adding or removing pages.

**Parameters**

- `revealDuration`: the new reveal duration value

### `setScrollParams`

```ts
setScrollParams(params: Adw.SpringParams): void
```

Sets the scroll animation spring parameters for `self`.

The default value is equivalent to:

```c
adw_spring_params_new (1, 0.5, 500)
```

**Parameters**

- `params`: the new parameters

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets spacing between pages in pixels.

**Parameters**

- `spacing`: the new spacing value
