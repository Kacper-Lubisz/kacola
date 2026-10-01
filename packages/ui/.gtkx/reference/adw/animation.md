---
description: "A base class for animations."
---

# AdwAnimation

A base class for animations.

`AdwAnimation` represents an animation on a widget. It has a target that
provides a value to animate, and a state indicating whether the
animation hasn't been started yet, is playing, paused or finished.

Currently there are two concrete animation types:
`TimedAnimation` and `SpringAnimation`.

`AdwAnimation` will automatically skip the animation if
`Animation.widget` is unmapped, or if
`Gtk.Settings.gtkEnableAnimations` is `FALSE`.

The `Animation.done` signal can be used to perform an action after
the animation ends, for example hiding a widget after animating its
`Gtk.Widget.opacity` to 0.

`AdwAnimation` will be kept alive while the animation is playing. As such,
it's safe to create an animation, start it and immediately unref it:
A fire-and-forget animation:

```c
static void
animation_cb (double    value,
              MyObject *self)
{
  // Do something with @value
}

static void
my_object_animate (MyObject *self)
{
  AdwAnimationTarget *target =
    adw_callback_animation_target_new ((AdwAnimationTargetFunc) animation_cb,
                                       self, NULL);
  g_autoptr (AdwAnimation) animation =
    adw_timed_animation_new (widget, 0, 1, 250, target);

  adw_animation_play (animation);
}
```

If there's a chance the previous animation for the same target hasn't yet
finished, the previous animation should be stopped first, or the existing
`AdwAnimation` object can be reused.

```tsx
import { AdwAnimation } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwAnimation**

## Props

`ref` receives the `Adw.Animation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `followEnableAnimationsSetting`

`boolean` · default `true`

Whether to skip the animation when animations are globally disabled.

The default behavior is to skip the animation. Set to `FALSE` to disable
this behavior.

This can be useful for cases where animation is essential, like spinners,
or in demo applications. Most other animations should keep it enabled.

See `Gtk.Settings.gtkEnableAnimations`.

_Available since 1.3._

### `state`

`Adw.AnimationState` · default `ADW_ANIMATION_IDLE` · read-only, observe with `onNotifyState`

The animation state.

The state indicates whether the animation is currently playing, paused,
finished or hasn't been started yet.

### `target`

`Adw.AnimationTarget | ReactElement`

The target to animate.

### `value`

`number` · default `0.000000` · read-only, observe with `onNotifyValue`

The current value of the animation.

### `widget`

`Gtk.Widget` · construct-only

The animation widget.

It provides the frame clock for the animation. It's not strictly necessary
for this widget to be same as the one being animated.

The widget must be mapped in order for the animation to work. If it's not
mapped, or if it gets unmapped during an ongoing animation, the animation
will be automatically skipped.

## Signals

### `onDone`

```ts
(self: Adw.Animation) => void
```

This signal is emitted when the animation has been completed, either on its
own or via calling `Animation.skip()`.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.Animation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getFollowEnableAnimationsSetting`

```ts
getFollowEnableAnimationsSetting(): boolean
```

Gets whether `self` should be skipped when animations are globally disabled.

**Returns** whether to follow the global setting

_Available since 1.3._

### `getState`

```ts
getState(): Adw.AnimationState
```

Gets the current value of `self`.

The state indicates whether `self` is currently playing, paused, finished or
hasn't been started yet.

**Returns** the animation value

### `getTarget`

```ts
getTarget(): Adw.AnimationTarget
```

Gets the target `self` animates.

**Returns** the animation target

### `getValue`

```ts
getValue(): number
```

Gets the current value of `self`.

**Returns** the current value

### `getWidget`

```ts
getWidget(): Gtk.Widget
```

Gets the widget `self` was created for.

It provides the frame clock for the animation. It's not strictly necessary
for this widget to be same as the one being animated.

The widget must be mapped in order for the animation to work. If it's not
mapped, or if it gets unmapped during an ongoing animation, the animation
will be automatically skipped.

**Returns** the animation widget

### `pause`

```ts
pause(): void
```

Pauses a playing animation for `self`.

Does nothing if the current state of `self` isn't
`Adw.AnimationState.playing`.

Sets `Animation.state` to `Adw.AnimationState.paused`.

### `play`

```ts
play(): void
```

Starts the animation for `self`.

If the animation is playing, paused or has been completed, restarts it from
the beginning. This allows to easily play an animation regardless of whether
it's already playing or not.

Sets `Animation.state` to `Adw.AnimationState.playing`.

The animation will be automatically skipped if `Animation.widget` is
unmapped, or if `Gtk.Settings.gtkEnableAnimations` is `FALSE`.

As such, it's not guaranteed that the animation will actually run. For
example, when using `GLib.idleAdd()` and starting an animation
immediately afterwards, it's entirely possible that the idle callback will
run after the animation has already finished, and not while it's playing.

### `reset`

```ts
reset(): void
```

Resets the animation for `self`.

Sets `Animation.state` to `Adw.AnimationState.idle`.

### `resume`

```ts
resume(): void
```

Resumes a paused animation for `self`.

This function must only be used if the animation has been paused with
`Animation.pause()`.

Sets `Animation.state` to `Adw.AnimationState.playing`.

### `setFollowEnableAnimationsSetting`

```ts
setFollowEnableAnimationsSetting(setting: boolean): void
```

Sets whether to skip `self` when animations are globally disabled.

The default behavior is to skip the animation. Set to `FALSE` to disable this
behavior.

This can be useful for cases where animation is essential, like spinners, or
in demo applications. Most other animations should keep it enabled.

See `Gtk.Settings.gtkEnableAnimations`.

**Parameters**

- `setting`: whether to follow the global setting

_Available since 1.3._

### `setTarget`

```ts
setTarget(target: Adw.AnimationTarget): void
```

Sets the target `self` animates to `target`.

**Parameters**

- `target`: an animation target

### `skip`

```ts
skip(): void
```

Skips the animation for `self`.

If the animation hasn't been started yet, is playing, or is paused, instantly
skips the animation to the end and causes `Animation.done` to be
emitted.

Sets `Animation.state` to `Adw.AnimationState.finished`.
