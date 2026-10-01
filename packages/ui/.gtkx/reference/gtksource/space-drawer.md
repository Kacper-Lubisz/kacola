---
description: "Represent white space characters with symbols."
---

# GtkSourceSpaceDrawer

Represent white space characters with symbols.

`GtkSourceSpaceDrawer` provides a way to visualize white spaces, by drawing
symbols.

Call `View.getSpaceDrawer()` to get the `GtkSourceSpaceDrawer`
instance of a certain `View`.

By default, no white spaces are drawn because the
`SpaceDrawer.enableMatrix` is `false`.

To draw white spaces, `SpaceDrawer.setTypesForLocations()` can
be called to set the `SpaceDrawer.matrix` property (by default all
space types are enabled at all locations). Then call
`SpaceDrawer.setEnableMatrix()`.

For a finer-grained method, there is also the `Tag`'s
`Tag.drawSpaces` property.

## Example

To draw non-breaking spaces everywhere and draw all types of trailing spaces
except newlines:
```c
gtk_source_space_drawer_set_types_for_locations (space_drawer,
                                                 GTK_SOURCE_SPACE_LOCATION_ALL,
                                                 GTK_SOURCE_SPACE_TYPE_NBSP);

gtk_source_space_drawer_set_types_for_locations (space_drawer,
                                                 GTK_SOURCE_SPACE_LOCATION_TRAILING,
                                                 GTK_SOURCE_SPACE_TYPE_ALL &
                                                 ~GTK_SOURCE_SPACE_TYPE_NEWLINE);

gtk_source_space_drawer_set_enable_matrix (space_drawer, TRUE);
```
```python
space_drawer.set_types_for_locations(
    locations=GtkSource.SpaceLocationFlags.ALL,
    types=GtkSource.SpaceTypeFlags.NBSP,
)

all_types_except_newline = GtkSource.SpaceTypeFlags(
    int(GtkSource.SpaceTypeFlags.ALL) & ~int(GtkSource.SpaceTypeFlags.NEWLINE)
)
space_drawer.set_types_for_locations(
    locations=GtkSource.SpaceLocationFlags.TRAILING,
    types=all_types_except_newline,
)

space_drawer.set_enable_matrix(True)
```

## Use-case: draw unwanted white spaces

A possible use-case is to draw only unwanted white spaces. Examples:

- Draw all trailing spaces.
- If the indentation and alignment must be done with spaces, draw tabs.

And non-breaking spaces can always be drawn, everywhere, to distinguish them
from normal spaces.

```tsx
import { GtkSourceSpaceDrawer } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceSpaceDrawer**

## Props

`ref` receives the `GtkSource.SpaceDrawer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableMatrix`

`boolean` · default `false`

Whether the `SpaceDrawer.matrix` property is enabled.

### `matrix`

`GLib.Variant`

The property is a `GLib.Variant` property to specify where and
what kind of white spaces to draw.

The `GLib.Variant` is of type `"au"`, an array of unsigned integers. Each
integer is a combination of `SpaceTypeFlags`. There is one
integer for each `SpaceLocationFlags`, in the same order as
they are defined in the enum (`GTK_SOURCE_SPACE_LOCATION_NONE` and
`GTK_SOURCE_SPACE_LOCATION_ALL` are not taken into account).

If the array is shorter than the number of locations, then the value
for the missing locations will be `GTK_SOURCE_SPACE_TYPE_NONE`.

By default, `GTK_SOURCE_SPACE_TYPE_ALL` is set for all locations.4

## Methods

Methods are called on the `GtkSource.SpaceDrawer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `bindMatrixSetting`

```ts
bindMatrixSetting(settings: Gio.Settings, key: string, flags: Gio.SettingsBindFlags): void
```

Binds the `SpaceDrawer.matrix` property to a `Gio.Settings` key.

The `Gio.Settings` key must be of the same type as the
`SpaceDrawer.matrix` property, that is, `"au"`.

The `Gio.Settings.bind()` function cannot be used, because the default GIO
mapping functions don't support `GLib.Variant` properties (maybe it will be
supported by a future GIO version, in which case this function can be
deprecated).

**Parameters**

- `settings`: a `GSettings` object.
- `key`: the `settings` key to bind.
- `flags`: flags for the binding.

### `getEnableMatrix`

```ts
getEnableMatrix(): boolean
```

**Returns** whether the `GtkSourceSpaceDrawer.matrix` property is enabled.

### `getMatrix`

```ts
getMatrix(): GLib.Variant
```

Gets the value of the `SpaceDrawer.matrix` property, as a `GLib.Variant`.

An empty array can be returned in case the matrix is a zero matrix.

The `SpaceDrawer.getTypesForLocations()` function may be more
convenient to use.

**Returns** the `GtkSourceSpaceDrawer.matrix` value as a new floating `GVariant`
  instance.

### `getTypesForLocations`

```ts
getTypesForLocations(locations: GtkSource.SpaceLocationFlags): GtkSource.SpaceTypeFlags
```

If only one location is specified, this function returns what kind of
white spaces are drawn at that location.

The value is retrieved from the `SpaceDrawer.matrix` property.

If several locations are specified, this function returns the logical AND for
those locations. Which means that if a certain kind of white space is present
in the return value, then that kind of white space is drawn at all the
specified `locations`.

**Parameters**

- `locations`: one or several `GtkSourceSpaceLocationFlags`.

**Returns** a combination of `GtkSourceSpaceTypeFlags`.

### `setEnableMatrix`

```ts
setEnableMatrix(enableMatrix: boolean): void
```

Sets whether the `SpaceDrawer.matrix` property is enabled.

**Parameters**

- `enableMatrix`: the new value.

### `setMatrix`

```ts
setMatrix(matrix: GLib.Variant | null): void
```

Sets a new value to the `SpaceDrawer.matrix` property, as a `GLib.Variant`.

If `matrix` is `null`, then an empty array is set.

If `matrix` is floating, it is consumed.

The `SpaceDrawer.setTypesForLocations()` function may be more
convenient to use.

**Parameters**

- `matrix`: the new matrix value, or `null`.

### `setTypesForLocations`

```ts
setTypesForLocations(locations: GtkSource.SpaceLocationFlags, types: GtkSource.SpaceTypeFlags): void
```

Modifies the `SpaceDrawer.matrix` property at the specified
`locations`.

**Parameters**

- `locations`: one or several `GtkSourceSpaceLocationFlags`.
- `types`: a combination of `GtkSourceSpaceTypeFlags`.
