---
description: "A time-based Animation."
---

# AdwTimedAnimation

A time-based `Animation`.

`AdwTimedAnimation` implements a simple animation interpolating the given
value from `TimedAnimation.valueFrom` to
`TimedAnimation.valueTo` over
`TimedAnimation.duration` milliseconds using the curve described by
`TimedAnimation.easing`.

If `TimedAnimation.reverse` is set to `TRUE`, `AdwTimedAnimation`
will instead animate from `TimedAnimation.valueTo` to
`TimedAnimation.valueFrom`, and the easing curve will be inverted.

The animation can repeat a certain amount of times, or endlessly, depending
on the `TimedAnimation.repeatCount` value. If
`TimedAnimation.alternate` is set to `TRUE`, it will also change the
direction every other iteration.

```tsx
import { AdwTimedAnimation } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [AdwAnimation](.gtkx/reference/adw/animation.md) → **AdwTimedAnimation**

## Props

`ref` receives the `Adw.TimedAnimation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `alternate`

`boolean` · default `false`

Whether the animation changes direction on every iteration.

### `duration`

`number` · default `0`

Duration of the animation, in milliseconds.

Describes how much time the animation will take.

If the animation repeats more than once, describes the duration of one
iteration.

### `easing`

`Adw.Easing` · default `ADW_EASE_OUT_CUBIC`

Easing function used in the animation.

Describes the curve the value is interpolated on.

See `Easing` for the description of specific easing functions.

### `repeatCount`

`number` · default `1`

Number of times the animation will play.

If set to 0, the animation will repeat endlessly.

### `reverse`

`boolean` · default `false`

Whether the animation plays backwards.

### `valueFrom`

`number` · default `0.000000`

The value to animate from.

The animation will start at this value and end at
`TimedAnimation.valueTo`.

If `TimedAnimation.reverse` is `TRUE`, the animation will end at
this value instead.

### `valueTo`

`number` · default `0.000000`

The value to animate to.

The animation will start at `TimedAnimation.valueFrom` and end at
this value.

If `TimedAnimation.reverse` is `TRUE`, the animation will start
at this value instead.

## Methods

Methods are called on the `Adw.TimedAnimation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAlternate`

```ts
getAlternate(): boolean
```

Gets whether `self` changes direction on every iteration.

**Returns** whether `self` alternates

### `getDuration`

```ts
getDuration(): number
```

Gets the duration of `self`.

**Returns** the duration of `self`, in milliseconds

### `getEasing`

```ts
getEasing(): Adw.Easing
```

Gets the easing function `self` uses.

**Returns** the easing function `self` uses

### `getRepeatCount`

```ts
getRepeatCount(): number
```

Gets the number of times `self` will play.

**Returns** the number of times `self` will play

### `getReverse`

```ts
getReverse(): boolean
```

Gets whether `self` plays backwards.

**Returns** whether `self` plays backwards

### `getValueFrom`

```ts
getValueFrom(): number
```

Gets the value `self` will animate from.

**Returns** the value to animate from

### `getValueTo`

```ts
getValueTo(): number
```

Gets the value `self` will animate to.

**Returns** the value to animate to

### `setAlternate`

```ts
setAlternate(alternate: boolean): void
```

Sets whether `self` changes direction on every iteration.

**Parameters**

- `alternate`: whether `self` alternates

### `setDuration`

```ts
setDuration(duration: number): void
```

Sets the duration of `self`.

If the animation repeats more than once, sets the duration of one iteration.

**Parameters**

- `duration`: the duration to use, in milliseconds

### `setEasing`

```ts
setEasing(easing: Adw.Easing): void
```

Sets the easing function `self` will use.

See `Easing` for the description of specific easing functions.

**Parameters**

- `easing`: the easing function to use

### `setRepeatCount`

```ts
setRepeatCount(repeatCount: number): void
```

Sets the number of times `self` will play.

If set to 0, `self` will repeat endlessly.

**Parameters**

- `repeatCount`: the number of times `self` will play

### `setReverse`

```ts
setReverse(reverse: boolean): void
```

Sets whether `self` plays backwards.

**Parameters**

- `reverse`: whether `self` plays backwards

### `setValueFrom`

```ts
setValueFrom(value: number): void
```

Sets the value `self` will animate from.

The animation will start at this value and end at
`TimedAnimation.valueTo`.

If `TimedAnimation.reverse` is `TRUE`, the animation will end at
this value instead.

**Parameters**

- `value`: the value to animate from

### `setValueTo`

```ts
setValueTo(value: number): void
```

Sets the value `self` will animate to.

The animation will start at `TimedAnimation.valueFrom` and end at
this value.

If `TimedAnimation.reverse` is `TRUE`, the animation will start
at this value instead.

**Parameters**

- `value`: the value to animate to
