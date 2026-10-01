---
description: "GtkAssistantPage is an auxiliary object used by GtkAssistant."
---

# GtkAssistantPage

`GtkAssistantPage` is an auxiliary object used by `GtkAssistant`.

> **Deprecated since 4.10.** This object will be removed in GTK 5

```tsx
import { GtkAssistantPage } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkAssistantPage**

## Props

`ref` receives the `Gtk.AssistantPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `child`

`Gtk.Widget` · construct-only · deprecated since 4.10

The child widget.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `complete`

`boolean` · default `false` · deprecated since 4.10

Whether all required fields are filled in.

GTK uses this information to control the sensitivity
of the navigation buttons.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `pageType`

`Gtk.AssistantPageType` · default `GTK_ASSISTANT_PAGE_CONTENT` · deprecated since 4.10

The type of the assistant page.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `title`

`string` · default `null` · deprecated since 4.10

The title of the page.

> **Deprecated since 4.10.** This object will be removed in GTK 5

## Methods

Methods are called on the `Gtk.AssistantPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget
```

Returns the child to which `page` belongs.

**Returns** the child to which `page` belongs

> **Deprecated since 4.10.** This widget will be removed in GTK 5
