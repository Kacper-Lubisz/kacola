---
description: "Represents an annotation added to View, it has a Annotation.line property, Annotation.description, icon and a style."
---

# GtkSourceAnnotation

Represents an annotation added to `View`, it has a `Annotation.line` property,
`Annotation.description`, icon and a style.

It will be displayed always at the end of a line.

If the style is GTK_SOURCE_ANNOTATION_STYLE_NONE it will use the same color as `SpaceDrawer`.

_Available since 5.18._

```tsx
import { GtkSourceAnnotation } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceAnnotation**

## Props

`ref` receives the `GtkSource.Annotation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `description`

`string` · default `null` · read-only, observe with `onNotifyDescription`

The text description displayed at `Annotation.line`

_Available since 5.18._

### `icon`

`Gio.Icon` · read-only, observe with `onNotifyIcon`

The icon displayed at `Annotation.line`

It will be displayed before the text description

_Available since 5.18._

### `line`

`number` · default `1` · read-only, observe with `onNotifyLine`

The line where to display the annotation

_Available since 5.18._

### `style`

`GtkSource.AnnotationStyle` · default `GTK_SOURCE_ANNOTATION_STYLE_NONE` · read-only, observe with `onNotifyStyle`

The style of the annotation

_Available since 5.18._

## Methods

Methods are called on the `GtkSource.Annotation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getDescription`

```ts
getDescription(): string
```

**Returns** the description text displayed

### `getIcon`

```ts
getIcon(): Gio.Icon | null
```

**Returns** a `GIcon` or `null`

### `getLine`

```ts
getLine(): number
```

**Returns** the line number.

### `getStyle`

```ts
getStyle(): GtkSource.AnnotationStyle
```

**Returns** the style of the annotation
