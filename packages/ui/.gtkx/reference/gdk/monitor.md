---
description: "Represents the individual outputs that are associated with a GdkDisplay."
---

# GdkMonitor

Represents the individual outputs that are associated with a `GdkDisplay`.

`GdkDisplay` keeps a `GListModel` to enumerate and monitor
monitors with `Gdk.Display.getMonitors()`. You can use
`Gdk.Display.getMonitorAtSurface()` to find a particular
monitor.

```tsx
import { GdkMonitor } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkMonitor**

## Props

`ref` receives the `Gdk.Monitor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `connector`

`string` · default `null` · read-only, observe with `onNotifyConnector`

The connector name.

### `description`

`string` · default `null` · read-only, observe with `onNotifyDescription`

A short description of the monitor, meant for display to the user.

_Available since 4.10._

### `display`

`Gdk.Display` · construct-only

The `GdkDisplay` of the monitor.

### `geometry`

`Gdk.Rectangle` · read-only, observe with `onNotifyGeometry`

The geometry of the monitor.

### `heightMm`

`number` · default `0` · read-only, observe with `onNotifyHeightMm`

The height of the monitor, in millimeters.

### `manufacturer`

`string` · default `null` · read-only, observe with `onNotifyManufacturer`

The manufacturer name.

### `model`

`string` · default `null` · read-only, observe with `onNotifyModel`

The model name.

### `refreshRate`

`number` · default `0` · read-only, observe with `onNotifyRefreshRate`

The refresh rate, in milli-Hertz.

### `scale`

`number` · default `1.000000` · read-only, observe with `onNotifyScale`

The scale of the monitor.

_Available since 4.14._

### `scaleFactor`

`number` · default `1` · read-only, observe with `onNotifyScaleFactor`

The scale factor.

The scale factor is the next larger integer,
compared to `Gdk.Surface.scale`.

### `subpixelLayout`

`Gdk.SubpixelLayout` · default `GDK_SUBPIXEL_LAYOUT_UNKNOWN` · read-only, observe with `onNotifySubpixelLayout`

The subpixel layout.

### `valid`

`boolean` · default `true` · read-only, observe with `onNotifyValid`

Whether the object is still valid.

### `widthMm`

`number` · default `0` · read-only, observe with `onNotifyWidthMm`

The width of the monitor, in millimeters.

## Signals

### `onInvalidate`

```ts
(self: Gdk.Monitor) => void
```

Emitted when the output represented by `monitor` gets disconnected.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Monitor` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getConnector`

```ts
getConnector(): string | null
```

Gets the name of the monitor's connector, if available.

These are strings such as "eDP-1", or "HDMI-2". They depend
on software and hardware configuration, and should not be
relied on as stable identifiers of a specific monitor.

**Returns** the name of the connector

### `getDescription`

```ts
getDescription(): string | null
```

Gets a string describing the monitor, if available.

This can be used to identify a monitor in the UI.

**Returns** the monitor description

_Available since 4.10._

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Gets the display that this monitor belongs to.

**Returns** the display

### `getGeometry`

```ts
getGeometry(): Gdk.Rectangle
```

Retrieves the size and position of the monitor within the
display coordinate space.

The returned geometry is in  ”application pixels”, not in
”device pixels” (see `Gdk.Monitor.getScale()`).

**Returns** a `GdkRectangle` to be filled with the monitor geometry

### `getHeightMm`

```ts
getHeightMm(): number
```

Gets the height in millimeters of the monitor.

**Returns** the physical height of the monitor

### `getManufacturer`

```ts
getManufacturer(): string | null
```

Gets the name or PNP ID of the monitor's manufacturer.

Note that this value might also vary depending on actual
display backend.

The PNP ID registry is located at
[https://uefi.org/pnp_id_list](https://uefi.org/pnp_id_list).

**Returns** the name of the manufacturer

### `getModel`

```ts
getModel(): string | null
```

Gets the string identifying the monitor model, if available.

**Returns** the monitor model

### `getRefreshRate`

```ts
getRefreshRate(): number
```

Gets the refresh rate of the monitor, if available.

The value is in milli-Hertz, so a refresh rate of 60Hz
is returned as 60000.

**Returns** the refresh rate in milli-Hertz, or 0

### `getScale`

```ts
getScale(): number
```

Gets the internal scale factor that maps from monitor coordinates
to device pixels.

This can be used if you want to create pixel based data for a
particular monitor, but most of the time you’re drawing to a surface
where it is better to use `Gdk.Surface.getScale()` instead.

**Returns** the scale

_Available since 4.14._

### `getScaleFactor`

```ts
getScaleFactor(): number
```

Gets the internal scale factor that maps from monitor coordinates
to device pixels.

On traditional systems this is 1, but on very high density outputs
it can be a higher value (often 2).

This can be used if you want to create pixel based data for a
particular monitor, but most of the time you’re drawing to a surface
where it is better to use `Gdk.Surface.getScaleFactor()` instead.

**Returns** the scale factor

### `getSubpixelLayout`

```ts
getSubpixelLayout(): Gdk.SubpixelLayout
```

Gets information about the layout of red, green and blue
primaries for pixels.

**Returns** the subpixel layout

### `getWidthMm`

```ts
getWidthMm(): number
```

Gets the width in millimeters of the monitor.

**Returns** the physical width of the monitor

### `isValid`

```ts
isValid(): boolean
```

Returns `true` if the `monitor` object corresponds to a
physical monitor.

The `monitor` becomes invalid when the physical monitor
is unplugged or removed.

**Returns** `true` if the object corresponds to a physical monitor
