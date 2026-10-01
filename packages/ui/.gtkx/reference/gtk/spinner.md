---
description: "Displays an icon-size spinning animation."
---

# GtkSpinner

Displays an icon-size spinning animation.

It is often used as an alternative to a `Gtk.ProgressBar`
for displaying indefinite activity, instead of actual progress.



To start the animation, use `Gtk.Spinner.start()`, to stop it
use `Gtk.Spinner.stop()`.

## CSS nodes

`GtkSpinner` has a single CSS node with the name spinner.
When the animation is active, the :checked pseudoclass is
added to this node.

## Accessibility

`GtkSpinner` uses the `Gtk.AccessibleRole.progress_bar` role.

```tsx
import { GtkSpinner } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSpinner**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Spinner` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `spinning`

`boolean` · default `false`

Whether the spinner is spinning

## Methods

Methods are called on the `Gtk.Spinner` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getSpinning`

```ts
getSpinning(): boolean
```

Returns whether the spinner is spinning.

**Returns** `true` if the spinner is active

### `setSpinning`

```ts
setSpinning(spinning: boolean): void
```

Sets the activity of the spinner.

**Parameters**

- `spinning`: whether the spinner should be spinning

### `start`

```ts
start(): void
```

Starts the animation of the spinner.

### `stop`

```ts
stop(): void
```

Stops the animation of the spinner.
