---
description: "A widget displaying an image, with a generated fallback."
---

# AdwAvatar

A widget displaying an image, with a generated fallback.



`AdwAvatar` is a widget that shows a round avatar.

`AdwAvatar` generates an avatar with the initials of  the
`Avatar.text` on top of a colored background.

The color is picked based on the hash of the `Avatar.text`.

If `Avatar.showInitials` is set to `FALSE`,
`Avatar.iconName` or `adw-avatar-default-symbolic` is shown instead
of the initials.

Use `Avatar.customImage` to set a custom image.

### CSS nodes

`AdwAvatar` has a single CSS node with name `avatar`.

### Accessibility

`AdwAvatar` uses the `Gtk.AccessibleRole.img` role.

```tsx
import { AdwAvatar } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwAvatar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.Avatar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `customImage`

`Gdk.Paintable | ReactElement`

A custom image paintable.

Custom image is displayed instead of initials or icon.

### `iconName`

`string` · default `null`

The name of an icon to use as a fallback.

If no name is set, `adw-avatar-default-symbolic` will be used.

### `showInitials`

`boolean` · default `false`

Whether initials are used instead of an icon on the fallback avatar.

See `Avatar.iconName` for how to change the fallback icon.

### `size`

`number` · default `-1`

The size of the avatar.

### `text`

`string`

Sets the text used to generate the fallback initials and color.

It's only used to generate the color if `Avatar.showInitials` is
`FALSE`.

## Methods

Methods are called on the `Adw.Avatar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `avatarGetSize`

```ts
avatarGetSize(): number
```

Gets the size of the avatar.

**Returns** the size of the avatar

### `drawToTexture`

```ts
drawToTexture(scaleFactor: number): Gdk.Texture
```

Renders `self` into a `Gdk.Texture` at `scale_factor`.

This can be used to export the fallback avatar.

**Parameters**

- `scaleFactor`: The scale factor

**Returns** the texture

### `getCustomImage`

```ts
getCustomImage(): Gdk.Paintable | null
```

Gets the custom image paintable.

**Returns** the custom image

### `getIconName`

```ts
getIconName(): string | null
```

Gets the name of an icon to use as a fallback.

**Returns** the icon name

### `getShowInitials`

```ts
getShowInitials(): boolean
```

Gets whether initials are used instead of an icon on the fallback avatar.

**Returns** whether initials are used instead of an icon as fallback

### `getText`

```ts
getText(): string | null
```

Gets the text used to generate the fallback initials and color.

**Returns** the text used to generate the fallback initials and
  color

### `setCustomImage`

```ts
setCustomImage(customImage: Gdk.Paintable | null): void
```

Sets the custom image paintable.

Custom image is displayed instead of initials or icon.

**Parameters**

- `customImage`: a custom image

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the name of an icon to use as a fallback.

If no name is set, `adw-avatar-default-symbolic` will be used.

**Parameters**

- `iconName`: the icon name

### `setShowInitials`

```ts
setShowInitials(showInitials: boolean): void
```

Sets whether to use initials instead of an icon on the fallback avatar.

See `Avatar.iconName` for how to change the fallback icon.

**Parameters**

- `showInitials`: whether to use initials instead of an icon as fallback

### `setSize`

```ts
setSize(size: number): void
```

Sets the size of the avatar.

**Parameters**

- `size`: The size of the avatar

### `setText`

```ts
setText(text: string | null): void
```

Sets the text used to generate the fallback initials and color.

It's only used to generate the color if `Avatar.showInitials` is
`FALSE`.

**Parameters**

- `text`: the text used to get the initials and color
