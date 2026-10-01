---
description: "A page-based navigation container."
---

# AdwNavigationView

A page-based navigation container.



`AdwNavigationView` presents one child at a time, similar to
`Gtk.Stack`.

`AdwNavigationView` can only contain `NavigationPage` children.

It maintains a navigation stack that can be controlled with
`NavigationView.push()` and `NavigationView.pop()`. The whole
navigation stack can also be replaced using `NavigationView.replace()`.

`AdwNavigationView` allows to manage pages statically or dynamically.

Static pages can be added using the `NavigationView.add()` method. The
`AdwNavigationView` will keep a reference to these pages, but they aren't
accessible to the user until `NavigationView.push()` is called (except
for the first page, which is pushed automatically). Use the
`NavigationView.remove()` method to remove them. This is useful for
applications that have a small number of unique pages and just need
navigation between them.

Dynamic pages are automatically destroyed once they are popped off the
navigation stack. To add a page like this, push it using the
`NavigationView.push()` method without calling
`NavigationView.add()` first.

### Tags

Static pages, as well as any pages in the navigation stack, can be accessed
by their `NavigationPage.tag`. For example,
`NavigationView.pushByTag()` can be used to push a static page that's
not in the navigation stack without having to keep a reference to it manually.

### Header Bar Integration

When used inside `AdwNavigationView`, `HeaderBar` will automatically
display a back button that can be used to go back to the previous page when
possible. The button also has a context menu, allowing to pop multiple pages
at once, potentially across multiple navigation views.

Set `HeaderBar.showBackButton` to `FALSE` to disable this behavior
in rare scenarios where it's unwanted.

`AdwHeaderBar` will also display the title of the `AdwNavigationPage` it's
placed into, so most applications shouldn't need to customize it at all.

### Shortcuts and Gestures

`AdwNavigationView` supports the following shortcuts for going to the
previous page:

- <kbd>Escape</kbd> (unless `NavigationView.popOnEscape` is set to
  `FALSE`)
- <kbd>Alt</kbd>+<kbd>←</kbd>
- Back mouse button

Additionally, it supports interactive gestures:

- One-finger swipe towards the right on touchscreens
- Scrolling towards the right on touchpads (usually two-finger swipe)

These gestures have transitions enabled regardless of the
`NavigationView.animateTransitions` value.

Applications can also enable shortcuts for pushing another page onto the
navigation stack via connecting to the `NavigationView.get-next-page`
signal, in that case the following shortcuts are supported:

- <kbd>Alt</kbd>+<kbd>→</kbd>
- Forward mouse button
- Swipe/scrolling towards the left

For right-to-left locales, the gestures and shortcuts are reversed.

`NavigationPage.canPop` can be used to disable them, along with the
header bar back buttons.

### Actions

`AdwNavigationView` defines actions for controlling the navigation stack.
actions for controlling the navigation stack:

- `navigation.push` takes a string parameter specifying the tag of the page to
push, and is equivalent to calling `NavigationView.pushByTag()`.

- `navigation.pop` doesn't take any parameters and pops the current page from
the navigation stack, equivalent to calling `NavigationView.pop()`.

### `AdwNavigationView` as `GtkBuildable`

`AdwNavigationView` allows to add pages as children, equivalent to using the
`NavigationView.add()` method.

Example of an `AdwNavigationView` UI definition:

```xml
<object class="AdwNavigationView">
  <child>
    <object class="AdwNavigationPage">
      <property name="title" translatable="yes">Page 1</property>
      <property name="child">
        <object class="AdwToolbarView">
          <child type="top">
            <object class="AdwHeaderBar"/>
          </child>
          <property name="content">
            <object class="GtkButton">
              <property name="label" translatable="yes">Open Page 2</property>
              <property name="halign">center</property>
              <property name="valign">center</property>
              <property name="action-name">navigation.push</property>
              <property name="action-target">'page-2'</property>
              <style>
                <class name="pill"/>
               </style>
            </object>
          </property>
        </object>
      </property>
    </object>
  </child>
  <child>
    <object class="AdwNavigationPage">
      <property name="title" translatable="yes">Page 2</property>
      <property name="tag">page-2</property>
      <property name="child">
        <object class="AdwToolbarView">
          <child type="top">
            <object class="AdwHeaderBar"/>
          </child>
          <property name="content">
            <!-- ... -->
          </property>
        </object>
      </property>
    </object>
  </child>
</object>
```



### CSS nodes

`AdwNavigationView` has a single CSS node with the name `navigation-view`.

### Accessibility

`AdwNavigationView` uses the `Gtk.AccessibleRole.group` role.

_Available since 1.4._

```tsx
import { AdwNavigationView } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwNavigationView**

Implements `AdwSwipeable`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.NavigationView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `animateTransitions`

`boolean` · default `true`

Whether to animate page transitions.

Gesture-based transitions are always animated.

_Available since 1.4._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `hhomogeneous`

`boolean` · default `false`

Whether the view is horizontally homogeneous.

If the view is horizontally homogeneous, it allocates the same width for
all pages.

If it's not, the page may change width when a different page becomes
visible.

_Available since 1.7._

### `navigationStack`

`Gio.ListModel` · read-only, observe with `onNotifyNavigationStack`

A list model that contains the pages in navigation stack.

The pages are sorted from root page to visible page.

This can be used to keep an up-to-date view.

_Available since 1.4._

### `popOnEscape`

`boolean` · default `true`

Whether pressing Escape pops the current page.

Applications using `AdwNavigationView` to implement a browser may want to
disable it.

_Available since 1.4._

### `vhomogeneous`

`boolean` · default `false`

Whether the view is vertically homogeneous.

If the view is vertically homogeneous, it allocates the same height for
all pages.

If it's not, the view may change height when a different page becomes
visible.

_Available since 1.7._

### `visiblePage`

`Adw.NavigationPage` · read-only, observe with `onNotifyVisiblePage`

The currently visible page.

_Available since 1.4._

### `visiblePageTag`

`string` · default `null` · read-only, observe with `onNotifyVisiblePageTag`

The tag of the currently visible page.

_Available since 1.7._

## Signals

### `onGetNextPage`

```ts
(self: Adw.NavigationView) => Adw.NavigationPage | null | undefined
```

Emitted when a push shortcut or a gesture is triggered.

To support the push shortcuts and gestures, the application is expected to
return the page to push in the handler.

This signal can be emitted multiple times for the gestures, for example
when the gesture is cancelled by the user. As such, the application must
not make any irreversible changes in the handler, such as removing the page
from a forward stack.

Instead, it should be done in the `NavigationView.pushed` handler.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** the page to push

_Available since 1.4._

### `onPopped`

```ts
(page: Adw.NavigationPage, self: Adw.NavigationView) => void
```

Emitted after `page` has been popped from the navigation stack.

See `NavigationView.pop()`.

When using `NavigationView.popToPage()` or
`NavigationView.popToTag()`, this signal is emitted for each of the
popped pages.

**Parameters**

- `page`: the popped page
- `self`: The instance the signal was emitted on.

_Available since 1.4._

### `onPushed`

```ts
(self: Adw.NavigationView) => void
```

Emitted after a page has been pushed to the navigation stack.

See `NavigationView.push()`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

### `onReplaced`

```ts
(self: Adw.NavigationView) => void
```

Emitted after the navigation stack has been replaced.

See `NavigationView.replace()`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

## Methods

Methods are called on the `Adw.NavigationView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(page: Adw.NavigationPage): void
```

Permanently adds `page` to `self`.

Any page that has been added will stay in `self` even after being popped from
the navigation stack.

Adding a page while no page is visible will automatically push it to the
navigation stack.

See `NavigationView.remove()`.

**Parameters**

- `page`: the page to add

_Available since 1.4._

### `findPage`

```ts
findPage(tag: string): Adw.NavigationPage | null
```

Finds a page in `self` by its tag.

See `NavigationPage.tag`.

**Parameters**

- `tag`: a page tag

**Returns** the page with the given tag

_Available since 1.4._

### `getAnimateTransitions`

```ts
getAnimateTransitions(): boolean
```

Gets whether `self` animates page transitions.

**Returns** whether to animate page transitions

_Available since 1.4._

### `getHhomogeneous`

```ts
getHhomogeneous(): boolean
```

Gets whether `self` is horizontally homogeneous.

**Returns** whether `self` is horizontally homogeneous

_Available since 1.7._

### `getNavigationStack`

```ts
getNavigationStack(): Gio.ListModel
```

Returns a `Gio.ListModel` that contains the pages in navigation stack.

The pages are sorted from root page to visible page.

This can be used to keep an up-to-date view.

**Returns** a list model for the navigation stack

_Available since 1.4._

### `getPopOnEscape`

```ts
getPopOnEscape(): boolean
```

Gets whether pressing Escape pops the current page on `self`.

**Returns** whether to pop the current page

_Available since 1.4._

### `getPreviousPage`

```ts
getPreviousPage(page: Adw.NavigationPage): Adw.NavigationPage | null
```

Gets the previous page for `page`.

If `page` is in the navigation stack, returns the page popping `page` will
reveal.

If `page` is the root page or is not in the navigation stack, returns `NULL`.

**Parameters**

- `page`: a page in `self`

**Returns** the previous page

_Available since 1.4._

### `getVhomogeneous`

```ts
getVhomogeneous(): boolean
```

Gets whether `self` is vertically homogeneous.

**Returns** whether `self` is vertically homogeneous

_Available since 1.7._

### `getVisiblePage`

```ts
getVisiblePage(): Adw.NavigationPage | null
```

Gets the currently visible page in `self`.

**Returns** the currently visible page

_Available since 1.4._

### `getVisiblePageTag`

```ts
getVisiblePageTag(): string | null
```

Gets the tag of the currently visible page in `self`.

**Returns** the tag of the currently visible page

_Available since 1.7._

### `pop`

```ts
pop(): boolean
```

Pops the visible page from the navigation stack.

Does nothing if the navigation stack contains less than two pages.

If `NavigationView.add()` hasn't been called, the page is automatically
removed.

`NavigationView.popped` will be emitted for the current visible page.

See `NavigationView.popToPage()` and
`NavigationView.popToTag()`.

**Returns** `TRUE` if a page has been popped

_Available since 1.4._

### `popToPage`

```ts
popToPage(page: Adw.NavigationPage): boolean
```

Pops pages from the navigation stack until `page` is visible.

`page` must be in the navigation stack.

If `NavigationView.add()` hasn't been called for any of the popped pages,
they are automatically removed.

`NavigationView.popped` will be be emitted for each of the popped
pages.

See `NavigationView.pop()` and `NavigationView.popToTag()`.

**Parameters**

- `page`: the page to pop to

**Returns** `TRUE` if any pages have been popped

_Available since 1.4._

### `popToTag`

```ts
popToTag(tag: string): boolean
```

Pops pages from the navigation stack until page with the tag `tag` is visible.

The page must be in the navigation stack.

If `NavigationView.add()` hasn't been called for any of the popped pages,
they are automatically removed.

`NavigationView.popped` will be emitted for each of the popped pages.

See `NavigationView.popToPage()` and `NavigationPage.tag`.

**Parameters**

- `tag`: a page tag

**Returns** `TRUE` if any pages have been popped

_Available since 1.4._

### `push`

```ts
push(page: Adw.NavigationPage): void
```

Pushes `page` onto the navigation stack.

If `NavigationView.add()` hasn't been called, the page is automatically
removed once it's popped.

`NavigationView.pushed` will be emitted for `page`.

See `NavigationView.pushByTag()`.

**Parameters**

- `page`: the page to push

_Available since 1.4._

### `pushByTag`

```ts
pushByTag(tag: string): void
```

Pushes the page with the tag `tag` onto the navigation stack.

If `NavigationView.add()` hasn't been called, the page is automatically
removed once it's popped.

`NavigationView.pushed` will be emitted for the page.

See `NavigationView.push()` and `NavigationPage.tag`.

**Parameters**

- `tag`: the page tag

_Available since 1.4._

### `remove`

```ts
remove(page: Adw.NavigationPage): void
```

Removes `page` from `self`.

If `page` is currently in the navigation stack, it will be removed once it's
popped. Otherwise, it's removed immediately.

See `NavigationView.add()`.

**Parameters**

- `page`: the page to remove

_Available since 1.4._

### `replace`

```ts
replace(pages: Adw.NavigationPage[]): void
```

Replaces the current navigation stack with `pages`.

The last page becomes the visible page.

Replacing the navigation stack has no animation.

If `NavigationView.add()` hasn't been called for any pages that are no
longer in the navigation stack, they are automatically removed.

`n_pages` can be 0, in that case no page will be visible after calling this
method. This can be useful for removing all pages from `self`.

The `NavigationView.replaced` signal will be emitted.

See `NavigationView.replaceWithTags()`.

**Parameters**

- `pages`: the new navigation stack

_Available since 1.4._

### `replaceWithTags`

```ts
replaceWithTags(tags: string[]): void
```

Replaces the current navigation stack with pages with the tags `tags`.

The last page becomes the visible page.

Replacing the navigation stack has no animation.

If `NavigationView.add()` hasn't been called for any pages that are no
longer in the navigation stack, they are automatically removed.

`n_tags` can be 0, in that case no page will be visible after calling this
method. This can be useful for removing all pages from `self`.

The `NavigationView.replaced` signal will be emitted.

See `NavigationView.replace()` and `NavigationPage.tag`.

**Parameters**

- `tags`: tags of the pages in the navigation stack

_Available since 1.4._

### `setAnimateTransitions`

```ts
setAnimateTransitions(animateTransitions: boolean): void
```

Sets whether `self` should animate page transitions.

Gesture-based transitions are always animated.

**Parameters**

- `animateTransitions`: whether to animate page transitions

_Available since 1.4._

### `setHhomogeneous`

```ts
setHhomogeneous(hhomogeneous: boolean): void
```

Sets `self` to be horizontally homogeneous or not.

If the view is horizontally homogeneous, it allocates the same width for
all pages.

If it's not, the view may change width when a different page becomes visible.

**Parameters**

- `hhomogeneous`: whether to make `self` horizontally homogeneous

_Available since 1.7._

### `setPopOnEscape`

```ts
setPopOnEscape(popOnEscape: boolean): void
```

Sets whether pressing Escape pops the current page on `self`.

Applications using `AdwNavigationView` to implement a browser may want to
disable it.

**Parameters**

- `popOnEscape`: whether to pop the current page when pressing Escape

_Available since 1.4._

### `setVhomogeneous`

```ts
setVhomogeneous(vhomogeneous: boolean): void
```

Sets `self` to be vertically homogeneous or not.

If the view is vertically homogeneous, it allocates the same height for
all pages.

If it's not, the view may change height when a different page becomes
visible.

**Parameters**

- `vhomogeneous`: whether to make `self` vertically homogeneous

_Available since 1.7._
