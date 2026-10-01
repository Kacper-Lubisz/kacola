---
description: "Provides raw access to the event stream."
---

# GtkEventControllerLegacy

Provides raw access to the event stream.

It should only be used as a last resort if none of the other event
controllers or gestures do the job.

```tsx
import { GtkEventControllerLegacy } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkEventControllerLegacy**

## Props

`ref` receives the `Gtk.EventControllerLegacy` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onEvent`

```ts
(event: Gdk.Event, self: Gtk.EventControllerLegacy) => boolean | undefined
```

Emitted for each GDK event delivered to `controller`.

**Parameters**

- `event`: the `GdkEvent` which triggered this signal
- `self`: The instance the signal was emitted on.

**Returns** `true` to stop other handlers from being invoked for the event
  and the emission of this signal. `false` to propagate the event further.
