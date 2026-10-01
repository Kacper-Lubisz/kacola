---
description: "Shows one of its children at a time."
---

# GtkStack

Shows one of its children at a time.



In contrast to `GtkNotebook`, `GtkStack` does not provide a means
for users to change the visible child. Instead, a separate widget
such as `Gtk.StackSwitcher` or `Gtk.StackSidebar` can
be used with `GtkStack` to provide this functionality.

Transitions between pages can be animated as slides or fades. This
can be controlled with `Gtk.Stack.setTransitionType()`.
These animations respect the `Gtk.Settings.gtkEnableAnimations`
setting.

`GtkStack` maintains a `Gtk.StackPage` object for each added
child, which holds additional per-child properties. You
obtain the `GtkStackPage` for a child with `Gtk.Stack.getPage()`
and you can obtain a `GtkSelectionModel` containing all the pages
with `Gtk.Stack.getPages()`.

## GtkStack as GtkBuildable

To set child-specific properties in a .ui file, create `GtkStackPage`
objects explicitly, and set the child widget as a property on it:

```xml
  <object class="GtkStack" id="stack">
    <child>
      <object class="GtkStackPage">
        <property name="name">page1</property>
        <property name="title">In the beginning…</property>
        <property name="child">
          <object class="GtkLabel">
            <property name="label">It was dark</property>
          </object>
        </property>
      </object>
    </child>
```

## CSS nodes

`GtkStack` has a single CSS node named stack.

## Accessibility

`GtkStack` uses the `Gtk.AccessibleRole.tab_panel` role for the stack
pages, which are the accessible parent objects of the child widgets.

```tsx
import { GtkStack } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkStack**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Stack` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `hhomogeneous`

`boolean` · default `true`

`true` if the stack allocates the same width for all children.

### `interpolateSize`

`boolean` · default `false`

Whether or not the size should smoothly change during the transition.

### `pages`

`Gtk.SelectionModel` · read-only, observe with `onNotifyPages`

A selection model with the stack pages.

### `transitionDuration`

`number` · default `200`

The animation duration, in milliseconds.

### `transitionRunning`

`boolean` · default `false` · read-only, observe with `onNotifyTransitionRunning`

Whether or not the transition is currently running.

### `transitionType`

`Gtk.StackTransitionType` · default `GTK_STACK_TRANSITION_TYPE_NONE`

The type of animation used to transition.

### `vhomogeneous`

`boolean` · default `true`

`true` if the stack allocates the same height for all children.

### `visibleChild`

`Gtk.Widget | ReactElement`

The widget currently visible in the stack.

### `visibleChildName`

`string` · default `null`

The name of the widget currently visible in the stack.

## Methods

Methods are called on the `Gtk.Stack` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addChild`

```ts
addChild(child: Gtk.Widget): Gtk.StackPage
```

Adds a child to `stack`.

**Parameters**

- `child`: the widget to add

**Returns** the `GtkStackPage` for `child`

### `addNamed`

```ts
addNamed(child: Gtk.Widget, name: string | null): Gtk.StackPage
```

Adds a child to `stack`.

The child is identified by the `name`.

**Parameters**

- `child`: the widget to add
- `name`: the name for `child`

**Returns** the `GtkStackPage` for `child`

### `addTitled`

```ts
addTitled(child: Gtk.Widget, name: string | null, title: string): Gtk.StackPage
```

Adds a child to `stack`.

The child is identified by the `name`. The `title`
will be used by `GtkStackSwitcher` to represent
`child` in a tab bar, so it should be short.

**Parameters**

- `child`: the widget to add
- `name`: the name for `child`
- `title`: a human-readable title for `child`

**Returns** the `GtkStackPage` for `child`

### `getChildByName`

```ts
getChildByName(name: string): Gtk.Widget | null
```

Finds the child with the name given as the argument.

Returns `null` if there is no child with this name.

**Parameters**

- `name`: the name of the child to find

**Returns** the requested child
  of the `GtkStack`

### `getHhomogeneous`

```ts
getHhomogeneous(): boolean
```

Gets whether `stack` is horizontally homogeneous.

**Returns** whether `stack` is horizontally homogeneous.

### `getInterpolateSize`

```ts
getInterpolateSize(): boolean
```

Returns whether the `GtkStack` is set up to interpolate between
the sizes of children on page switch.

**Returns** `true` if child sizes are interpolated

### `getPage`

```ts
getPage(child: Gtk.Widget): Gtk.StackPage
```

Returns the `GtkStackPage` object for `child`.

**Parameters**

- `child`: a child of `stack`

**Returns** the `GtkStackPage` for `child`

### `getPages`

```ts
getPages(): Gtk.SelectionModel
```

Returns a `GListModel` that contains the pages of the stack.

This can be used to keep an up-to-date view. The model also
implements `Gtk.SelectionModel` and can be used to track
and modify the visible page.

**Returns** a `GtkSelectionModel` for the stack's children

### `getTransitionDuration`

```ts
getTransitionDuration(): number
```

Returns the amount of time (in milliseconds) that
transitions between pages in `stack` will take.

**Returns** the transition duration

### `getTransitionRunning`

```ts
getTransitionRunning(): boolean
```

Returns whether the `stack` is currently in a transition from one page to
another.

**Returns** `true` if the transition is currently running, `false` otherwise.

### `getTransitionType`

```ts
getTransitionType(): Gtk.StackTransitionType
```

Gets the type of animation that will be used
for transitions between pages in `stack`.

**Returns** the current transition type of `stack`

### `getVhomogeneous`

```ts
getVhomogeneous(): boolean
```

Gets whether `stack` is vertically homogeneous.

**Returns** whether `stack` is vertically homogeneous.

### `getVisibleChild`

```ts
getVisibleChild(): Gtk.Widget | null
```

Gets the currently visible child of `stack`.

Returns `null` if there are no visible children.

**Returns** the visible child of the `GtkStack`

### `getVisibleChildName`

```ts
getVisibleChildName(): string | null
```

Returns the name of the currently visible child of `stack`.

Returns `null` if there is no visible child.

**Returns** the name of the visible child
  of the `GtkStack`

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child widget from `stack`.

**Parameters**

- `child`: the child to remove

### `setHhomogeneous`

```ts
setHhomogeneous(hhomogeneous: boolean): void
```

Sets the `GtkStack` to be horizontally homogeneous or not.

If it is homogeneous, the `GtkStack` will request the same
width for all its children. If it isn't, the stack
may change width when a different child becomes visible.

**Parameters**

- `hhomogeneous`: `true` to make `stack` horizontally homogeneous

### `setInterpolateSize`

```ts
setInterpolateSize(interpolateSize: boolean): void
```

Sets whether or not `stack` will interpolate its size when
changing the visible child.

If the `Gtk.Stack.interpolateSize` property is set
to `true`, `stack` will interpolate its size between the current
one and the one it'll take after changing the visible child,
according to the set transition duration.

**Parameters**

- `interpolateSize`: the new value

### `setTransitionDuration`

```ts
setTransitionDuration(duration: number): void
```

Sets the duration that transitions between pages in `stack`
will take.

**Parameters**

- `duration`: the new duration, in milliseconds

### `setTransitionType`

```ts
setTransitionType(transition: Gtk.StackTransitionType): void
```

Sets the type of animation that will be used for
transitions between pages in `stack`.

Available types include various kinds of fades and slides.

The transition type can be changed without problems
at runtime, so it is possible to change the animation
based on the page that is about to become current.

**Parameters**

- `transition`: the new transition type

### `setVhomogeneous`

```ts
setVhomogeneous(vhomogeneous: boolean): void
```

Sets the `GtkStack` to be vertically homogeneous or not.

If it is homogeneous, the `GtkStack` will request the same
height for all its children. If it isn't, the stack
may change height when a different child becomes visible.

**Parameters**

- `vhomogeneous`: `true` to make `stack` vertically homogeneous

### `setVisibleChild`

```ts
setVisibleChild(child: Gtk.Widget): void
```

Makes `child` the visible child of `stack`.

If `child` is different from the currently visible child,
the transition between the two will be animated with the
current transition type of `stack`.

Note that the `child` widget has to be visible itself
(see `Gtk.Widget.show()`) in order to become the visible
child of `stack`.

**Parameters**

- `child`: a child of `stack`

### `setVisibleChildFull`

```ts
setVisibleChildFull(name: string, transition: Gtk.StackTransitionType): void
```

Makes the child with the given name visible.

Note that the child widget has to be visible itself
(see `Gtk.Widget.show()`) in order to become the visible
child of `stack`.

**Parameters**

- `name`: the name of the child to make visible
- `transition`: the transition type to use

### `setVisibleChildName`

```ts
setVisibleChildName(name: string): void
```

Makes the child with the given name visible.

If `child` is different from the currently visible child,
the transition between the two will be animated with the
current transition type of `stack`.

Note that the child widget has to be visible itself
(see `Gtk.Widget.show()`) in order to become the visible
child of `stack`.

**Parameters**

- `name`: the name of the child to make visible
