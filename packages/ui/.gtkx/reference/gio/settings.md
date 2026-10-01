---
description: "The GSettings class provides a convenient API for storing and retrieving application settings."
---

# GSettings

The `GSettings` class provides a convenient API for storing and retrieving
application settings.

Reads and writes can be considered to be non-blocking.  Reading
settings with `GSettings` is typically extremely fast: on
approximately the same order of magnitude (but slower than) a
`GLib.HashTable` lookup.  Writing settings is also extremely fast in
terms of time to return to your application, but can be extremely expensive
for other threads and other processes.  Many settings backends
(including dconf) have lazy initialisation which means in the common
case of the user using their computer without modifying any settings
a lot of work can be avoided.  For dconf, the D-Bus service doesn’t
even need to be started in this case.  For this reason, you should
only ever modify `GSettings` keys in response to explicit user action.
Particular care should be paid to ensure that modifications are not
made during startup — for example, when setting the initial value
of preferences widgets.  The built-in `Gio.Settings.bind()`
functionality is careful not to write settings in response to notify signals
as a result of modifications that it makes to widgets.

When creating a `GSettings` instance, you have to specify a schema
that describes the keys in your settings and their types and default
values, as well as some other information.

Normally, a schema has a fixed path that determines where the settings
are stored in the conceptual global tree of settings. However, schemas
can also be ‘[relocatable](`relocatable`-schemas)’, i.e. not equipped with
a fixed path. This is
useful e.g. when the schema describes an ‘account’, and you want to be
able to store a arbitrary number of accounts.

Paths must start with and end with a forward slash character (`/`)
and must not contain two sequential slash characters.  Paths should
be chosen based on a domain name associated with the program or
library to which the settings belong.  Examples of paths are
`/org/gtk/settings/file-chooser/` and `/ca/desrt/dconf-editor/`.
Paths should not start with `/apps/`, `/desktop/` or `/system/` as
they often did in GConf.

Unlike other configuration systems (like GConf), GSettings does not
restrict keys to basic types like strings and numbers. GSettings stores
values as `GLib.Variant`, and allows any `GLib.VariantType` for
keys. Key names are restricted to lowercase characters, numbers and `-`.
Furthermore, the names must begin with a lowercase character, must not end
with a `-`, and must not contain consecutive dashes.

Similar to GConf, the default values in GSettings schemas can be
localized, but the localized values are stored in gettext catalogs
and looked up with the domain that is specified in the
`gettext-domain` attribute of the `<schemalist>` or `<schema>`
elements and the category that is specified in the `l10n` attribute of
the `<default>` element. The string which is translated includes all text in
the `<default>` element, including any surrounding quotation marks.

The `l10n` attribute must be set to `messages` or `time`, and sets the
[locale category for
translation](https://www.gnu.org/software/gettext/manual/html_node/Aspects.html#index-locale-categories-1).
The `messages` category should be used by default; use `time` for
translatable date or time formats. A translation comment can be added as an
XML comment immediately above the `<default>` element — it is recommended to
add these comments to aid translators understand the meaning and
implications of the default value. An optional translation `context`
attribute can be set on the `<default>` element to disambiguate multiple
defaults which use the same string.

For example:
```xml
 <!-- Translators: A list of words which are not allowed to be typed, in
      GVariant serialization syntax.
      See: https://developer.gnome.org/glib/stable/gvariant-text.html -->
 <default l10n='messages' context='Banned words'>['bad', 'words']</default>
```

Translations of default values must remain syntactically valid serialized
`GLib.Variant`s (e.g. retaining any surrounding quotation marks) or
runtime errors will occur.

GSettings uses schemas in a compact binary form that is created
by the [`glib-compile-schemas`](glib-compile-schemas.html)
utility. The input is a schema description in an XML format.

A DTD for the gschema XML format can be found here:
[gschema.dtd](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/gschema.dtd)

The [`glib-compile-schemas`](glib-compile-schemas.html) tool expects schema
files to have the extension `.gschema.xml`.

At runtime, schemas are identified by their ID (as specified in the
`id` attribute of the `<schema>` element). The convention for schema
IDs is to use a dotted name, similar in style to a D-Bus bus name,
e.g. `org.gnome.SessionManager`. In particular, if the settings are
for a specific service that owns a D-Bus bus name, the D-Bus bus name
and schema ID should match. For schemas which deal with settings not
associated with one named application, the ID should not use
StudlyCaps, e.g. `org.gnome.font-rendering`.

In addition to `GLib.Variant` types, keys can have types that have
enumerated types. These can be described by a `<choice>`,
`<enum>` or `<flags>` element, as seen in the
second example below. The underlying type of such a key
is string, but you can use `Gio.Settings.getEnum()`,
`Gio.Settings.setEnum()`, `Gio.Settings.getFlags()`,
`Gio.Settings.setFlags()` access the numeric values corresponding to
the string value of enum and flags keys.

An example for default value:
```xml
<schemalist>
  <schema id="org.gtk.Test" path="/org/gtk/Test/" gettext-domain="test">

    <key name="greeting" type="s">
      <default l10n="messages">"Hello, earthlings"</default>
      <summary>A greeting</summary>
      <description>
        Greeting of the invading martians
      </description>
    </key>

    <key name="box" type="(ii)">
      <default>(20,30)</default>
    </key>

    <key name="empty-string" type="s">
      <default>""</default>
      <summary>Empty strings have to be provided in GVariant form</summary>
    </key>

  </schema>
</schemalist>
```

An example for ranges, choices and enumerated types:
```xml
<schemalist>

  <enum id="org.gtk.Test.myenum">
    <value nick="first" value="1"/>
    <value nick="second" value="2"/>
  </enum>

  <flags id="org.gtk.Test.myflags">
    <value nick="flag1" value="1"/>
    <value nick="flag2" value="2"/>
    <value nick="flag3" value="4"/>
  </flags>

  <schema id="org.gtk.Test">

    <key name="key-with-range" type="i">
      <range min="1" max="100"/>
      <default>10</default>
    </key>

    <key name="key-with-choices" type="s">
      <choices>
        <choice value='Elisabeth'/>
        <choice value='Annabeth'/>
        <choice value='Joe'/>
      </choices>
      <aliases>
        <alias value='Anna' target='Annabeth'/>
        <alias value='Beth' target='Elisabeth'/>
      </aliases>
      <default>'Joe'</default>
    </key>

    <key name='enumerated-key' enum='org.gtk.Test.myenum'>
      <default>'first'</default>
    </key>

    <key name='flags-key' flags='org.gtk.Test.myflags'>
      <default>["flag1","flag2"]</default>
    </key>
  </schema>
</schemalist>
```

### Vendor overrides

Default values are defined in the schemas that get installed by
an application. Sometimes, it is necessary for a vendor or distributor
to adjust these defaults. Since patching the XML source for the schema
is inconvenient and error-prone,
[`glib-compile-schemas`](glib-compile-schemas.html) reads so-called ‘vendor
override’ files. These are keyfiles in the same directory as the XML
schema sources which can override default values. The schema ID serves
as the group name in the key file, and the values are expected in
serialized `GLib.Variant` form, as in the following example:
```
[org.gtk.Example]
key1='string'
key2=1.5
```

`glib-compile-schemas` expects schema files to have the extension
`.gschema.override`.

### Delay-apply mode

By default, values set on a `Gio.Settings` instance immediately start
to be written to the backend (although these writes may not complete by the
time that `Gio.Settings.set()`) returns; see `Gio.Settings.sync()`).

In order to allow groups of settings to be changed simultaneously and
atomically, GSettings also supports a ‘delay-apply’ mode. In this mode,
updated values are kept locally in the `Gio.Settings` instance until
they are explicitly applied by calling `Gio.Settings.apply()`.

For example, this could be useful for a preferences dialog where the
preferences all need to be applied simultaneously when the user clicks ‘Save’.

Switching a `Gio.Settings` instance to ‘delay-apply’ mode is a one-time
irreversible operation: from that point onwards, *all* changes made to that
`Gio.Settings` have to be explicitly applied by calling
`Gio.Settings.apply()`. The ‘delay-apply’ mode is also propagated to any
child settings objects subsequently created using
`Gio.Settings.getChild()`.

At any point, the set of unapplied changes can be queried using
`Gio.Settings.hasUnapplied`, and discarded by calling
`Gio.Settings.revert()`.

### Binding

A very convenient feature of GSettings lets you bind `GObject.Object`
properties directly to settings, using `Gio.Settings.bind()`. Once a
`GObject.Object` property has been bound to a setting, changes on
either side are automatically propagated to the other side. GSettings handles
details like mapping between `GObject.Object` and `GLib.Variant`
types, and preventing infinite cycles.

This makes it very easy to hook up a preferences dialog to the
underlying settings. To make this even more convenient, GSettings
looks for a boolean property with the name `sensitivity` and
automatically binds it to the writability of the bound setting.
If this ‘magic’ gets in the way, it can be suppressed with the
`G_SETTINGS_BIND_NO_SENSITIVITY` flag.

### Relocatable schemas

A relocatable schema is one with no `path` attribute specified on its
`<schema>` element. By using `Gio.Settings.newWithPath()`, a `GSettings`
object can be instantiated for a relocatable schema, assigning a path to the
instance. Paths passed to `Gio.Settings.newWithPath()` will typically be
constructed dynamically from a constant prefix plus some form of instance
identifier; but they must still be valid GSettings paths. Paths could also
be constant and used with a globally installed schema originating from a
dependency library.

For example, a relocatable schema could be used to store geometry information
for different windows in an application. If the schema ID was
`org.foo.MyApp.Window`, it could be instantiated for paths
`/org/foo/MyApp/main/`, `/org/foo/MyApp/document-1/`,
`/org/foo/MyApp/document-2/`, etc. If any of the paths are well-known
they can be specified as `<child>` elements in the parent schema, e.g.:
```xml
<schema id="org.foo.MyApp" path="/org/foo/MyApp/">
  <child name="main" schema="org.foo.MyApp.Window"/>
</schema>
```

### Build system integration

#### Meson

GSettings is natively supported by Meson’s [GNOME module](https://mesonbuild.com/Gnome-module.html).

You can install the schemas as any other data file:

```
install_data(
  'org.foo.MyApp.gschema.xml',
  install_dir: get_option('datadir') / 'glib-2.0/schemas',
)
```

You can use `gnome.post_install()` function to compile the schemas on
installation:

```
gnome = import('gnome')
gnome.post_install(
  glib_compile_schemas: true,
)
```

If an enumerated type defined in a C header file is to be used in a GSettings
schema, it can either be defined manually using an `<enum>` element in the
schema XML, or it can be extracted automatically from the C header. This
approach is preferred, as it ensures the two representations are always
synchronised. To do so, you will need to use the `gnome.mkenums()` function
with the following templates:

```
schemas_enums = gnome.mkenums('org.foo.MyApp.enums.xml',
  comments: '<!-- @comment@ -->',
  fhead: '<schemalist>',
  vhead: '  <@type@ id="org.foo.MyApp.@EnumName@">',
  vprod: '    <value nick="@valuenick@" value="@valuenum@"/>',
  vtail: '  </@type@>',
  ftail: '</schemalist>',
  sources: enum_sources,
  install_header: true,
  install_dir: get_option('datadir') / 'glib-2.0/schemas',
)
```

It is recommended to validate your schemas as part of the test suite for
your application:

```
test('validate-schema',
  find_program('glib-compile-schemas'),
  args: ['--strict', '--dry-run', meson.current_source_dir()],
)
```

If your application allows running uninstalled, you should also use the
`gnome.compile_schemas()` function to compile the schemas in the current
build directory:

```
gnome.compile_schemas()
```

#### Autotools

GSettings comes with autotools integration to simplify compiling and
installing schemas. To add GSettings support to an application, add the
following to your `configure.ac`:
```
GLIB_GSETTINGS
```

In the appropriate `Makefile.am`, use the following snippet to compile and
install the named schema:
```
gsettings_SCHEMAS = org.foo.MyApp.gschema.xml
EXTRA_DIST = $(gsettings_SCHEMAS)

@GSETTINGS_RULES@
```

If an enumerated type defined in a C header file is to be used in a GSettings
schema, it can either be defined manually using an `<enum>` element in the
schema XML, or it can be extracted automatically from the C header. This
approach is preferred, as it ensures the two representations are always
synchronised. To do so, add the following to the relevant `Makefile.am`:
```
gsettings_ENUM_NAMESPACE = org.foo.MyApp
gsettings_ENUM_FILES = my-app-enums.h my-app-misc.h
```

`gsettings_ENUM_NAMESPACE` specifies the schema namespace for the enum files,
which are specified in `gsettings_ENUM_FILES`. This will generate a
`org.foo.MyApp.enums.xml` file containing the extracted enums, which will be
automatically included in the schema compilation, install and uninstall
rules. It should not be committed to version control or included in
`EXTRA_DIST`.

### Localization

No changes are needed to the build system to mark a schema XML file for
translation. Assuming it sets the `gettext-domain` attribute, a schema may
be marked for translation by adding it to `POTFILES.in`, assuming gettext
0.19 or newer is in use (the preferred method for translation):
```
data/org.foo.MyApp.gschema.xml
```

Alternatively, if intltool 0.50.1 is in use:
```
[type: gettext/gsettings]data/org.foo.MyApp.gschema.xml
```

GSettings will use gettext to look up translations for the `<summary>` and
`<description>` elements, and also any `<default>` elements which have a
`l10n` attribute set.

Translations **must not** be included in the `.gschema.xml` file by the build
system, for example by using a rule to generate the XML file from a template.

```tsx
import { GSettings } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSettings**

## Props

`ref` receives the `Gio.Settings` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `backend`

`Gio.SettingsBackend` · construct-only

The name of the context that the settings are stored in.

### `delayApply`

`boolean` · default `false` · read-only, observe with `onNotifyDelayApply`

Whether the `Gio.Settings` object is in
[‘delay-apply’ mode](class.Settings.html#delay-apply-mode).

_Available since 2.28._

### `hasUnapplied`

`boolean` · default `false` · read-only, observe with `onNotifyHasUnapplied`

Whether the `Gio.Settings` object has outstanding changes.

These changes will be applied when `Gio.Settings.apply()` is called.

### `path`

`string` · default `null` · construct-only

The path within the backend where the settings are stored.

### `schema`

`string` · default `null` · construct-only · deprecated since 2.32

The name of the schema that describes the types of keys
for this `Gio.Settings` object.

The type of this property is *not* `Gio.SettingsSchema`.
`Gio.SettingsSchema` has only existed since version 2.32 and
unfortunately this name was used in previous versions to refer to
the schema ID rather than the schema itself.  Take care to use the
`Gio.Settings.settingsSchema` property if you wish to pass in a
`Gio.SettingsSchema`.

> **Deprecated since 2.32.** Use the `Gio.Settings.schemaId` property instead. In a future version, this property may instead refer to a `Gio.SettingsSchema`.

### `schemaId`

`string` · default `null` · construct-only

The name of the schema that describes the types of keys
for this `Gio.Settings` object.

### `settingsSchema`

`Gio.SettingsSchema` · construct-only

The `Gio.SettingsSchema` describing the types of keys for this
`Gio.Settings` object.

Ideally, this property would be called `Gio.Settings.schema`.
`Gio.SettingsSchema`
has only existed since version 2.32, however, and before then the
`Gio.Settings.schema` property was used to refer to the ID of the schema rather
than the schema itself.  Take care.

## Signals

### `onChanged`

```ts
(key: string, self: Gio.Settings) => void
```

Emitted when a key has potentially changed.

You should call one of the `Gio.Settings.get()` calls to check the new
value.

This signal supports detailed connections.  You can connect to the
detailed signal `changed::x` in order to only receive callbacks
when key `x` changes.

Note that `settings` only emits this signal if you have read `key` at
least once while a signal handler was already connected for `key`.

**Parameters**

- `key`: the name of the key that changed
- `self`: The instance the signal was emitted on.

### `onChangeEvent`

```ts
(keys: number[] | null, nKeys: number, self: Gio.Settings) => boolean | undefined
```

Emitted once per change event that affects this settings object.

You should connect to this signal
only if you are interested in viewing groups of changes before they
are split out into multiple emissions of the `Gio.Settings.changed` signal.
For most use cases it is more appropriate to use the `Gio.Settings.changed` signal.

In the event that the change event applies to one or more specified
keys, `keys` will be an array of `GLib.Quark`s of length `n_keys`.  In the
event that the change event applies to the `Gio.Settings` object as a
whole (ie: potentially every key has been changed) then `keys` will
be `NULL` and `n_keys` will be `0`.

The default handler for this signal invokes the `Gio.Settings.changed` signal
for each affected key.  If any other connected handler returns
true then this default functionality will be suppressed.

**Parameters**

- `keys`: array of the keys which have changed
- `nKeys`: the length of the `keys` array, or `0`
- `self`: The instance the signal was emitted on.

**Returns** true to stop other handlers from being invoked for the
  event, false to propagate the event further

### `onWritableChanged`

```ts
(key: string, self: Gio.Settings) => void
```

Emitted when the writability of a key has potentially changed.

You should call `Gio.Settings.isWritable()` in order to determine the
new status.

This signal supports detailed connections.  You can connect to the
detailed signal `writable-changed::x` in order to only receive
callbacks when the writability of `x` changes.

**Parameters**

- `key`: the key
- `self`: The instance the signal was emitted on.

### `onWritableChangeEvent`

```ts
(key: number, self: Gio.Settings) => boolean | undefined
```

Emitted once per writability change event that affects this settings object.

You should connect
to this signal if you are interested in viewing groups of changes
before they are split out into multiple emissions of the
`Gio.Settings.writable-changed` signal.  For most use cases it is more
appropriate to use the `Gio.Settings.writable-changed` signal.

In the event that the writability change applies only to a single
key, `key` will be set to the `GLib.Quark` for that key.  In the event
that the writability change affects the entire settings object,
`key` will be `0`.

The default handler for this signal invokes the `Gio.Settings.writable-changed`
and `Gio.Settings.changed` signals for each affected key.  This is done because
changes in writability might also imply changes in value (if for
example, a new mandatory setting is introduced).  If any other
connected handler returns true then this default functionality
will be suppressed.

**Parameters**

- `key`: the quark of the key, or `0`
- `self`: The instance the signal was emitted on.

**Returns** true to stop other handlers from being invoked for the
  event, false to propagate the event further

## Methods

Methods are called on the `Gio.Settings` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `apply`

```ts
apply(): void
```

Applies any changes that have been made to the settings.

This function does nothing unless `settings` is in
[‘delay-apply’ mode](class.Settings.html#delay-apply-mode).  In the normal
case settings are always applied immediately.

### `bind`

```ts
bind(key: string, object: GObject.Object, property: string, flags: Gio.SettingsBindFlags): void
```

Create a binding between the `key` in the `settings` object
and the property `property` of `object`.

The binding uses the default GIO mapping functions to map
between the settings and property values. These functions
handle booleans, numeric types and string types in a
straightforward way. Use `Gio.Settings.bindWithMapping()` if
you need a custom mapping, or map between types that are not
supported by the default mapping functions.

Unless the `flags` include `Gio.SettingsBindFlags.NO_SENSITIVITY`, this
function also establishes a binding between the writability of
`key` and the `sensitive` property of `object` (if `object` has
a boolean property by that name). See `Gio.Settings.bindWritable()`
for more details about writable bindings.

Note that the lifecycle of the binding is tied to `object`,
and that you can have only one binding per object property.
If you bind the same property twice on the same object, the second
binding overrides the first one.

**Parameters**

- `key`: the key to bind
- `object`: the object with property to bind
- `property`: the name of the property to bind
- `flags`: flags for the binding

_Available since 2.26._

### `bindWithMapping`

```ts
bindWithMapping(key: string, object: GObject.Object, property: string, flags: Gio.SettingsBindFlags, getMapping: GObject.Closure | null | ClosureCallback, setMapping: GObject.Closure | null | ClosureCallback): void
```

Version of `Gio.Settings.bindWithMapping()` using closures instead of
callbacks for easier binding in other languages.

**Parameters**

- `key`: the key to bind
- `object`: the object with property to bind
- `property`: the name of the property to bind
- `flags`: flags for the binding
- `getMapping`: a function that gets called to convert values from `settings` to `object`, or `NULL` to use the default GIO mapping
- `setMapping`: a function that gets called to convert values from `object` to `settings`, or `NULL` to use the default GIO mapping

_Available since 2.82._

### `bindWritable`

```ts
bindWritable(key: string, object: GObject.Object, property: string, inverted: boolean): void
```

Create a binding between the writability of `key` in the
`settings` object and the property `property` of `object`.

The property must be boolean; `sensitive` or `visible`
properties of widgets are the most likely candidates.

Writable bindings are always uni-directional; changes of the
writability of the setting will be propagated to the object
property, not the other way.

When the `inverted` argument is true, the binding inverts the
value as it passes from the setting to the object, i.e. `property`
will be set to true if the key is not writable.

Note that the lifecycle of the binding is tied to `object`,
and that you can have only one binding per object property.
If you bind the same property twice on the same object, the second
binding overrides the first one.

**Parameters**

- `key`: the key to bind
- `object`: the object with property to bind
- `property`: the name of a boolean property to bind
- `inverted`: whether to ‘invert’ the value

_Available since 2.26._

### `createAction`

```ts
createAction(key: string): Gio.Action
```

Creates a `Gio.Action` corresponding to a given `Gio.Settings` key.

The action has the same name as the key.

The value of the key becomes the state of the action and the action
is enabled when the key is writable.  Changing the state of the
action results in the key being written to.  Changes to the value or
writability of the key cause appropriate change notifications to be
emitted for the action.

For boolean-valued keys, action activations take no parameter and
result in the toggling of the value.  For all other types,
activations take the new value for the key (which must have the
correct type).

**Parameters**

- `key`: the name of a key in `settings`

**Returns** a new `Gio.Action`

_Available since 2.32._

### `delay`

```ts
delay(): void
```

Changes the `Gio.Settings` object into
[‘delay-apply’ mode](class.Settings.html#delay-apply-mode).

In this
mode, changes to `settings` are not immediately propagated to the
backend, but kept locally until `Gio.Settings.apply()` is called.

_Available since 2.26._

### `getBoolean`

```ts
getBoolean(key: string): boolean
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for booleans.

It is a programmer error to give a `key` that isn’t specified as
having a `b` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** a boolean

_Available since 2.26._

### `getChild`

```ts
getChild(name: string): Gio.Settings
```

Creates a child settings object which has a base path of
`base-path/name`, where `base-path` is the base path of
`settings` and `name` is as specified by the caller.

The schema for the child settings object must have been declared
in the schema of `settings` using a `<child>` element.

The created child settings object will inherit the
`Gio.Settings.delayApply` mode from `settings`.

**Parameters**

- `name`: the name of the child schema

**Returns** a ‘child’ settings object

_Available since 2.26._

### `getDefaultValue`

```ts
getDefaultValue(key: string): GLib.Variant | null
```

Gets the ‘default value’ of a key.

This is the value that would be read if `Gio.Settings.reset()` were to be
called on the key.

Note that this may be a different value than returned by
`Gio.SettingsSchemaKey.getDefaultValue()` if the system administrator
has provided a default value.

Comparing the return values of `Gio.Settings.getDefaultValue()` and
`Gio.Settings.getValue()` is not sufficient for determining if a value
has been set because the user may have explicitly set the value to
something that happens to be equal to the default.  The difference
here is that if the default changes in the future, the user’s key
will still be set.

This function may be useful for adding an indication to a UI of what
the default value was before the user set it.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings`.

**Parameters**

- `key`: the key to get the default value for

**Returns** the default value

_Available since 2.40._

### `getDouble`

```ts
getDouble(key: string): number
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for doubles.

It is a programmer error to give a `key` that isn’t specified as
having a `d` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** a double

_Available since 2.26._

### `getEnum`

```ts
getEnum(key: string): number
```

Gets the value that is stored in `settings` for `key` and converts it
to the enum value that it represents.

In order to use this function the type of the value must be a string
and it must be marked in the schema file as an enumerated type.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings` or is not marked as an enumerated type.

If the value stored in the configuration database is not a valid
value for the enumerated type then this function will return the
default value.

**Parameters**

- `key`: the key to get the value for

**Returns** the enum value

_Available since 2.26._

### `getFlags`

```ts
getFlags(key: string): number
```

Gets the value that is stored in `settings` for `key` and converts it
to the flags value that it represents.

In order to use this function the type of the value must be an array
of strings and it must be marked in the schema file as a flags type.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings` or is not marked as a flags type.

If the value stored in the configuration database is not a valid
value for the flags type then this function will return the default
value.

**Parameters**

- `key`: the key to get the value for

**Returns** the flags value

_Available since 2.26._

### `getHasUnapplied`

```ts
getHasUnapplied(): boolean
```

Returns whether the `Gio.Settings` object has any unapplied
changes.

This can only be the case if it is in
[‘delay-apply’ mode](class.Settings.html#delay-apply-mode).

**Returns** true if `settings` has unapplied changes, false otherwise

_Available since 2.26._

### `getInt`

```ts
getInt(key: string): number
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for 32-bit integers.

It is a programmer error to give a `key` that isn’t specified as
having an `i` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** an integer

_Available since 2.26._

### `getInt64`

```ts
getInt64(key: string): bigint
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for 64-bit integers.

It is a programmer error to give a `key` that isn’t specified as
having an `x` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** a 64-bit integer

_Available since 2.50._

### `getMapped`

```ts
getMapped(key: string, mapping: Gio.SettingsGetMapping): bigint | null
```

Gets the value that is stored at `key` in `settings`, subject to
application-level validation/mapping.

You should use this function when the application needs to perform
some processing on the value of the key (for example, parsing).  The
`mapping` function performs that processing.  If the function
indicates that the processing was unsuccessful (due to a parse error,
for example) then the mapping is tried again with another value.

This allows a robust ‘fall back to defaults’ behaviour to be
implemented somewhat automatically.

The first value that is tried is the user’s setting for the key.  If
the mapping function fails to map this value, other values may be
tried in an unspecified order (system or site defaults, translated
schema default values, untranslated schema default values, etc).

If the mapping function fails for all possible values, one additional
attempt is made: the mapping function is called with a `NULL` value.
If the mapping function still indicates failure at this point then
the application will be aborted.

The result parameter for the `mapping` function is pointed to a
`gpointer` which is initially set to `NULL`.  The same pointer is given
to each invocation of `mapping`.  The final value of that `gpointer` is
what is returned by this function.  `NULL` is valid; it is returned
just as any other value would be.

**Parameters**

- `key`: the key to get the value for
- `mapping`: the function to map the value in the settings database to the value used by the application

**Returns** the result, which may be `NULL`

### `getRange`

```ts
getRange(key: string): GLib.Variant
```

Queries the range of a key.

**Parameters**

- `key`: the key to query the range of

> **Deprecated since 2.40.** Use `Gio.SettingsSchemaKey.getRange()` instead.

_Available since 2.28._

### `getString`

```ts
getString(key: string): string
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for strings.

It is a programmer error to give a `key` that isn’t specified as
having an `s` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** a newly-allocated string

_Available since 2.26._

### `getStrv`

```ts
getStrv(key: string): string[]
```

A convenience variant of `Gio.Settings.get()` for string arrays.

It is a programmer error to give a `key` that isn’t specified as
having an `as` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** a
  newly-allocated, `NULL`-terminated array of strings, the value that
  is stored at `key` in `settings`.

_Available since 2.26._

### `getUint`

```ts
getUint(key: string): number
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for 32-bit unsigned
integers.

It is a programmer error to give a `key` that isn’t specified as
having a `u` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** an unsigned integer

_Available since 2.30._

### `getUint64`

```ts
getUint64(key: string): bigint
```

Gets the value that is stored at `key` in `settings`.

A convenience variant of `Gio.Settings.get()` for 64-bit unsigned
integers.

It is a programmer error to give a `key` that isn’t specified as
having a `t` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to get the value for

**Returns** a 64-bit unsigned integer

_Available since 2.50._

### `getUserValue`

```ts
getUserValue(key: string): GLib.Variant | null
```

Checks the ‘user value’ of a key, if there is one.

The user value of a key is the last value that was set by the user.

After calling `Gio.Settings.reset()` this function should always return
`NULL` (assuming something is not wrong with the system
configuration).

It is possible that `Gio.Settings.getValue()` will return a different
value than this function.  This can happen in the case that the user
set a value for a key that was subsequently locked down by the system
administrator — this function will return the user’s old value.

This function may be useful for adding a ‘reset’ option to a UI or
for providing indication that a particular value has been changed.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings`.

**Parameters**

- `key`: the key to get the user value for

**Returns** the user’s value, if set

_Available since 2.40._

### `getValue`

```ts
getValue(key: string): GLib.Variant
```

Gets the value that is stored in `settings` for `key`.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings`.

**Parameters**

- `key`: the key to get the value for

**Returns** a new `GLib.Variant`

_Available since 2.26._

### `isWritable`

```ts
isWritable(name: string): boolean
```

Finds out if a key can be written.

**Parameters**

- `name`: the name of a key

**Returns** true if the key `name` is writable, false otherwise

_Available since 2.26._

### `listChildren`

```ts
listChildren(): string[]
```

Gets the list of children on `settings`.

The list is exactly the list of strings for which it is not an error
to call `Gio.Settings.getChild()`.

There is little reason to call this function from ‘normal’ code, since
you should already know what children are in your schema. This function
may still be useful there for introspection reasons, however.

You should free the return value with `GLib.strfreev()` when you are done
with it.

**Returns** a list of the children
  on `settings`, in no defined order

### `listKeys`

```ts
listKeys(): string[]
```

Introspects the list of keys on `settings`.

You should probably not be calling this function from ‘normal’ code
(since you should already know what keys are in your schema).  This
function is intended for introspection reasons.

You should free the return value with `GLib.strfreev()` when you are done
with it.

**Returns** a list
  of the keys on `settings`, in no defined order

> **Deprecated since 2.46.** Use `Gio.SettingsSchema.listKeys()` instead.

### `rangeCheck`

```ts
rangeCheck(key: string, value: GLib.Variant): boolean
```

Checks if the given `value` is of the correct type and within the
permitted range for `key`.

**Parameters**

- `key`: the key to check
- `value`: the value to check

**Returns** true if `value` is valid for `key`, false otherwise

> **Deprecated since 2.40.** Use `Gio.SettingsSchemaKey.rangeCheck()` instead.

_Available since 2.28._

### `reset`

```ts
reset(key: string): void
```

Resets `key` to its default value.

This call resets the key, as much as possible, to its default value.
That might be the value specified in the schema or the one set by the
administrator.

**Parameters**

- `key`: the name of a key

### `revert`

```ts
revert(): void
```

Reverts all unapplied changes to the settings.

This function does nothing unless `settings` is in
[‘delay-apply’ mode](class.Settings.html#delay-apply-mode).  In the normal
case settings are always applied immediately.

Change notifications will be emitted for affected keys.

### `setBoolean`

```ts
setBoolean(key: string, value: boolean): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for booleans.

It is a programmer error to give a `key` that isn’t specified as
having a `b` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.26._

### `setDouble`

```ts
setDouble(key: string, value: number): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for doubles.

It is a programmer error to give a `key` that isn’t specified as
having a `d` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.26._

### `setEnum`

```ts
setEnum(key: string, value: number): boolean
```

Looks up the enumerated type nick for `value` and writes it to `key`,
within `settings`.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings` or is not marked as an enumerated type, or for
`value` not to be a valid value for the named type.

After performing the write, accessing `key` directly with
`Gio.Settings.getString()` will return the ‘nick’ associated with
`value`.

**Parameters**

- `key`: the key to set the value for
- `value`: an enumerated value

**Returns** true if the set succeeds, false otherwise

### `setFlags`

```ts
setFlags(key: string, value: number): boolean
```

Looks up the flags type nicks for the bits specified by `value`, puts
them in an array of strings and writes the array to `key`, within
`settings`.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings` or is not marked as a flags type, or for `value`
to contain any bits that are not value for the named type.

After performing the write, accessing `key` directly with
`Gio.Settings.getStrv()` will return an array of ‘nicks’; one for each
bit in `value`.

**Parameters**

- `key`: the key to set the value for
- `value`: a flags value

**Returns** true if the set succeeds, false otherwise

### `setInt`

```ts
setInt(key: string, value: number): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for 32-bit integers.

It is a programmer error to give a `key` that isn’t specified as
having an `i` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.26._

### `setInt64`

```ts
setInt64(key: string, value: bigint): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for 64-bit integers.

It is a programmer error to give a `key` that isn’t specified as
having an `x` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.50._

### `setString`

```ts
setString(key: string, value: string): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for strings.

It is a programmer error to give a `key` that isn’t specified as
having an `s` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.26._

### `setStrv`

```ts
setStrv(key: string, value: string[] | null): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for string arrays.  If
`value` is `NULL`, then `key` is set to be the empty array.

It is a programmer error to give a `key` that isn’t specified as
having an `as` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.26._

### `setUint`

```ts
setUint(key: string, value: number): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for 32-bit unsigned
integers.

It is a programmer error to give a `key` that isn’t specified as
having a `u` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.30._

### `setUint64`

```ts
setUint64(key: string, value: bigint): boolean
```

Sets `key` in `settings` to `value`.

A convenience variant of `Gio.Settings.set()` for 64-bit unsigned
integers.

It is a programmer error to give a `key` that isn’t specified as
having a `t` type in the schema for `settings` (see `GLib.VariantType`).

**Parameters**

- `key`: the key to set the value for
- `value`: the value to set it to

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.50._

### `setValue`

```ts
setValue(key: string, value: GLib.Variant): boolean
```

Sets `key` in `settings` to `value`.

It is a programmer error to give a `key` that isn’t contained in the
schema for `settings` or for `value` to have the incorrect type, per
the schema.

If `value` is floating then this function consumes the reference.

**Parameters**

- `key`: the key to set the value for
- `value`: a `GLib.Variant` of the correct type

**Returns** true if setting the key succeeded,
  false if the key was not writable

_Available since 2.26._
