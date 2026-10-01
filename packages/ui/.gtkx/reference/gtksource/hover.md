---
description: "Interactive tooltips."
---

# GtkSourceHover

Interactive tooltips.

`GtkSourceHover` allows a `View` to provide contextual information.
When enabled, if the user hovers over a word in the text editor, a series
of registered `HoverProvider` can populate a `HoverDisplay`
with useful information.

To enable call `View.getHover()` and add `HoverProvider`
using `Hover.addProvider()`. To disable, remove all registered
providers with `Hover.removeProvider()`.

You can change how long to wait to display the interactive tooltip by
setting the `Hover.hoverDelay` property in milliseconds.

```tsx
import { GtkSourceHover } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceHover**

## Props

`ref` receives the `GtkSource.Hover` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `hoverDelay`

`number` · default `500`

Contains the number of milliseconds to delay before showing the hover assistant.

## Methods

Methods are called on the `GtkSource.Hover` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addProvider`

```ts
addProvider(provider: GtkSource.HoverProvider): void
```

### `removeProvider`

```ts
removeProvider(provider: GtkSource.HoverProvider): void
```
