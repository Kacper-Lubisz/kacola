---
description: "Describes a constraint between attributes of two widgets, expressed as a linear equation."
---

# GtkConstraint

Describes a constraint between attributes of two widgets,
 expressed as a linear equation.

The typical equation for a constraint is:

```
  target.target_attr = source.source_attr × multiplier + constant
```

Each `GtkConstraint` is part of a system that will be solved by a
`Gtk.ConstraintLayout` in order to allocate and position each
child widget or guide.

The source and target, as well as their attributes, of a `GtkConstraint`
instance are immutable after creation.

```tsx
import { GtkConstraint } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkConstraint**

## Props

`ref` receives the `Gtk.Constraint` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `constant`

`number` · default `0.000000` · construct-only

The constant value to be added to the `Gtk.Constraint.sourceAttribute`.

### `multiplier`

`number` · default `1.000000` · construct-only

The multiplication factor to be applied to
the `Gtk.Constraint.sourceAttribute`.

### `relation`

`Gtk.ConstraintRelation` · default `GTK_CONSTRAINT_RELATION_EQ` · construct-only

The order relation between the terms of the constraint.

### `source`

`Gtk.ConstraintTarget` · construct-only

The source of the constraint.

The constraint will set the `Gtk.Constraint.targetAttribute`
property of the target using the `Gtk.Constraint.sourceAttribute`
property of the source.

### `sourceAttribute`

`Gtk.ConstraintAttribute` · default `GTK_CONSTRAINT_ATTRIBUTE_NONE` · construct-only

The attribute of the `Gtk.Constraint.source` read by the
constraint.

### `strength`

`number` · default `1001001000` · construct-only

The strength of the constraint.

The strength can be expressed either using one of the symbolic values
of the `Gtk.ConstraintStrength` enumeration, or any positive integer
value.

### `target`

`Gtk.ConstraintTarget` · construct-only

The target of the constraint.

The constraint will set the `Gtk.Constraint.targetAttribute`
property of the target using the `Gtk.Constraint.sourceAttribute`
property of the source widget.

### `targetAttribute`

`Gtk.ConstraintAttribute` · default `GTK_CONSTRAINT_ATTRIBUTE_NONE` · construct-only

The attribute of the `Gtk.Constraint.target` set by the constraint.

## Methods

Methods are called on the `Gtk.Constraint` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getConstant`

```ts
getConstant(): number
```

Retrieves the constant factor added to the source attributes' value.

**Returns** a constant factor

### `getMultiplier`

```ts
getMultiplier(): number
```

Retrieves the multiplication factor applied to the source
attribute's value.

**Returns** a multiplication factor

### `getRelation`

```ts
getRelation(): Gtk.ConstraintRelation
```

The order relation between the terms of the constraint.

**Returns** a relation type

### `getSource`

```ts
getSource(): Gtk.ConstraintTarget | null
```

Retrieves the `Gtk.ConstraintTarget` used as the source for the
constraint.

If the source is set to `NULL` at creation, the constraint will use
the widget using the `Gtk.ConstraintLayout` as the source.

**Returns** the source of the constraint

### `getSourceAttribute`

```ts
getSourceAttribute(): Gtk.ConstraintAttribute
```

Retrieves the attribute of the source to be read by the constraint.

**Returns** the source's attribute

### `getStrength`

```ts
getStrength(): number
```

Retrieves the strength of the constraint.

**Returns** the strength value

### `getTarget`

```ts
getTarget(): Gtk.ConstraintTarget | null
```

Retrieves the `Gtk.ConstraintTarget` used as the target for
the constraint.

If the targe is set to `NULL` at creation, the constraint will use
the widget using the `Gtk.ConstraintLayout` as the target.

**Returns** a `GtkConstraintTarget`

### `getTargetAttribute`

```ts
getTargetAttribute(): Gtk.ConstraintAttribute
```

Retrieves the attribute of the target to be set by the constraint.

**Returns** the target's attribute

### `isAttached`

```ts
isAttached(): boolean
```

Checks whether the constraint is attached to a `Gtk.ConstraintLayout`,
and it is contributing to the layout.

**Returns** `TRUE` if the constraint is attached

### `isConstant`

```ts
isConstant(): boolean
```

Checks whether the constraint describes a relation between an attribute
on the `Gtk.Constraint.target` and a constant value.

**Returns** `TRUE` if the constraint is a constant relation

### `isRequired`

```ts
isRequired(): boolean
```

Checks whether the constraint is a required relation for solving the
constraint layout.

**Returns** `true` if the constraint is required
