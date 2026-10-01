---
description: "Supports compose sequences, dead keys and numeric Unicode input."
---

# GtkIMContextSimple

Supports compose sequences, dead keys and numeric Unicode input.

### Compose sequences

`GtkIMContextSimple` reads compose sequences from the first of the
following files that is found: ~/.config/gtk-4.0/Compose, ~/.XCompose,
/usr/share/X11/locale/$locale/Compose (for locales that have a nontrivial
Compose file). A subset of the file syntax described in the Compose(5)
manual page is supported. Additionally, `include "%L"` loads GTK’s built-in
table of compose sequences rather than the locale-specific one from X11.

If none of these files is found, `GtkIMContextSimple` uses a built-in table
of compose sequences that is derived from the X11 Compose files.

Note that compose sequences typically start with the Compose_key, which is
often not available as a dedicated key on keyboards. Keyboard layouts may
map this keysym to other keys, such as the right Control key.

### Unicode characters

`GtkIMContextSimple` also supports numeric entry of Unicode characters
by typing <kbd>Ctrl</kbd>-<kbd>Shift</kbd>-<kbd>u</kbd>, followed by a
hexadecimal Unicode codepoint.

For example,

    Ctrl-Shift-u 1 2 3 Enter

yields U+0123 LATIN SMALL LETTER G WITH CEDILLA, i.e. ģ.

### Dead keys

`GtkIMContextSimple` supports dead keys. For example, typing

    dead_acute a

 yields U+00E! LATIN SMALL LETTER_A WITH ACUTE, i.e. á. Note that this
 depends on the keyboard layout including dead keys.

```tsx
import { GtkIMContextSimple } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkIMContext](.gtkx/reference/gtk/im-context.md) → **GtkIMContextSimple**

## Props

`ref` receives the `Gtk.IMContextSimple` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.IMContextSimple` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addComposeFile`

```ts
addComposeFile(composeFile: string): void
```

Adds an additional table from the X11 compose file.

**Parameters**

- `composeFile`: The path of compose file
