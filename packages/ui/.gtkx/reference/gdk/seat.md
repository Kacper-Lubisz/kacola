---
description: "Represents a collection of input devices that belong to a user."
---

# GdkSeat

Represents a collection of input devices that belong to a user.

```tsx
import { GdkSeat } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkSeat**

## Props

`ref` receives the `Gdk.Seat` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `display`

`Gdk.Display` · construct-only

`GdkDisplay` of this seat.

## Signals

### `onDeviceAdded`

```ts
(device: Gdk.Device, self: Gdk.Seat) => void
```

Emitted when a new input device is related to this seat.

**Parameters**

- `device`: the newly added `GdkDevice`.
- `self`: The instance the signal was emitted on.

### `onDeviceRemoved`

```ts
(device: Gdk.Device, self: Gdk.Seat) => void
```

Emitted when an input device is removed (e.g. unplugged).

**Parameters**

- `device`: the just removed `GdkDevice`.
- `self`: The instance the signal was emitted on.

### `onToolAdded`

```ts
(tool: Gdk.DeviceTool, self: Gdk.Seat) => void
```

Emitted whenever a new tool is made known to the seat.

The tool may later be assigned to a device (i.e. on
proximity with a tablet). The device will emit the
`Gdk.Device.tool-changed` signal accordingly.

A same tool may be used by several devices.

**Parameters**

- `tool`: the new `GdkDeviceTool` known to the seat
- `self`: The instance the signal was emitted on.

### `onToolRemoved`

```ts
(tool: Gdk.DeviceTool, self: Gdk.Seat) => void
```

Emitted whenever a tool is no longer known to this `seat`.

**Parameters**

- `tool`: the just removed `GdkDeviceTool`
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Seat` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getCapabilities`

```ts
getCapabilities(): Gdk.SeatCapabilities
```

Returns the capabilities this `GdkSeat` currently has.

**Returns** the seat capabilities

### `getDevices`

```ts
getDevices(capabilities: Gdk.SeatCapabilities): Gdk.Device[]
```

Returns the devices that match the given capabilities.

**Parameters**

- `capabilities`: capabilities to get devices for

**Returns** A list
  of `GdkDevices`. The list must be freed with `g_list_free()`,
  the elements are owned by GTK and must not be freed.

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Returns the `GdkDisplay` this seat belongs to.

**Returns** a `GdkDisplay`. This object
  is owned by GTK and must not be freed.

### `getKeyboard`

```ts
getKeyboard(): Gdk.Device | null
```

Returns the device that routes keyboard events.

**Returns** a `GdkDevice` with keyboard
  capabilities. This object is owned by GTK and must not be freed.

### `getPointer`

```ts
getPointer(): Gdk.Device | null
```

Returns the device that routes pointer events.

**Returns** a `GdkDevice` with pointer
  capabilities. This object is owned by GTK and must not be freed.

### `getTools`

```ts
getTools(): Gdk.DeviceTool[]
```

Returns all `GdkDeviceTools` that are known to the application.

**Returns** A list of tools. Free with `g_list_free()`.
