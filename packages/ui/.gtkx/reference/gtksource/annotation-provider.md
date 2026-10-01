---
description: "It is used to provide annotations and display them on View and also populate HoverDisplay when the user hovers over an annotation."
---

# GtkSourceAnnotationProvider

It is used to provide annotations and display them on `View` and also populate
`HoverDisplay` when the user hovers over an annotation.

You can subclass this object and implement `AnnotationProvider.populateHoverAsync()` and
`AnnotationProvider.populateHoverFinish()` or connect to `AnnotationProvider.populate`
and call `AnnotationProvider.populate()` or do it asynchronously.

_Available since 5.18._

```tsx
import { GtkSourceAnnotationProvider } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceAnnotationProvider**

## Props

`ref` receives the `GtkSource.AnnotationProvider` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onChanged`

```ts
(self: GtkSource.AnnotationProvider) => void
```

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 5.18._

## Methods

Methods are called on the `GtkSource.AnnotationProvider` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addAnnotation`

```ts
addAnnotation(annotation: GtkSource.Annotation): void
```

Add an annotation to the provider.

_Available since 5.18._

### `populateHoverAsync`

```ts
populateHoverAsync(annotation: GtkSource.Annotation, display: GtkSource.HoverDisplay, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Used to populate the `HoverDisplay` asynchronously, use
`AnnotationProvider.populateHover()` to do it synchronously.

**Parameters**

- `annotation`: a `GtkSourceAnnotation`
- `display`: a `GtkSourceHoverDisplay` to populate

**Returns** `true` if successful; otherwise `false` and `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 5.18._

### `populateHoverFinish`

```ts
populateHoverFinish(result: Gio.AsyncResult): boolean
```

Finishes populating the `HoverDisplay` asynchronously.

**Returns** `true` if successful; otherwise `false` and `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 5.18._

### `removeAll`

```ts
removeAll(): void
```

Removes all annotations from the provider.

_Available since 5.18._

### `removeAnnotation`

```ts
removeAnnotation(annotation: GtkSource.Annotation): boolean
```

Remove an annotation from the provider.

**Returns** `true` if the annotation was found and removed

_Available since 5.18._
