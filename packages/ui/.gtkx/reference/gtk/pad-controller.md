---
description: "Handles input from the pads found in drawing tablets."
---

# GtkPadController

Handles input from the pads found in drawing tablets.

Pads are the collection of buttons and tactile sensors often found around
the stylus-sensitive area.

These buttons and sensors have no implicit meaning, and by default they
perform no action. `GtkPadController` is provided to map those to
`Gio.Action` objects, thus letting the application give them a more
semantic meaning.

Buttons and sensors are not constrained to triggering a single action,
some `GDK_SOURCE_TABLET_PAD` devices feature multiple "modes". All these
input elements have one current mode, which may determine the final action
being triggered.

Pad devices often divide buttons and sensors into groups. All elements
in a group share the same current mode, but different groups may have
different modes. See `Gdk.DevicePad.getNGroups()` and
`Gdk.DevicePad.getGroupNModes()`.

Each of the actions that a given button/strip/ring performs for a given mode
is defined by a `Gtk.PadActionEntry`. It contains an action name that
will be looked up in the given `Gio.ActionGroup` and activated whenever
the specified input element and mode are triggered.

A simple example of `GtkPadController` usage: Assigning button 1 in all
modes and pad devices to an "invert-selection" action:

```c
GtkPadActionEntry *pad_actions[] = {
  { GTK_PAD_ACTION_BUTTON, 1, -1, "Invert selection", "pad-actions.invert-selection" },
  …
};

…
action_group = g_simple_action_group_new ();
action = g_simple_action_new ("pad-actions.invert-selection", NULL);
g_signal_connect (action, "activate", on_invert_selection_activated, NULL);
g_action_map_add_action (G_ACTION_MAP (action_group), action);
…
pad_controller = gtk_pad_controller_new (action_group, NULL);
```

The actions belonging to rings/strips/dials will be activated with a parameter
of type `G_VARIANT_TYPE_DOUBLE` bearing the value of the given axis, it
is required that those are made stateful and accepting this `GVariantType`.
For rings the value is the angle of the ring position in degrees with 0
facing up. For strips the value is the absolute position on the strip, normalized
to the [0.0, 1.0] range.
For dials the value is the relative movement of the dial, normalized so that the
value 120 represents one logical scroll wheel detent in the positive direction.
Devices that support high-resolution scrolling may send events with fractions of
120 to signify a smaller motion.

```tsx
import { GtkPadController } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkPadController**

## Props

`ref` receives the `Gtk.PadController` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionGroup`

`Gio.ActionGroup` · construct-only

The action group of the controller.

### `pad`

`Gdk.Device` · construct-only

The pad of the controller.

## Methods

Methods are called on the `Gtk.PadController` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `setAction`

```ts
setAction(type: Gtk.PadActionType, index: number, mode: number, label: string, actionName: string): void
```

Adds an individual action to `controller`.

This action will only be activated if the given button/ring/strip number
in `index` is interacted while the current mode is `mode`. -1 may be used
for simple cases, so the action is triggered on all modes.

The given `label` should be considered user-visible, so internationalization
rules apply. Some windowing systems may be able to use those for user
feedback.

**Parameters**

- `type`: the type of pad feature that will trigger this action
- `index`: the 0-indexed button/ring/strip number that will trigger this action
- `mode`: the mode that will trigger this action, or -1 for all modes.
- `label`: Human readable description of this action, this string should be deemed user-visible.
- `actionName`: action name that will be activated in the `GActionGroup`

### `setActionEntries`

```ts
setActionEntries(entries: Gtk.PadActionEntry[]): void
```

A convenience function to add a group of action entries on
`controller`.

See `Gtk.PadActionEntry` and `Gtk.PadController.setAction()`.

**Parameters**

- `entries`: the action entries to set on `controller`
