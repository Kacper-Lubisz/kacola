---
description: "Represents an input device, such as a keyboard, mouse or touchpad."
---

# GdkDevice

Represents an input device, such as a keyboard, mouse or touchpad.

See the `Gdk.Seat` documentation for more information
about the various kinds of devices, and their relationships.

```tsx
import { GdkDevice } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDevice**

## Props

`ref` receives the `Gdk.Device` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activeLayoutIndex`

`number` · default `0` · read-only, observe with `onNotifyActiveLayoutIndex`

The index of the keyboard active layout of a `GdkDevice`.

Will be -1 if there is no valid active layout.

This is only relevant for keyboard devices.

_Available since 4.18._

### `capsLockState`

`boolean` · default `false` · read-only, observe with `onNotifyCapsLockState`

Whether Caps Lock is on.

This is only relevant for keyboard devices.

### `direction`

`Pango.Direction` · default `PANGO_DIRECTION_NEUTRAL` · read-only, observe with `onNotifyDirection`

The direction of the current layout.

This is only relevant for keyboard devices.

### `display`

`Gdk.Display` · construct-only

The `GdkDisplay` the `GdkDevice` pertains to.

### `hasBidiLayouts`

`boolean` · default `false` · read-only, observe with `onNotifyHasBidiLayouts`

Whether the device has both right-to-left and left-to-right layouts.

This is only relevant for keyboard devices.

### `hasCursor`

`boolean` · default `false` · construct-only

Whether the device is represented by a cursor on the screen.

### `layoutNames`

`string[]` · read-only, observe with `onNotifyLayoutNames`

The names of the keyboard layouts of a `GdkDevice`.

This is only relevant for keyboard devices.

_Available since 4.18._

### `modifierState`

`Gdk.ModifierType` · default `GDK_NO_MODIFIER_MASK` · read-only, observe with `onNotifyModifierState`

The current modifier state of the device.

This is only relevant for keyboard devices.

### `name`

`string` · default `null` · construct-only

The device name.

### `nAxes`

`number` · default `0` · read-only, observe with `onNotifyNAxes`

Number of axes in the device.

### `numLockState`

`boolean` · default `false` · read-only, observe with `onNotifyNumLockState`

Whether Num Lock is on.

This is only relevant for keyboard devices.

### `numTouches`

`number` · default `0` · construct-only

The maximal number of concurrent touches on a touch device.

Will be 0 if the device is not a touch device or if the number
of touches is unknown.

### `productId`

`string` · default `null` · construct-only

Product ID of this device.

See `Gdk.Device.getProductId()`.

### `scrollLockState`

`boolean` · default `false` · read-only, observe with `onNotifyScrollLockState`

Whether Scroll Lock is on.

This is only relevant for keyboard devices.

### `seat`

`Gdk.Seat | ReactElement`

`GdkSeat` of this device.

### `source`

`Gdk.InputSource` · default `GDK_SOURCE_MOUSE` · construct-only

Source type for the device.

### `tool`

`Gdk.DeviceTool` · read-only, observe with `onNotifyTool`

The `GdkDeviceTool` that is currently used with this device.

### `vendorId`

`string` · default `null` · construct-only

Vendor ID of this device.

See `Gdk.Device.getVendorId()`.

## Signals

### `onChanged`

```ts
(self: Gdk.Device) => void
```

Emitted either when the number of either axes or keys changes.

On X11 this will normally happen when the physical device
routing events through the logical device changes (for
example, user switches from the USB mouse to a tablet); in
that case the logical device will change to reflect the axes
and keys on the new physical device.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onToolChanged`

```ts
(tool: Gdk.DeviceTool, self: Gdk.Device) => void
```

Emitted on pen/eraser devices whenever tools enter or leave proximity.

**Parameters**

- `tool`: The new current tool
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Device` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getActiveLayoutIndex`

```ts
getActiveLayoutIndex(): number
```

Retrieves the index of the active layout of the keyboard.

If there is no valid active layout for the `GdkDevice`, this function will
return -1;

This is only relevant for keyboard devices.

**Returns** The layout index of the active layout or -1.

_Available since 4.18._

### `getCapsLockState`

```ts
getCapsLockState(): boolean
```

Retrieves whether the Caps Lock modifier of the keyboard is locked.

This is only relevant for keyboard devices.

**Returns** `true` if Caps Lock is on for `device`

### `getDeviceTool`

```ts
getDeviceTool(): Gdk.DeviceTool | null
```

Retrieves the current tool for `device`.

**Returns** the `GdkDeviceTool`

### `getDirection`

```ts
getDirection(): Pango.Direction
```

Returns the direction of effective layout of the keyboard.

This is only relevant for keyboard devices.

The direction of a layout is the direction of the majority
of its symbols. See `Pango.unicharDirection()`.

**Returns** `PANGO_DIRECTION_LTR` or `PANGO_DIRECTION_RTL`
  if it can determine the direction. `PANGO_DIRECTION_NEUTRAL`
  otherwise

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Returns the `GdkDisplay` to which `device` pertains.

**Returns** a `GdkDisplay`

### `getHasCursor`

```ts
getHasCursor(): boolean
```

Determines whether the pointer follows device motion.

This is not meaningful for keyboard devices, which
don't have a pointer.

**Returns** `true` if the pointer follows device motion

### `getLayoutNames`

```ts
getLayoutNames(): string[] | null
```

Retrieves the names of the layouts of the keyboard.

This is only relevant for keyboard devices.

**Returns** `null`-terminated array of strings of layouts,

_Available since 4.18._

### `getModifierState`

```ts
getModifierState(): Gdk.ModifierType
```

Retrieves the current modifier state of the keyboard.

This is only relevant for keyboard devices.

**Returns** the current modifier state

### `getName`

```ts
getName(): string
```

The name of the device, suitable for showing in a user interface.

**Returns** a name

### `getNumLockState`

```ts
getNumLockState(): boolean
```

Retrieves whether the Num Lock modifier of the keyboard is locked.

This is only relevant for keyboard devices.

**Returns** `true` if Num Lock is on for `device`

### `getNumTouches`

```ts
getNumTouches(): number
```

Retrieves the number of touch points associated to `device`.

**Returns** the number of touch points

### `getProductId`

```ts
getProductId(): string | null
```

Returns the product ID of this device.

This ID is retrieved from the device, and does not change.
See `Gdk.Device.getVendorId()` for more information.

**Returns** the product ID

### `getScrollLockState`

```ts
getScrollLockState(): boolean
```

Retrieves whether the Scroll Lock modifier of the keyboard is locked.

This is only relevant for keyboard devices.

**Returns** `true` if Scroll Lock is on for `device`

### `getSeat`

```ts
getSeat(): Gdk.Seat
```

Returns the `GdkSeat` the device belongs to.

**Returns** a `GdkSeat`

### `getSource`

```ts
getSource(): Gdk.InputSource
```

Determines the type of the device.

**Returns** a `GdkInputSource`

### `getSurfaceAtPosition`

```ts
getSurfaceAtPosition(): [Gdk.Surface | null, number, number]
```

Obtains the surface underneath `device`, returning the location of the
device in `win_x` and `win_y`.

Returns `null` if the surface tree under `device` is not known to GDK
(for example, belongs to another application).

**Returns** Tuple of:

- `result`: the `GdkSurface` under the device position
- `winX`: return location for the X coordinate of the device location relative to the surface origin
- `winY`: return location for the Y coordinate of the device location relative to the surface origin

### `getTimestamp`

```ts
getTimestamp(): number
```

Returns the timestamp of the last activity for this device.

In practice, this means the timestamp of the last event that was
received from the OS for this device. (GTK may occasionally produce
events for a device that are not received from the OS, and will not
update the timestamp).

**Returns** the timestamp of the last activity for this device

_Available since 4.2._

### `getVendorId`

```ts
getVendorId(): string | null
```

Returns the vendor ID of this device.

This ID is retrieved from the device, and does not change.

This function, together with `Gdk.Device.getProductId()`,
can be used to eg. compose `GSettings` paths to store settings
for this device.

```c
 static GSettings *
 get_device_settings (GdkDevice *device)
 {
   const char *vendor, *product;
   GSettings *settings;
   GdkDevice *device;
   char *path;

   vendor = gdk_device_get_vendor_id (device);
   product = gdk_device_get_product_id (device);

   path = g_strdup_printf ("/org/example/app/devices/%s:%s/", vendor, product);
   settings = g_settings_new_with_path (DEVICE_SCHEMA, path);
   g_free (path);

   return settings;
 }
```

**Returns** the vendor ID

### `hasBidiLayouts`

```ts
hasBidiLayouts(): boolean
```

Determines if layouts for both right-to-left and
left-to-right languages are in use on the keyboard.

This is only relevant for keyboard devices.

**Returns** `true` if there are layouts with both directions, `false` otherwise
