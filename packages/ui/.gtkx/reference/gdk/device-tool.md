---
description: "A physical tool associated to a GdkDevice."
---

# GdkDeviceTool

A physical tool associated to a `GdkDevice`.

```tsx
import { GdkDeviceTool } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDeviceTool**

## Props

`ref` receives the `Gdk.DeviceTool` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `axes`

`Gdk.AxisFlags` · default `0` · construct-only

The axes of the tool.

### `hardwareId`

`bigint` · default `0` · construct-only

The hardware ID of the tool.

### `serial`

`bigint` · default `0` · construct-only

The serial number of the tool.

### `toolType`

`Gdk.DeviceToolType` · default `GDK_DEVICE_TOOL_TYPE_UNKNOWN` · construct-only

The type of the tool.

## Methods

Methods are called on the `Gdk.DeviceTool` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getAxes`

```ts
getAxes(): Gdk.AxisFlags
```

Gets the axes of the tool.

**Returns** the axes of `tool`

### `getHardwareId`

```ts
getHardwareId(): bigint
```

Gets the hardware ID of this tool, or 0 if it's not known.

When non-zero, the identifier is unique for the given tool model,
meaning that two identical tools will share the same `hardware_id`,
but will have different serial numbers (see
`Gdk.DeviceTool.getSerial()`).

This is a more concrete (and device specific) method to identify
a `GdkDeviceTool` than `Gdk.DeviceTool.getToolType()`,
as a tablet may support multiple devices with the same
`GdkDeviceToolType`, but different hardware identifiers.

**Returns** The hardware identifier of this tool.

### `getSerial`

```ts
getSerial(): bigint
```

Gets the serial number of this tool.

This value can be used to identify a physical tool
(eg. a tablet pen) across program executions.

**Returns** The serial ID for this tool

### `getToolType`

```ts
getToolType(): Gdk.DeviceToolType
```

Gets the `GdkDeviceToolType` of the tool.

**Returns** The physical type for this tool. This can be used to
  figure out what sort of pen is being used, such as an airbrush
  or a pencil.
