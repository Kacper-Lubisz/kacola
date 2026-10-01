---
description: "A paintable showing a loading spinner."
---

# AdwSpinnerPaintable

A paintable showing a loading spinner.



`AdwSpinnerPaintable` size varies depending on the available space, but is
capped at 64×64 pixels.

To be able to animate, `AdwSpinnerPaintable` needs a widget. It will be
animated according to that widget's frame clock, and only if that widget is
mapped. Ideally it should be the same widget the paintable is displayed in,
but that's not a requirement.

Most applications should be using `Spinner` instead.
`AdwSpinnerPaintable` is provided for the cases where using a widget is
impractical or impossible, such as `StatusPage.paintable`:

```xml
<object class="AdwStatusPage" id="status_page">
  <property name="paintable">
    <object class="AdwSpinnerPaintable">
      <property name="widget">status_page</property>
    </object>
  </property>
  <!-- ... -->
</object>
```

_Available since 1.6._

```tsx
import { AdwSpinnerPaintable } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwSpinnerPaintable**

Implements `GdkPaintable`, `GtkSymbolicPaintable`.

## Props

`ref` receives the `Adw.SpinnerPaintable` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `widget`

`Gtk.Widget | ReactElement`

The widget the spinner uses for frame clock.

_Available since 1.6._

## Signals

### `onInvalidateContents`

```ts
(self: Adw.SpinnerPaintable) => void
```

From `GdkPaintable`.

Emitted when the contents of the `paintable` change.

Examples for such an event would be videos changing to the next frame or
the icon theme for an icon changing.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInvalidateSize`

```ts
(self: Adw.SpinnerPaintable) => void
```

From `GdkPaintable`.

Emitted when the intrinsic size of the `paintable` changes.

This means the values reported by at least one of
`Gdk.Paintable.getIntrinsicWidth()`,
`Gdk.Paintable.getIntrinsicHeight()` or
`Gdk.Paintable.getIntrinsicAspectRatio()`
has changed.

Examples for such an event would be a paintable displaying
the contents of a toplevel surface being resized.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.SpinnerPaintable` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getWidget`

```ts
getWidget(): Gtk.Widget | null
```

Gets the widget used for frame clock.

**Returns** the widget

_Available since 1.6._

### `setWidget`

```ts
setWidget(widget: Gtk.Widget | null): void
```

Sets the widget used for frame clock.

**Parameters**

- `widget`: the widget to use for frame clock

_Available since 1.6._
