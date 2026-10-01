---
description: "A helper widget for setting a window's title and subtitle."
---

# AdwWindowTitle

A helper widget for setting a window's title and subtitle.



`AdwWindowTitle` shows a title and subtitle. It's intended to be used as the
title child of `Gtk.HeaderBar` or `HeaderBar`.

### CSS nodes

`AdwWindowTitle` has a single CSS node with name `windowtitle`.

```tsx
import { AdwWindowTitle } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwWindowTitle**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.WindowTitle` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `subtitle`

`string`

The subtitle to display.

The subtitle should give the user additional details.

### `title`

`string`

The title to display.

The title typically identifies the current view or content item, and
generally does not use the application name.

## Methods

Methods are called on the `Adw.WindowTitle` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getSubtitle`

```ts
getSubtitle(): string
```

Gets the subtitle of `self`.

**Returns** the subtitle

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title

### `setSubtitle`

```ts
setSubtitle(subtitle: string): void
```

Sets the subtitle of `self`.

The subtitle should give the user additional details.

**Parameters**

- `subtitle`: a subtitle

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `self`.

The title typically identifies the current view or content item, and
generally does not use the application name.

**Parameters**

- `title`: a title
