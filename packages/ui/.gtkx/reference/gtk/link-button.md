---
description: "A button with a hyperlink."
---

# GtkLinkButton

A button with a hyperlink.



It is useful to show quick links to resources.

A link button is created by calling either `Gtk.LinkButton.new()` or
`Gtk.LinkButton.newWithLabel()`. If using the former, the URI you
pass to the constructor is used as a label for the widget.

The URI bound to a `GtkLinkButton` can be set specifically using
`Gtk.LinkButton.setUri()`.

By default, `GtkLinkButton` calls `Gtk.FileLauncher.launch()` when the button
is clicked. This behaviour can be overridden by connecting to the
`Gtk.LinkButton.activate-link` signal and returning `true` from
the signal handler.

## Shortcuts and Gestures

`GtkLinkButton` supports the following keyboard shortcuts:

- <kbd>Shift</kbd>+<kbd>F10</kbd> or <kbd>Menu</kbd> opens the context menu.

## Actions

`GtkLinkButton` defines a set of built-in actions:

- `clipboard.copy` copies the url to the clipboard.
- `menu.popup` opens the context menu.

## CSS nodes

`GtkLinkButton` has a single CSS node with name button. To differentiate
it from a plain `GtkButton`, it gets the .link style class.

## Accessibility

`GtkLinkButton` uses the `Gtk.AccessibleRole.link` role.

```tsx
import { GtkLinkButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkButton](.gtkx/reference/gtk/button.md) → **GtkLinkButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.LinkButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `uri`

`string` · default `null`

The URI bound to this button.

### `visited`

`boolean` · default `false`

The 'visited' state of this button.

A visited link is drawn in a different color.

## Signals

### `onActivateLink`

```ts
(self: Gtk.LinkButton) => boolean | undefined
```

Emitted each time the `GtkLinkButton` is clicked.

The default handler will call `Gtk.FileLauncher.launch()` with the URI
stored inside the `Gtk.LinkButton.uri` property.

To override the default behavior, you can connect to the
::activate-link signal and stop the propagation of the signal
by returning `true` from your handler.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** `true` if the signal has been handled

## Methods

Methods are called on the `Gtk.LinkButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getUri`

```ts
getUri(): string
```

Retrieves the URI of the `GtkLinkButton`.

**Returns** a valid URI. The returned string is owned by the link button
  and should not be modified or freed.

### `getVisited`

```ts
getVisited(): boolean
```

Retrieves the “visited” state of the `GtkLinkButton`.

The button becomes visited when it is clicked. If the URI
is changed on the button, the “visited” state is unset again.

The state may also be changed using `Gtk.LinkButton.setVisited()`.

**Returns** `true` if the link has been visited, `false` otherwise

### `setUri`

```ts
setUri(uri: string): void
```

Sets `uri` as the URI where the `GtkLinkButton` points.

As a side-effect this unsets the “visited” state of the button.

**Parameters**

- `uri`: a valid URI

### `setVisited`

```ts
setVisited(visited: boolean): void
```

Sets the “visited” state of the `GtkLinkButton`.

See `Gtk.LinkButton.getVisited()` for more details.

**Parameters**

- `visited`: the new “visited” state
