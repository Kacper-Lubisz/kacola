---
description: "Animates the transition of its child from invisible to visible."
---

# GtkRevealer

Animates the transition of its child from invisible to visible.

The style of transition can be controlled with
`Gtk.Revealer.setTransitionType()`.

These animations respect the `Gtk.Settings.gtkEnableAnimations`
setting.

## CSS nodes

`GtkRevealer` has a single CSS node with name revealer.
When styling `GtkRevealer` using CSS, remember that it only hides its contents,
not itself. That means applied margin, padding and borders will be visible even
when the `Gtk.Revealer.revealChild` property is set to `false`.

## Accessibility

`GtkRevealer` uses the `Gtk.AccessibleRole.group` role.

The child of `GtkRevealer`, if set, is always available in the accessibility
tree, regardless of the state of the revealer widget.

```tsx
import { GtkRevealer } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkRevealer**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Revealer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `childRevealed`

`boolean` · default `false` · read-only, observe with `onNotifyChildRevealed`

Whether the child is revealed and the animation target reached.

### `revealChild`

`boolean` · default `false`

Whether the revealer should reveal the child.

### `transitionDuration`

`number` · default `250`

The animation duration, in milliseconds.

### `transitionType`

`Gtk.RevealerTransitionType` · default `GTK_REVEALER_TRANSITION_TYPE_SLIDE_DOWN`

The type of animation used to transition.

## Methods

Methods are called on the `Gtk.Revealer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `revealer`.

**Returns** the child widget of `revealer`

### `getChildRevealed`

```ts
getChildRevealed(): boolean
```

Returns whether the child is fully revealed.

In other words, this returns whether the transition
to the revealed state is completed.

**Returns** `true` if the child is fully revealed

### `getRevealChild`

```ts
getRevealChild(): boolean
```

Returns whether the child is currently revealed.

This function returns `true` as soon as the transition
is to the revealed state is started. To learn whether
the child is fully revealed (ie the transition is completed),
use `Gtk.Revealer.getChildRevealed()`.

**Returns** `true` if the child is revealed.

### `getTransitionDuration`

```ts
getTransitionDuration(): number
```

Returns the amount of time (in milliseconds) that
transitions will take.

**Returns** the transition duration

### `getTransitionType`

```ts
getTransitionType(): Gtk.RevealerTransitionType
```

Gets the type of animation that will be used
for transitions in `revealer`.

**Returns** the current transition type of `revealer`

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `revealer`.

**Parameters**

- `child`: the child widget

### `setRevealChild`

```ts
setRevealChild(revealChild: boolean): void
```

Tells the `GtkRevealer` to reveal or conceal its child.

The transition will be animated with the current
transition type of `revealer`.

**Parameters**

- `revealChild`: `true` to reveal the child

### `setTransitionDuration`

```ts
setTransitionDuration(duration: number): void
```

Sets the duration that transitions will take.

**Parameters**

- `duration`: the new duration, in milliseconds

### `setTransitionType`

```ts
setTransitionType(transition: Gtk.RevealerTransitionType): void
```

Sets the type of animation that will be used for
transitions in `revealer`.

Available types include various kinds of fades and slides.

**Parameters**

- `transition`: the new transition type
