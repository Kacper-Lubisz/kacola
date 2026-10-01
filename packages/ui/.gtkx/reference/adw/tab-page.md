---
description: "An auxiliary class used by TabView."
---

# AdwTabPage

An auxiliary class used by `TabView`.

```tsx
import { AdwTabPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwTabPage**

Implements `GtkAccessible`.

## Props

`ref` receives the `Adw.TabPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleRole`

`Gtk.AccessibleRole` · default `GTK_ACCESSIBLE_ROLE_NONE` · from `GtkAccessible`

The accessible role of the given `GtkAccessible` implementation.

The accessible role cannot be changed once set.

### `child`

`Gtk.Widget` · construct-only

The child of the page.

### `icon`

`Gio.Icon | ReactElement`

The icon of the page.

`TabBar` and `TabOverview` display the icon next to the title,
unless `TabPage.loading` is set to `TRUE`.

`AdwTabBar` also won't show the icon if the page is pinned and
[propertyTabPage:indicator-icon] is set.

### `indicatorActivatable`

`boolean` · default `false`

Whether the indicator icon is activatable.

If set to `TRUE`, `TabView.indicator-activated` will be emitted
when the indicator icon is clicked.

If `TabPage.indicatorIcon` is not set, does nothing.

### `indicatorIcon`

`Gio.Icon | ReactElement`

An indicator icon for the page.

A common use case is an audio or camera indicator in a web browser.

`TabBar` will show it at the beginning of the tab, alongside icon
representing `TabPage.icon` or loading spinner.

If the page is pinned, the indicator will be shown instead of icon or
spinner.

`TabOverview` will show it at the at the top part of the thumbnail.

`TabPage.indicatorTooltip` can be used to set the tooltip on the
indicator icon.

If `TabPage.indicatorActivatable` is set to `TRUE`, the
indicator icon can act as a button.

### `indicatorTooltip`

`string`

The tooltip of the indicator icon.

The tooltip can be marked up with the Pango text markup language.

See `TabPage.indicatorIcon`.

_Available since 1.2._

### `keyword`

`string`

The search keyboard of the page.

`TabOverview` can search pages by their keywords in addition to their
titles and tooltips.

Keywords allow to include e.g. page URLs into tab search in a web browser.

_Available since 1.3._

### `liveThumbnail`

`boolean` · default `false`

Whether to enable live thumbnail for this page.

When set to `TRUE`, the page's thumbnail in `TabOverview` will update
immediately when the page is redrawn or resized.

If it's set to `FALSE`, the thumbnail will only be live when the page is
selected, and otherwise it will be static and will only update when
`TabPage.invalidateThumbnail()` or
`TabView.invalidateThumbnails()` is called.

_Available since 1.3._

### `loading`

`boolean` · default `false`

Whether the page is loading.

If set to `TRUE`, `TabBar` and `TabOverview` will display a
spinner in place of icon.

If the page is pinned and `TabPage.indicatorIcon` is set,
loading status will not be visible with `AdwTabBar`.

### `needsAttention`

`boolean` · default `false`

Whether the page needs attention.

`TabBar` will display a line under the tab representing the page if
set to `TRUE`. If the tab is not visible, the corresponding edge of the tab
bar will be highlighted.

`TabOverview` will display a dot in the corner of the thumbnail if set
to `TRUE`.

`TabButton` will display a dot if any of the pages that aren't
selected have this property set to `TRUE`.

### `parent`

`Adw.TabPage` · construct-only

The parent page of the page.

See `TabView.addPage()` and `TabView.closePage()`.

### `pinned`

`boolean` · default `false` · read-only, observe with `onNotifyPinned`

Whether the page is pinned.

See `TabView.setPagePinned()`.

### `selected`

`boolean` · default `false` · read-only, observe with `onNotifySelected`

Whether the page is selected.

### `thumbnailXalign`

`number` · default `0.000000`

The horizontal alignment of the page thumbnail.

If the page is so wide that `TabOverview` can't display it completely
and has to crop it, horizontal alignment will determine which part of the
page will be visible.

For example, 0.5 means the center of the page will be visible, 0 means the
start edge will be visible and 1 means the end edge will be visible.

The default horizontal alignment is 0.

_Available since 1.3._

### `thumbnailYalign`

`number` · default `0.000000`

The vertical alignment of the page thumbnail.

If the page is so tall that `TabOverview` can't display it completely
and has to crop it, vertical alignment will determine which part of the
page will be visible.

For example, 0.5 means the center of the page will be visible, 0 means the
top edge will be visible and 1 means the bottom edge will be visible.

The default vertical alignment is 0.

_Available since 1.3._

### `title`

`string`

The title of the page.

`TabBar` will display it in the center of the tab unless it's pinned,
and will use it as a tooltip unless `TabPage.tooltip` is set.

`TabOverview` will display it below the thumbnail unless it's pinned,
or inside the card otherwise, and will use it as a tooltip unless
`TabPage.tooltip` is set.

### `tooltip`

`string`

The tooltip of the page.

The tooltip can be marked up with the Pango text markup language.

If not set, `TabBar` and `TabOverview` will use
`TabPage.title` as a tooltip instead.

## Methods

Methods are called on the `Adw.TabPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget
```

Gets the child of `self`.

**Returns** the child of `self`

### `getIcon`

```ts
getIcon(): Gio.Icon | null
```

Gets the icon of `self`.

**Returns** the icon of `self`

### `getIndicatorActivatable`

```ts
getIndicatorActivatable(): boolean
```

Gets whether the indicator of `self` is activatable.

**Returns** whether the indicator is activatable

### `getIndicatorIcon`

```ts
getIndicatorIcon(): Gio.Icon | null
```

Gets the indicator icon of `self`.

**Returns** the indicator icon of `self`

### `getIndicatorTooltip`

```ts
getIndicatorTooltip(): string
```

Gets the tooltip of the indicator icon of `self`.

**Returns** the indicator tooltip of `self`

_Available since 1.2._

### `getKeyword`

```ts
getKeyword(): string | null
```

Gets the search keyword of `self`.

**Returns** the search keyword of `self`

_Available since 1.3._

### `getLiveThumbnail`

```ts
getLiveThumbnail(): boolean
```

Gets whether to live thumbnail is enabled `self`.

**Returns** whether live thumbnail is enabled

_Available since 1.3._

### `getLoading`

```ts
getLoading(): boolean
```

Gets whether `self` is loading.

**Returns** whether `self` is loading

### `getNeedsAttention`

```ts
getNeedsAttention(): boolean
```

Gets whether `self` needs attention.

**Returns** whether `self` needs attention

### `getParent`

```ts
getParent(): Adw.TabPage | null
```

Gets the parent page of `self`.

See `TabView.addPage()` and `TabView.closePage()`.

**Returns** the parent page

### `getPinned`

```ts
getPinned(): boolean
```

Gets whether `self` is pinned.

See `TabView.setPagePinned()`.

**Returns** whether `self` is pinned

### `getSelected`

```ts
getSelected(): boolean
```

Gets whether `self` is selected.

**Returns** whether `self` is selected

### `getThumbnailXalign`

```ts
getThumbnailXalign(): number
```

Gets the horizontal alignment of the thumbnail for `self`.

**Returns** the horizontal alignment

_Available since 1.3._

### `getThumbnailYalign`

```ts
getThumbnailYalign(): number
```

Gets the vertical alignment of the thumbnail for `self`.

**Returns** the vertical alignment

_Available since 1.3._

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title of `self`

### `getTooltip`

```ts
getTooltip(): string | null
```

Gets the tooltip of `self`.

**Returns** the tooltip of `self`

### `invalidateThumbnail`

```ts
invalidateThumbnail(): void
```

Invalidates thumbnail for `self`.

If an `TabOverview` is open, the thumbnail representing `self` will be
immediately updated. Otherwise it will be update when opening the overview.

Does nothing if `TabPage.liveThumbnail` is set to `TRUE`.

See also `TabView.invalidateThumbnails()`.

_Available since 1.3._

### `setIcon`

```ts
setIcon(icon: Gio.Icon | null): void
```

Sets the icon of `self`.

`TabBar` and `TabOverview` display the icon next to the title,
unless `TabPage.loading` is set to `TRUE`.

`AdwTabBar` also won't show the icon if the page is pinned and
[propertyTabPage:indicator-icon] is set.

**Parameters**

- `icon`: the icon of `self`

### `setIndicatorActivatable`

```ts
setIndicatorActivatable(activatable: boolean): void
```

Sets whether the indicator of `self` is activatable.

If set to `TRUE`, `TabView.indicator-activated` will be emitted
when the indicator icon is clicked.

If `TabPage.indicatorIcon` is not set, does nothing.

**Parameters**

- `activatable`: whether the indicator is activatable

### `setIndicatorIcon`

```ts
setIndicatorIcon(indicatorIcon: Gio.Icon | null): void
```

Sets the indicator icon of `self`.

A common use case is an audio or camera indicator in a web browser.

`TabBar` will show it at the beginning of the tab, alongside icon
representing `TabPage.icon` or loading spinner.

If the page is pinned, the indicator will be shown instead of icon or
spinner.

`TabOverview` will show it at the at the top part of the thumbnail.

`TabPage.indicatorTooltip` can be used to set the tooltip on the
indicator icon.

If `TabPage.indicatorActivatable` is set to `TRUE`, the
indicator icon can act as a button.

**Parameters**

- `indicatorIcon`: the indicator icon of `self`

### `setIndicatorTooltip`

```ts
setIndicatorTooltip(tooltip: string): void
```

Sets the tooltip of the indicator icon of `self`.

The tooltip can be marked up with the Pango text markup language.

See `TabPage.indicatorIcon`.

**Parameters**

- `tooltip`: the indicator tooltip of `self`

_Available since 1.2._

### `setKeyword`

```ts
setKeyword(keyword: string): void
```

Sets the search keyword for `self`.

`TabOverview` can search pages by their keywords in addition to their
titles and tooltips.

Keywords allow to include e.g. page URLs into tab search in a web browser.

**Parameters**

- `keyword`: the search keyword

_Available since 1.3._

### `setLiveThumbnail`

```ts
setLiveThumbnail(liveThumbnail: boolean): void
```

Sets whether to enable live thumbnail for `self`.

When set to `TRUE`, `self`'s thumbnail in `TabOverview` will update
immediately when `self` is redrawn or resized.

If it's set to `FALSE`, the thumbnail will only be live when the `self` is
selected, and otherwise it will be static and will only update when
`TabPage.invalidateThumbnail()` or
`TabView.invalidateThumbnails()` is called.

**Parameters**

- `liveThumbnail`: whether to enable live thumbnail

_Available since 1.3._

### `setLoading`

```ts
setLoading(loading: boolean): void
```

Sets whether `self` is loading.

If set to `TRUE`, `TabBar` and `TabOverview` will display a
spinner in place of icon.

If the page is pinned and `TabPage.indicatorIcon` is set, loading
status will not be visible with `AdwTabBar`.

**Parameters**

- `loading`: whether `self` is loading

### `setNeedsAttention`

```ts
setNeedsAttention(needsAttention: boolean): void
```

Sets whether `self` needs attention.

`TabBar` will display a line under the tab representing the page if
set to `TRUE`. If the tab is not visible, the corresponding edge of the tab
bar will be highlighted.

`TabOverview` will display a dot in the corner of the thumbnail if set
to `TRUE`.

`TabButton` will display a dot if any of the pages that aren't
selected have `TabPage.needsAttention` set to `TRUE`.

**Parameters**

- `needsAttention`: whether `self` needs attention

### `setThumbnailXalign`

```ts
setThumbnailXalign(xalign: number): void
```

Sets the horizontal alignment of the thumbnail for `self`.

If the page is so wide that `TabOverview` can't display it completely
and has to crop it, horizontal alignment will determine which part of the
page will be visible.

For example, 0.5 means the center of the page will be visible, 0 means the
start edge will be visible and 1 means the end edge will be visible.

The default horizontal alignment is 0.

**Parameters**

- `xalign`: the new value

_Available since 1.3._

### `setThumbnailYalign`

```ts
setThumbnailYalign(yalign: number): void
```

Sets the vertical alignment of the thumbnail for `self`.

If the page is so tall that `TabOverview` can't display it completely
and has to crop it, vertical alignment will determine which part of the page
will be visible.

For example, 0.5 means the center of the page will be visible, 0 means the
top edge will be visible and 1 means the bottom edge will be visible.

The default vertical alignment is 0.

**Parameters**

- `yalign`: the new value

_Available since 1.3._

### `setTitle`

```ts
setTitle(title: string): void
```

`TabBar` will display it in the center of the tab unless it's pinned,
and will use it as a tooltip unless `TabPage.tooltip` is set.

`TabOverview` will display it below the thumbnail unless it's pinned,
or inside the card otherwise, and will use it as a tooltip unless
`TabPage.tooltip` is set.

Sets the title of `self`.

**Parameters**

- `title`: the title of `self`

### `setTooltip`

```ts
setTooltip(tooltip: string): void
```

Sets the tooltip of `self`.

The tooltip can be marked up with the Pango text markup language.

If not set, `TabBar` and `TabOverview` will use
`TabPage.title` as a tooltip instead.

**Parameters**

- `tooltip`: the tooltip of `self`
