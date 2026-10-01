---
description: "An invisible layout element in a GtkConstraintLayout."
---

# GtkConstraintGuide

An invisible layout element in a `GtkConstraintLayout`.

The `GtkConstraintLayout` treats guides like widgets. They
can be used as the source or target of a `GtkConstraint`.

Guides have a minimum, maximum and natural size. Depending
on the constraints that are applied, they can act like a
guideline that widgets can be aligned to, or like *flexible
space*.

Unlike a `GtkWidget`, a `GtkConstraintGuide` will not be drawn.

```tsx
import { GtkConstraintGuide } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkConstraintGuide**

Implements `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ConstraintGuide` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `maxHeight`

`number` · default `2147483647`

The maximum height of the guide.

### `maxWidth`

`number` · default `2147483647`

The maximum width of the guide.

### `minHeight`

`number` · default `0`

The minimum height of the guide.

### `minWidth`

`number` · default `0`

The minimum width of the guide.

### `name`

`string` · default `null`

A name that identifies the `GtkConstraintGuide`, for debugging.

### `natHeight`

`number` · default `0`

The preferred, or natural, height of the guide.

### `natWidth`

`number` · default `0`

The preferred, or natural, width of the guide.

### `strength`

`Gtk.ConstraintStrength` · default `GTK_CONSTRAINT_STRENGTH_MEDIUM`

The `GtkConstraintStrength` to be used for the constraint on
the natural size of the guide.

## Methods

Methods are called on the `Gtk.ConstraintGuide` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getMaxSize`

```ts
getMaxSize(): [number, number]
```

Gets the maximum size of `guide`.

**Returns** Tuple of:

- `width`: return location for the maximum width
- `height`: return location for the maximum height

### `getMinSize`

```ts
getMinSize(): [number, number]
```

Gets the minimum size of `guide`.

**Returns** Tuple of:

- `width`: return location for the minimum width
- `height`: return location for the minimum height

### `getName`

```ts
getName(): string | null
```

Retrieves the name set using `gtk_constraint_guide_set_name()`.

**Returns** the name of the guide

### `getNatSize`

```ts
getNatSize(): [number, number]
```

Gets the natural size of `guide`.

**Returns** Tuple of:

- `width`: return location for the natural width
- `height`: return location for the natural height

### `getStrength`

```ts
getStrength(): Gtk.ConstraintStrength
```

Retrieves the strength set using `gtk_constraint_guide_set_strength()`.

**Returns** the strength of the constraint on the natural size

### `setMaxSize`

```ts
setMaxSize(width: number, height: number): void
```

Sets the maximum size of `guide`.

If `guide` is attached to a `GtkConstraintLayout`,
the constraints will be updated to reflect the new size.

**Parameters**

- `width`: the new maximum width, or -1 to not change it
- `height`: the new maximum height, or -1 to not change it

### `setMinSize`

```ts
setMinSize(width: number, height: number): void
```

Sets the minimum size of `guide`.

If `guide` is attached to a `GtkConstraintLayout`,
the constraints will be updated to reflect the new size.

**Parameters**

- `width`: the new minimum width, or -1 to not change it
- `height`: the new minimum height, or -1 to not change it

### `setName`

```ts
setName(name: string | null): void
```

Sets a name for the given `GtkConstraintGuide`.

The name is useful for debugging purposes.

**Parameters**

- `name`: a name for the `guide`

### `setNatSize`

```ts
setNatSize(width: number, height: number): void
```

Sets the natural size of `guide`.

If `guide` is attached to a `GtkConstraintLayout`,
the constraints will be updated to reflect the new size.

**Parameters**

- `width`: the new natural width, or -1 to not change it
- `height`: the new natural height, or -1 to not change it

### `setStrength`

```ts
setStrength(strength: Gtk.ConstraintStrength): void
```

Sets the strength of the constraint on the natural size of the
given `GtkConstraintGuide`.

**Parameters**

- `strength`: the strength of the constraint
