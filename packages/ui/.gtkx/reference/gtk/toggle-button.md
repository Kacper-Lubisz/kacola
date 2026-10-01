---
description: "Shows a button which remains “pressed-in” when clicked."
---

# GtkToggleButton

Shows a button which remains “pressed-in” when clicked.



Clicking again will cause the toggle button to return to its normal state.

A toggle button is created by calling either `Gtk.ToggleButton.new()` or
`Gtk.ToggleButton.newWithLabel()`. If using the former, it is advisable
to pack a widget, (such as a `GtkLabel` and/or a `GtkImage`), into the toggle
button’s container. (See `Gtk.Button` for more information).

The state of a `GtkToggleButton` can be set specifically using
`Gtk.ToggleButton.setActive()`, and retrieved using
`Gtk.ToggleButton.getActive()`.

### Grouping

Toggle buttons can be grouped together, to form mutually exclusive
groups - only one of the buttons can be toggled at a time, and toggling
another one will switch the currently toggled one off.

To add a `GtkToggleButton` to a group, use `Gtk.ToggleButton.setGroup()`.

### CSS nodes

`GtkToggleButton` has a single CSS node with name button. To differentiate
it from a plain `GtkButton`, it gets the `.toggle` style class.

### Accessibility

`GtkToggleButton` uses the `Gtk.AccessibleRole.toggle_button` role.

### Creating two `GtkToggleButton` widgets.

```c
static void
output_state (GtkToggleButton *source,
              gpointer         user_data)
{
  g_print ("Toggle button "%s" is active: %s",
           gtk_button_get_label (GTK_BUTTON (source)),
           gtk_toggle_button_get_active (source) ? "Yes" : "No");
}

static void
make_toggles (void)
{
  GtkWidget *window, *toggle1, *toggle2;
  GtkWidget *box;
  const char *text;

  window = gtk_window_new ();
  box = gtk_box_new (GTK_ORIENTATION_VERTICAL, 12);

  text = "Hi, I’m toggle button one";
  toggle1 = gtk_toggle_button_new_with_label (text);

  g_signal_connect (toggle1, "toggled",
                    G_CALLBACK (output_state),
                    NULL);
  gtk_box_append (GTK_BOX (box), toggle1);

  text = "Hi, I’m toggle button two";
  toggle2 = gtk_toggle_button_new_with_label (text);
  g_signal_connect (toggle2, "toggled",
                    G_CALLBACK (output_state),
                    NULL);
  gtk_box_append (GTK_BOX (box), toggle2);

  gtk_window_set_child (GTK_WINDOW (window), box);
  gtk_window_present (GTK_WINDOW (window));
}
```

```tsx
import { GtkToggleButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkButton](.gtkx/reference/gtk/button.md) → **GtkToggleButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ToggleButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `false`

If the toggle button should be pressed in.

### `group`

`Gtk.ToggleButton | ReactElement`

The toggle button whose group this widget belongs to.

## Signals

### `onToggled`

```ts
(self: Gtk.ToggleButton) => void
```

Emitted whenever the `GtkToggleButton`'s state is changed.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ToggleButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): boolean
```

Queries a `GtkToggleButton` and returns its current state.

Returns `true` if the toggle button is pressed in and `false`
if it is raised.

**Returns** whether the button is pressed

### `setActive`

```ts
setActive(isActive: boolean): void
```

Sets the status of the toggle button.

Set to `true` if you want the `GtkToggleButton` to be “pressed in”,
and `false` to raise it.

If the status of the button changes, this action causes the
`Gtk.ToggleButton.toggled` signal to be emitted.

**Parameters**

- `isActive`: `true` or `false`.

### `setGroup`

```ts
setGroup(group: Gtk.ToggleButton | null): void
```

Adds `self` to the group of `group`.

In a group of multiple toggle buttons, only one button can be active
at a time.

Setting up groups in a cycle leads to undefined behavior.

Note that the same effect can be achieved via the `Gtk.Actionable`
API, by using the same action with parameter type and state type 's'
for all buttons in the group, and giving each button its own target
value.

**Parameters**

- `group`: another `GtkToggleButton` to form a group with

### `toggled`

```ts
toggled(): void
```

Emits the ::toggled signal on the `GtkToggleButton`.

> **Deprecated since 4.10.** There is no good reason for an application ever to call this function.
