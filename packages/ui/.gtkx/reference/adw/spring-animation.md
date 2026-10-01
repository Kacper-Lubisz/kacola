---
description: "A spring-based Animation."
---

# AdwSpringAnimation

A spring-based `Animation`.

`AdwSpringAnimation` implements an animation driven by a physical model of a
spring described by `SpringParams`, with a resting position in
`SpringAnimation.valueTo`, stretched to
`SpringAnimation.valueFrom`.

Since the animation is physically simulated, spring animations don't have a
fixed duration. The animation will stop when the simulated spring comes to a
rest - when the amplitude of the oscillations becomes smaller than
`SpringAnimation.epsilon`, or immediately when it reaches
`SpringAnimation.valueTo` if
`SpringAnimation.clamp` is set to `TRUE`. The estimated duration can
be obtained with `SpringAnimation.estimatedDuration`.

Due to the nature of spring-driven motion the animation can overshoot
`SpringAnimation.valueTo` before coming to a rest. Whether the
animation will overshoot or not depends on the damping ratio of the spring.
See `SpringParams` for more information about specific damping ratio
values.

If `SpringAnimation.clamp` is `TRUE`, the animation will abruptly
end as soon as it reaches the final value, preventing overshooting.

Animations can have an initial velocity value, set via
`SpringAnimation.initialVelocity`, which adjusts the curve without
changing the duration. This makes spring animations useful for deceleration
at the end of gestures.

If the initial and final values are equal, and the initial velocity is not 0,
the animation value will bounce and return to its resting position.

```tsx
import { AdwSpringAnimation } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [AdwAnimation](.gtkx/reference/adw/animation.md) → **AdwSpringAnimation**

## Props

`ref` receives the `Adw.SpringAnimation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `clamp`

`boolean` · default `false`

Whether the animation should be clamped.

If set to `TRUE`, the animation will abruptly end as soon as it reaches the
final value, preventing overshooting.

It won't prevent overshooting `SpringAnimation.valueFrom` if a
relative negative `SpringAnimation.initialVelocity` is set.

### `epsilon`

`number` · default `0.001000`

Precision of the spring.

The level of precision used to determine when the animation has come to a
rest, that is, when the amplitude of the oscillations becomes smaller than
this value.

If the epsilon value is too small, the animation will take a long time to
stop after the animated value has stopped visibly changing.

If the epsilon value is too large, the animation will end prematurely.

The default value is 0.001.

### `estimatedDuration`

`number` · default `0` · read-only, observe with `onNotifyEstimatedDuration`

Estimated duration of the animation, in milliseconds.

Can be `DURATION_INFINITE` if the spring damping is set to 0.

### `initialVelocity`

`number` · default `0.000000`

The initial velocity to start the animation with.

Initial velocity affects only the animation curve, but not its duration.

### `springParams`

`Adw.SpringParams`

Physical parameters describing the spring.

### `valueFrom`

`number` · default `0.000000`

The value to animate from.

The animation will start at this value and end at
`SpringAnimation.valueTo`.

### `valueTo`

`number` · default `0.000000`

The value to animate to.

The animation will start at `SpringAnimation.valueFrom` and end
at this value.

### `velocity`

`number` · default `0.000000` · read-only, observe with `onNotifyVelocity`

Current velocity of the animation.

## Methods

Methods are called on the `Adw.SpringAnimation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `calculateValue`

```ts
calculateValue(time: number): number
```

Calculates the value `self` will have at `time`.

The time starts at 0 and ends at
`SpringAnimation.estimatedDuration`.

See also `SpringAnimation.calculateVelocity()`.

**Parameters**

- `time`: elapsed time, in milliseconds

**Returns** the value at `time`

_Available since 1.3._

### `calculateVelocity`

```ts
calculateVelocity(time: number): number
```

Calculates the velocity `self` will have at `time`.

The time starts at 0 and ends at
`SpringAnimation.estimatedDuration`.

See also `SpringAnimation.calculateValue()`.

**Parameters**

- `time`: elapsed time, in milliseconds

**Returns** the velocity at `time`

_Available since 1.3._

### `getClamp`

```ts
getClamp(): boolean
```

Gets whether `self` should be clamped.

**Returns** whether `self` is clamped

### `getEpsilon`

```ts
getEpsilon(): number
```

Gets the precision of the spring.

**Returns** the epsilon value

### `getEstimatedDuration`

```ts
getEstimatedDuration(): number
```

Gets the estimated duration of `self`, in milliseconds.

Can be `DURATION_INFINITE` if the spring damping is set to 0.

**Returns** the estimated duration

### `getInitialVelocity`

```ts
getInitialVelocity(): number
```

Gets the initial velocity of `self`.

**Returns** the initial velocity

### `getSpringParams`

```ts
getSpringParams(): Adw.SpringParams
```

Gets the physical parameters of the spring of `self`.

**Returns** the spring parameters

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

### `getVelocity`

```ts
getVelocity(): number
```

Gets the current velocity of `self`.

**Returns** the current velocity

### `setClamp`

```ts
setClamp(clamp: boolean): void
```

Sets whether `self` should be clamped.

If set to `TRUE`, the animation will abruptly end as soon as it reaches the
final value, preventing overshooting.

It won't prevent overshooting `SpringAnimation.valueFrom` if a
relative negative `SpringAnimation.initialVelocity` is set.

**Parameters**

- `clamp`: the new value

### `setEpsilon`

```ts
setEpsilon(epsilon: number): void
```

Sets the precision of the spring.

The level of precision used to determine when the animation has come to a
rest, that is, when the amplitude of the oscillations becomes smaller than
this value.

If the epsilon value is too small, the animation will take a long time to
stop after the animated value has stopped visibly changing.

If the epsilon value is too large, the animation will end prematurely.

The default value is 0.001.

**Parameters**

- `epsilon`: the new value

### `setInitialVelocity`

```ts
setInitialVelocity(velocity: number): void
```

Sets the initial velocity of `self`.

Initial velocity affects only the animation curve, but not its duration.

**Parameters**

- `velocity`: the initial velocity

### `setSpringParams`

```ts
setSpringParams(springParams: Adw.SpringParams): void
```

Sets the physical parameters of the spring of `self`.

**Parameters**

- `springParams`: the new spring parameters

### `setValueFrom`

```ts
setValueFrom(value: number): void
```

Sets the value `self` will animate from.

The animation will start at this value and end at
`SpringAnimation.valueTo`.

**Parameters**

- `value`: the value to animate from

### `setValueTo`

```ts
setValueTo(value: number): void
```

Sets the value `self` will animate to.

The animation will start at `SpringAnimation.valueFrom` and end at
this value.

**Parameters**

- `value`: the value to animate to
