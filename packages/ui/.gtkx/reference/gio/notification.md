---
description: "GNotification is a mechanism for creating a notification to be shown to the user — typically as a pop-up notification presented by the desktop environment shell."
---

# GNotification

`GNotification` is a mechanism for creating a notification to be shown
to the user — typically as a pop-up notification presented by the
desktop environment shell.

The key difference between `GNotification` and other similar APIs is
that, if supported by the desktop environment, notifications sent
with `GNotification` will persist after the application has exited,
and even across system reboots.

Since the user may click on a notification while the application is
not running, applications using `GNotification` should be able to be
started as a D-Bus service, using `Gio.Application`.

In order for `GNotification` to work, the application must have installed
a `.desktop` file. For example:
```
[Desktop Entry]
Name=Test Application
Comment=Description of what Test Application does
Exec=gnome-test-application
Icon=org.gnome.TestApplication
Terminal=false
Type=Application
Categories=GNOME;GTK;TestApplication Category;
StartupNotify=true
DBusActivatable=true
X-GNOME-UsesNotifications=true
```

The `X-GNOME-UsesNotifications` key indicates to GNOME Control Center
that this application uses notifications, so it can be listed in the
Control Center’s ‘Notifications’ panel.

The `.desktop` file must be named as `org.gnome.TestApplication.desktop`,
where `org.gnome.TestApplication` is the ID passed to
`Gio.Application.new()`.

User interaction with a notification (either the default action, or
buttons) must be associated with actions on the application (ie:
`app.` actions).  It is not possible to route user interaction
through the notification itself, because the object will not exist if
the application is autostarted as a result of a notification being
clicked.

A notification can be sent with `Gio.Application.sendNotification()`.

In Windows, notification actions are unsupported, when sending the notification
a warning will be printed if a default action or action buttons were added.

_Available since 2.40._

```tsx
import { GNotification } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GNotification**

## Props

`ref` receives the `Gio.Notification` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.Notification` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addButton`

```ts
addButton(label: string, detailedAction: string): void
```

Adds a button to `notification` that activates the action in
`detailed_action` when clicked. That action must be an
application-wide action (starting with "app."). If `detailed_action`
contains a target, the action will be activated with that target as
its parameter.

See `g_action_parse_detailed_name()` for a description of the format
for `detailed_action`.

**Parameters**

- `label`: label of the button
- `detailedAction`: a detailed action name

_Available since 2.40._

### `addButtonWithTarget`

```ts
addButtonWithTarget(label: string, action: string, target: GLib.Variant | null): void
```

Adds a button to `notification` that activates `action` when clicked.
`action` must be an application-wide action (it must start with "app.").

If `target` is non-`null`, `action` will be activated with `target` as
its parameter.

**Parameters**

- `label`: label of the button
- `action`: an action name
- `target`: a `GVariant` to use as `action`'s parameter, or `null`

_Available since 2.40._

### `setBody`

```ts
setBody(body: string | null): void
```

Sets the body of `notification` to `body`.

**Parameters**

- `body`: the new body for `notification`, or `null`

_Available since 2.40._

### `setCategory`

```ts
setCategory(category: string | null): void
```

Sets the type of `notification` to `category`. Categories have a main
type like `email`, `im` or `device` and can have a detail separated
by a `.`, e.g. `im.received` or `email.arrived`. Setting the category
helps the notification server to select proper feedback to the user.

Standard categories are [listed in the specification](https://specifications.freedesktop.org/notification-spec/latest/ar01s06.html).

**Parameters**

- `category`: the category for `notification`, or `null` for no category

_Available since 2.70._

### `setDefaultAction`

```ts
setDefaultAction(detailedAction: string): void
```

Sets the default action of `notification` to `detailed_action`. This
action is activated when the notification is clicked on.

The action in `detailed_action` must be an application-wide action (it
must start with "app."). If `detailed_action` contains a target, the
given action will be activated with that target as its parameter.
See `g_action_parse_detailed_name()` for a description of the format
for `detailed_action`.

When no default action is set, the application that the notification
was sent on is activated.

**Parameters**

- `detailedAction`: a detailed action name

_Available since 2.40._

### `setDefaultActionAndTarget`

```ts
setDefaultActionAndTarget(action: string, target: GLib.Variant | null): void
```

Sets the default action of `notification` to `action`. This action is
activated when the notification is clicked on. It must be an
application-wide action (start with "app.").

If `target` is non-`null`, `action` will be activated with `target` as
its parameter. If `target` is floating, it will be consumed.

When no default action is set, the application that the notification
was sent on is activated.

**Parameters**

- `action`: an action name
- `target`: a `GVariant` to use as `action`'s parameter, or `null`

_Available since 2.40._

### `setIcon`

```ts
setIcon(icon: Gio.Icon): void
```

Sets the icon of `notification` to `icon`.

**Parameters**

- `icon`: the icon to be shown in `notification`, as a `GIcon`

_Available since 2.40._

### `setPriority`

```ts
setPriority(priority: Gio.NotificationPriority): void
```

Sets the priority of `notification` to `priority`. See
`GNotificationPriority` for possible values.

**Parameters**

- `priority`: a `GNotificationPriority`

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `notification` to `title`.

**Parameters**

- `title`: the new title for `notification`

_Available since 2.40._

### `setUrgent`

```ts
setUrgent(urgent: boolean): void
```

Deprecated in favor of `g_notification_set_priority()`.

**Parameters**

- `urgent`: `true` if `notification` is urgent

> **Deprecated since 2.42.** Since 2.42, this has been deprecated in favour of `g_notification_set_priority()`.

_Available since 2.40._
