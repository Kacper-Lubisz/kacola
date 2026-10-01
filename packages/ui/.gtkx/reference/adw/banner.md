---
description: "A bar with contextual information."
---

# AdwBanner

A bar with contextual information.



Banners are hidden by default, use `Banner.revealed` to show them.

Banners have a title, set with `Banner.title`. Titles can be marked
up with Pango markup, use `Banner.useMarkup` to enable it.

The title will be shown centered or left-aligned depending on available
space.

Banners can optionally have a button with text on it, set through
`Banner.buttonLabel`. The button can be used with a `GAction`,
or with the `Banner.button-clicked` signal. The button can have
different styles, a gray style and a suggested style.



### CSS nodes

`AdwBanner` has a main CSS node with the name `banner`.

_Available since 1.3._

```tsx
import { AdwBanner } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwBanner**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.Banner` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `buttonLabel`

`string`

The label to show on the button.

If set to `""` or `NULL`, the button won't be shown.

The button can be used with a `GAction`, or with the
`Banner.button-clicked` signal.

_Available since 1.3._

### `buttonStyle`

`Adw.BannerButtonStyle` · default `ADW_BANNER_BUTTON_DEFAULT`

The style class to use for the banner button.

When set to `Adw.BannerButtonStyle.default`, the button is grey.
When set to `Adw.BannerButtonStyle.suggested`, the button uses the
[`.suggested-action`](style-classes.html#suggested-action) appearance.

_Available since 1.7._

### `revealed`

`boolean` · default `false`

Whether the banner is currently revealed.

_Available since 1.3._

### `title`

`string`

The title for this banner.

See also: `Banner.useMarkup`.

_Available since 1.3._

### `useMarkup`

`boolean` · default `true`

Whether to use Pango markup for the banner title.

See also `Pango.parseMarkup()`.

_Available since 1.3._

## Signals

### `onButtonClicked`

```ts
(self: Adw.Banner) => void
```

This signal is emitted after the action button has been clicked.

It can be used as an alternative to setting an action.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.3._

## Methods

Methods are called on the `Adw.Banner` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getButtonLabel`

```ts
getButtonLabel(): string | null
```

Gets the button label for `self`.

**Returns** the button label for `self`

_Available since 1.3._

### `getButtonStyle`

```ts
getButtonStyle(): Adw.BannerButtonStyle
```

Gets the style class in use for the banner button.

**Returns** the current button style

_Available since 1.7._

### `getRevealed`

```ts
getRevealed(): boolean
```

Gets if a banner is revealed

**Returns** Whether a banner is revealed

_Available since 1.3._

### `getTitle`

```ts
getTitle(): string
```

Gets the title for `self`.

**Returns** the title for `self`

_Available since 1.3._

### `getUseMarkup`

```ts
getUseMarkup(): boolean
```

Gets whether to use Pango markup for the banner title.

**Returns** whether to use markup

_Available since 1.3._

### `setButtonLabel`

```ts
setButtonLabel(label: string | null): void
```

Sets the button label for `self`.

If set to `""` or `NULL`, the button won't be shown.

The button can be used with a `GAction`, or with the
`Banner.button-clicked` signal.

**Parameters**

- `label`: the label

_Available since 1.3._

### `setButtonStyle`

```ts
setButtonStyle(style: Adw.BannerButtonStyle): void
```

Sets the style class to use for the banner button.

When set to `Adw.BannerButtonStyle.default`, the button is grey.
When set to `Adw.BannerButtonStyle.suggested`, the button uses the
[`.suggested-action`](style-classes.html#suggested-action) appearance.

**Parameters**

- `style`: a button style

_Available since 1.7._

### `setRevealed`

```ts
setRevealed(revealed: boolean): void
```

Sets whether a banner should be revealed

**Parameters**

- `revealed`: whether a banner should be revealed

_Available since 1.3._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title for this banner.

See also: `Banner.useMarkup`.

**Parameters**

- `title`: the title

_Available since 1.3._

### `setUseMarkup`

```ts
setUseMarkup(useMarkup: boolean): void
```

Sets whether to use Pango markup for the banner title.

See also `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup

_Available since 1.3._
