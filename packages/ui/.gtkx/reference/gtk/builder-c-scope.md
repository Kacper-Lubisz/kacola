---
description: "A GtkBuilderScope implementation for the C language."
---

# GtkBuilderCScope

A `GtkBuilderScope` implementation for the C language.

`GtkBuilderCScope` instances use symbols explicitly added to `builder`
with prior calls to `Gtk.BuilderCScope.addCallbackSymbol()`.
If developers want to do that, they are encouraged to create their
own scopes for that purpose.

In the case that symbols are not explicitly added; GTK will uses
`GModule`’s introspective features (by opening the module `null`) to
look at the application’s symbol table. From here it tries to match
the signal function names given in the interface description with
symbols in the application.

Note that unless `Gtk.BuilderCScope.addCallbackSymbol()` is
called for all signal callbacks which are referenced by the loaded XML,
this functionality will require that `GModule` be supported on the platform.

```tsx
import { GtkBuilderCScope } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkBuilderCScope**

Implements `GtkBuilderScope`.

## Props

`ref` receives the `Gtk.BuilderCScope` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.BuilderCScope` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addCallbackSymbol`

```ts
addCallbackSymbol(callbackName: string, callbackSymbol: GObject.Callback): void
```

Adds the `callback_symbol` to the scope of `builder` under the
given `callback_name`.

Using this function overrides the behavior of
`Gtk.Builder.createClosure()` for any callback symbols that
are added. Using this method allows for better encapsulation as it
does not require that callback symbols be declared in the global
namespace.

**Parameters**

- `callbackName`: The name of the callback, as expected in the XML
- `callbackSymbol`: The callback pointer
