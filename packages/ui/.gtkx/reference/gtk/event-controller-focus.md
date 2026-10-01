---
description: "Tracks keyboard focus."
---

# GtkEventControllerFocus

Tracks keyboard focus.

The event controller offers `Gtk.EventControllerFocus.enter`
and `Gtk.EventControllerFocus.leave` signals, as well as
`Gtk.EventControllerFocus.isFocus` and
`Gtk.EventControllerFocus.containsFocus` properties
which are updated to reflect focus changes inside the widget hierarchy
that is rooted at the controllers widget.

```tsx
import { GtkEventControllerFocus } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkEventControllerFocus**

## Props

`ref` receives the `Gtk.EventControllerFocus` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `containsFocus`

`boolean` · default `false` · read-only, observe with `onNotifyContainsFocus`

`true` if focus is contained in the controllers widget.

See `Gtk.EventControllerFocus.isFocus` for whether
the focus is in the widget itself or inside a descendent.

When handling focus events, this property is updated
before `Gtk.EventControllerFocus.enter` or
`Gtk.EventControllerFocus.leave` are emitted.

### `isFocus`

`boolean` · default `false` · read-only, observe with `onNotifyIsFocus`

`true` if focus is in the controllers widget itself,
as opposed to in a descendent widget.

See also `Gtk.EventControllerFocus.containsFocus`.

When handling focus events, this property is updated
before `Gtk.EventControllerFocus.enter` or
`Gtk.EventControllerFocus.leave` are emitted.

## Signals

### `onEnter`

```ts
(self: Gtk.EventControllerFocus) => void
```

Emitted whenever the focus enters into the widget or one
of its descendents.

Note that this means you may not get an ::enter signal
even though the widget becomes the focus location, in
certain cases (such as when the focus moves from a descendent
of the widget to the widget itself). If you are interested
in these cases, you can monitor the
`Gtk.EventControllerFocus.isFocus`
property for changes.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onLeave`

```ts
(self: Gtk.EventControllerFocus) => void
```

Emitted whenever the focus leaves the widget hierarchy
that is rooted at the widget that the controller is attached to.

Note that this means you may not get a ::leave signal
even though the focus moves away from the widget, in
certain cases (such as when the focus moves from the widget
to a descendent). If you are interested in these cases, you
can monitor the `Gtk.EventControllerFocus.isFocus`
property for changes.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.EventControllerFocus` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `containsFocus`

```ts
containsFocus(): boolean
```

Returns `true` if focus is within `self` or one of its children.

**Returns** `true` if focus is within `self` or one of its children

### `isFocus`

```ts
isFocus(): boolean
```

Returns `true` if focus is within `self`, but not one of its children.

**Returns** `true` if focus is within `self`, but not one of its children
