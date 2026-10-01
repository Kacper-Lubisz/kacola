---
description: "A button that displays the number of TabView pages."
---

# AdwTabButton

A button that displays the number of `TabView` pages.



`AdwTabButton` is a button that displays the number of pages in a given
`AdwTabView`, as well as whether one of the inactive pages needs attention.

It's intended to be used as a visible indicator when there's no visible tab
bar, typically opening an `TabOverview` on click, e.g. via the
`overview.open` action name:

```xml
<object class="AdwTabButton">
  <property name="view">view</property>
  <property name="action-name">overview.open</property>
</object>
```

### CSS nodes

`AdwTabButton` has a main CSS node with name `tabbutton`.

## Accessibility

`AdwTabButton` uses the `Gtk.AccessibleRole.button` role.

_Available since 1.3._

```tsx
import { AdwTabButton } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwTabButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.TabButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `view`

`Adw.TabView | ReactElement`

The view the tab button displays.

_Available since 1.3._

## Signals

### `onActivate`

```ts
(self: Adw.TabButton) => void
```

Emitted to animate press then release.

This is an action signal. Applications should never connect to this signal,
but use the `TabButton.clicked` signal.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.3._

### `onClicked`

```ts
(self: Adw.TabButton) => void
```

Emitted when the button has been activated (pressed and released).

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.3._

## Methods

Methods are called on the `Adw.TabButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getView`

```ts
getView(): Adw.TabView | null
```

Gets the tab view `self` displays.

**Returns** the tab view

_Available since 1.3._

### `setView`

```ts
setView(view: Adw.TabView | null): void
```

Sets the tab view to display.

**Parameters**

- `view`: a tab view

_Available since 1.3._
