---
description: "The context of a completion."
---

# GtkSourceCompletionContext

The context of a completion.

`GtkSourceCompletionContext` contains information about an attept to display
completion proposals to the user based on typed text in the `View`.

When typing, `Completion` may use registered
`CompletionProvider` to determine if there may be results which
could be displayed. If so, a `GtkSourceCompletionContext` is created with
information that is provided to the `CompletionProvider` to populate
results which might be useful to the user.

`CompletionProvider` are expected to provide `Gio.ListModel` with
`CompletionProposal` which may be joined together in a list of
results for the user. They are also responsible for how the contents are
displayed using `CompletionCell` which allows for some level of
customization.

```tsx
import { GtkSourceCompletionContext } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceCompletionContext**

Implements `GListModel`.

## Props

`ref` receives the `GtkSource.CompletionContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `busy`

`boolean` · default `false` · read-only, observe with `onNotifyBusy`

The "busy" property is `true` while the completion context is
populating completion proposals.

### `completion`

`GtkSource.Completion` · construct-only

The "completion" is the `GtkSourceCompletion` that was used to create the context.

### `empty`

`boolean` · default `true` · read-only, observe with `onNotifyEmpty`

The "empty" property is `true` when there are no results.

It will be notified when the first result is added or the last
result is removed.

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: GtkSource.CompletionContext) => void
```

From `GListModel`.

This signal is emitted whenever items were added to or removed
from `list`. At `position`, `removed` items were removed and `added`
items were added in their place.

Note: If `removed != added`, the positions of all later items
in the model change.

**Parameters**

- `position`: the position at which `list` changed
- `removed`: the number of items removed
- `added`: the number of items added
- `self`: The instance the signal was emitted on.

_Available since 2.44._

### `onProviderModelChanged`

```ts
(provider: GtkSource.CompletionProvider, model: Gio.ListModel | null, self: GtkSource.CompletionContext) => void
```

Emitted when a provider changes a model.

This signal is primarily useful for `GtkSourceCompletionProvider`'s
that want to track other providers in context. For example, it can
be used to create a "top results" provider.

**Parameters**

- `provider`: a `GtkSourceCompletionProvider`
- `model`: a `GListModel`
- `self`: The instance the signal was emitted on.

_Available since 5.6._

## Methods

Methods are called on the `GtkSource.CompletionContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getActivation`

```ts
getActivation(): GtkSource.CompletionActivation
```

Gets the mode for which the context was activated.

### `getBounds`

```ts
getBounds(): [boolean, Gtk.TextIter, Gtk.TextIter]
```

Gets the bounds for the completion, which is the beginning of the
current word (taking break characters into account) to the current
insertion cursor.

If `begin` is non-`null`, it will be set to the start position of the
current word being completed.

If `end` is non-`null`, it will be set to the insertion cursor for the
current word being completed.

**Returns** Tuple of:

- `result`: `true` if the marks are still valid and `begin` or `end` was set.
- `begin`: a `GtkTextIter`
- `end`: a `GtkTextIter`

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer | null
```

Gets the underlying buffer used by the context.

This is a convenience function to get the buffer via the `GtkSourceCompletion`
property.

**Returns** a `GtkTextBuffer` or `null`

### `getBusy`

```ts
getBusy(): boolean
```

Gets the "busy" property. This is set to `true` while the completion
context is actively fetching proposals from registered
`GtkSourceCompletionProvider`'s.

**Returns** `true` if the context is busy

### `getCompletion`

```ts
getCompletion(): GtkSource.Completion | null
```

Gets the `GtkSourceCompletion` that created the context.

**Returns** an `GtkSourceCompletion` or `null`

### `getEmpty`

```ts
getEmpty(): boolean
```

Checks if any proposals have been provided to the context.

Out of convenience, this function will return `true` if `self` is `null`.

**Returns** `true` if there are no proposals in the context

### `getLanguage`

```ts
getLanguage(): GtkSource.Language | null
```

Gets the language of the underlying buffer, if any.

**Returns** a `GtkSourceLanguage` or `null`

### `getProposalsForProvider`

```ts
getProposalsForProvider(provider: GtkSource.CompletionProvider): Gio.ListModel | null
```

Gets the `GListModel` associated with the provider.

You can connect to `GtkSourceCompletionContext.model-changed` to receive
notifications about when the model has been replaced by a new model.

**Parameters**

- `provider`: a `GtkSourceCompletionProvider`

**Returns** a `GListModel` or `null`

_Available since 5.6._

### `getView`

```ts
getView(): GtkSource.View | null
```

Gets the text view for the context.

**Returns** a `GtkSourceView` or `null`

### `getWord`

```ts
getWord(): string
```

Gets the word that is being completed up to the position of the insert mark.

**Returns** a string containing the current word

### `listProviders`

```ts
listProviders(): Gio.ListModel
```

Gets the providers that are associated with the context.

**Returns** a `GListModel` of `GtkSourceCompletionProvider`

_Available since 5.6._

### `setProposalsForProvider`

```ts
setProposalsForProvider(provider: GtkSource.CompletionProvider, results: Gio.ListModel | null): void
```

This function allows providers to update their results for a context
outside of a call to `CompletionProvider.populateAsync()`.

This can be used to immediately return results for a provider while it does
additional asynchronous work. Doing so will allow the completions to
update while the operation is in progress.

**Parameters**

- `provider`: an `GtkSourceCompletionProvider`
- `results`: a `GListModel` or `null`
