---
description: "Use this object to manage Annotations."
---

# GtkSourceAnnotations

Use this object to manage `Annotation`s. Each `View` has a single annotation
manager and it is guaranteed to be the same for the lifetime of `View`.

Add `AnnotationProvider`s with `Annotations.addProvider()` to
display all the annotations added to each `AnnotationProvider`.

_Available since 5.18._

```tsx
import { GtkSourceAnnotations } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceAnnotations**

## Props

`ref` receives the `GtkSource.Annotations` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onChanged`

```ts
(self: GtkSource.Annotations) => void
```

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.Annotations` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addProvider`

```ts
addProvider(provider: GtkSource.AnnotationProvider): void
```

Adds a new annotation provider.

**Parameters**

- `provider`: a `GtkSourceAnnotationProvider`.

### `removeProvider`

```ts
removeProvider(provider: GtkSource.AnnotationProvider): boolean
```

Removes a provider.

**Parameters**

- `provider`: a `GtkSourceAnnotationProvider`.

**Returns** `true` if the provider was found and removed
