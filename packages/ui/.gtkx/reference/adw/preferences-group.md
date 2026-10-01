---
description: "A group of preference rows."
---

# AdwPreferencesGroup

A group of preference rows.



An `AdwPreferencesGroup` represents a group or tightly related preferences,
which in turn are represented by `PreferencesRow`.

To summarize the role of the preferences it gathers, a group can have both a
title and a description. The title will be used by `PreferencesDialog`
to let the user look for a preference.

The `PreferencesGroup.separateRows` property can be used to
separate the rows within the group, same as when using the
[`.boxed-list-separate`](style-classes.html#boxed-lists-cards) style class
instead of `.boxed-list`.

### AdwPreferencesGroup as GtkBuildable

The `AdwPreferencesGroup` implementation of the `Gtk.Buildable` interface
supports adding `PreferencesRow`s to the list by omitting "type". If "type"
is omitted and the widget isn't a `PreferencesRow` the child is added to
a box below the list.

When the "type" attribute of a child is `header-suffix`, the child
is set as the suffix on the end of the title and description.

### CSS nodes

`AdwPreferencesGroup` has a single CSS node with name `preferencesgroup`.

### Accessibility

`AdwPreferencesGroup` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwPreferencesGroup**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.PreferencesGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `description`

`string`

The description for this group of preferences.

### `headerSuffix`

`Gtk.Widget | ReactElement`

The header suffix widget.

Displayed above the list, next to the title and description.

Suffixes are commonly used to show a button or a spinner for the whole
group.

_Available since 1.1._

### `separateRows`

`boolean` · default `false`

Whether to separate rows.

Equivalent to using the
[`.boxed-list-separate`](style-classes.html#boxed-lists-cards) style class
on a `Gtk.ListBox` instead of `.boxed-list`.

_Available since 1.6._

### `title`

`string`

The title for this group of preferences.

## Methods

Methods are called on the `Adw.PreferencesGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(child: Gtk.Widget): void
```

Adds a child to `self`.

**Parameters**

- `child`: the widget to add

### `bindModel`

```ts
bindModel(model: Gio.ListModel | null, createRowFunc: Gtk.ListBoxCreateWidgetFunc | null): void
```

Binds `model` to `self`.

See `Gtk.ListBox.bindModel()`.

**Parameters**

- `model`: a list model to bind
- `createRowFunc`: a function creating a row for each item, or `NULL` in case `model` is `NULL`

_Available since 1.8._

### `getDescription`

```ts
getDescription(): string | null
```

Gets the description of `self`.

**Returns** the description of `self`

### `getHeaderSuffix`

```ts
getHeaderSuffix(): Gtk.Widget | null
```

Gets the suffix for `self`'s header.

**Returns** the suffix for `self`'s header.

_Available since 1.1._

### `getRow`

```ts
getRow(index: number): Gtk.Widget | null
```

Gets the row at `index`.

Can return `NULL` if `index` is larger than the number of rows in the group.

**Parameters**

- `index`: a row index

**Returns** the row at `index`

_Available since 1.8._

### `getSeparateRows`

```ts
getSeparateRows(): boolean
```

Gets whether `self`'s rows are separated.

**Returns** whether rows are separated

_Available since 1.6._

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title of `self`

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child from `self`.

**Parameters**

- `child`: the child to remove

### `setDescription`

```ts
setDescription(description: string | null): void
```

Sets the description for `self`.

**Parameters**

- `description`: the description

### `setHeaderSuffix`

```ts
setHeaderSuffix(suffix: Gtk.Widget | null): void
```

Sets the suffix for `self`'s header.

Displayed above the list, next to the title and description.

Suffixes are commonly used to show a button or a spinner for the whole group.

**Parameters**

- `suffix`: the suffix to set

_Available since 1.1._

### `setSeparateRows`

```ts
setSeparateRows(separateRows: boolean): void
```

Sets whether `self`'s rows are separated.

Equivalent to using the
[`.boxed-list-separate`](style-classes.html#boxed-lists-cards) style class
on a `Gtk.ListBox` instead of `.boxed-list`.

**Parameters**

- `separateRows`: whether to separate rows

_Available since 1.6._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title for `self`.

**Parameters**

- `title`: the title
