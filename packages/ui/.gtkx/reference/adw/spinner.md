---
description: "A widget showing a loading spinner."
---

# AdwSpinner

A widget showing a loading spinner.



The size of the spinner depends on the available size, never smaller than
16×16 pixels and never larger than 64×64 pixels.

Use the `Gtk.Widget.halign` and `Gtk.Widget.valign`
properties in combination with `Gtk.Widget.widthRequest` and
`Gtk.Widget.heightRequest` for fine sizing control.

For example, the following snippet shows the spinner at 48×48 pixels:

```xml
<object class="AdwSpinner">
  <property name="halign">center</property>
  <property name="valign">center</property>
  <property name="width-request">48</property>
  <property name="height-request">48</property>
</object>
```

See `SpinnerPaintable` for cases where using a widget is impractical or
impossible, such as `StatusPage.paintable`.

### CSS nodes

`AdwSpinner` has a single node with the name `image` and the style class
`.spinner`.

### Accessibility

`AdwSpinner` uses the `Gtk.AccessibleRole.progress-bar` role.

_Available since 1.6._

```tsx
import { AdwSpinner } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwSpinner**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.Spinner` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
