---
description: "An object representing an individual shortcut in ShortcutsSection."
---

# AdwShortcutsItem

An object representing an individual shortcut in `ShortcutsSection`.

A shortcut has a title, an optional subtitle, and an accelerator.

Accelerator must be specified in the format `ShortcutLabel` accepts.

Alternatively, the `ShortcutsItem.actionName` property can be used
to automatically get accelerator associated with the specified action, as set
via `Gtk.Application.setAccelsForAction()`.

If both are specified, the accelerator will be used if the action couldn't
be found or doesn't have an accelerator associated for it.

If `ShortcutsItem.direction` is set, the shortcut will only be
displayed for the specified text direction. This allows to display different
shortcuts for different text directions.

_Available since 1.8._

```tsx
import { AdwShortcutsItem } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwShortcutsItem**

## Props

`ref` receives the `Adw.ShortcutsItem` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accelerator`

`string`

The shortcut accelerator.

Accelerator must be in the format `ShortcutLabel` accepts.

_Available since 1.8._

### `actionName`

`string`

Fully qualified action name to get the accelerator from.

_Available since 1.8._

### `direction`

`Gtk.TextDirection` · default `GTK_TEXT_DIR_NONE`

The shortcut direction.

If set to `Gtk.TextDirection.LTR` or `Gtk.TextDirection.rtl`, the
shortcut will only be displayed for this direction.

_Available since 1.8._

### `subtitle`

`string`

The subtitle of the shortcut.

_Available since 1.8._

### `title`

`string`

The title of the shortcut.

_Available since 1.8._

## Methods

Methods are called on the `Adw.ShortcutsItem` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAccelerator`

```ts
getAccelerator(): string
```

Gets the accelerator of `self`.

**Returns** the accelerator

_Available since 1.8._

### `getActionName`

```ts
getActionName(): string
```

Gets the action name to get the accelerator from.

**Returns** the action name

_Available since 1.8._

### `getDirection`

```ts
getDirection(): Gtk.TextDirection
```

Gets the direction of `self`.

**Returns** the shortcut direction

_Available since 1.8._

### `getSubtitle`

```ts
getSubtitle(): string
```

Gets the subtitle of `self`.

**Returns** the subtitle

_Available since 1.8._

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title

_Available since 1.8._

### `setAccelerator`

```ts
setAccelerator(accelerator: string): void
```

Sets the accelerator of `self`.

`accelerator` must be in the format `ShortcutLabel` accepts.

**Parameters**

- `accelerator`: the accelerator to use

_Available since 1.8._

### `setActionName`

```ts
setActionName(actionName: string): void
```

Sets the action name to get the accelerator from.

**Parameters**

- `actionName`: the action name to use

_Available since 1.8._

### `setDirection`

```ts
setDirection(direction: Gtk.TextDirection): void
```

Sets the direction of `self`.

If set to `Gtk.TextDirection.ltr` or `Gtk.TextDirection.rtl`, the
shortcut will only be displayed for this direction.

**Parameters**

- `direction`: the shortcut direction

_Available since 1.8._

### `setSubtitle`

```ts
setSubtitle(subtitle: string): void
```

Sets the subtitle of `self`.

**Parameters**

- `subtitle`: the subtitle to use

_Available since 1.8._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `self`.

**Parameters**

- `title`: the title to use

_Available since 1.8._
