---
description: "GTlsInteraction provides a mechanism for the TLS connection and database code to interact with the user."
---

# GTlsInteraction

`GTlsInteraction` provides a mechanism for the TLS connection and database
code to interact with the user. It can be used to ask the user for passwords.

To use a `GTlsInteraction` with a TLS connection use
`Gio.TlsConnection.setInteraction()`.

Callers should instantiate a derived class that implements the various
interaction methods to show the required dialogs.

Callers should use the 'invoke' functions like
`Gio.TlsInteraction.invokeAskPassword()` to run interaction methods.
These functions make sure that the interaction is invoked in the main loop
and not in the current thread, if the current thread is not running the
main loop.

Derived classes can choose to implement whichever interactions methods they’d
like to support by overriding those virtual methods in their class
initialization function. Any interactions not implemented will return
`G_TLS_INTERACTION_UNHANDLED`. If a derived class implements an async method,
it must also implement the corresponding finish method.

_Available since 2.30._

```tsx
import { GTlsInteraction } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GTlsInteraction**

## Props

`ref` receives the `Gio.TlsInteraction` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.TlsInteraction` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `askPassword`

```ts
askPassword(password: Gio.TlsPassword, cancellable: Gio.Cancellable | null): Gio.TlsInteractionResult
```

Run synchronous interaction to ask the user for a password. In general,
`g_tls_interaction_invoke_ask_password()` should be used instead of this
function.

Derived subclasses usually implement a password prompt, although they may
also choose to provide a password from elsewhere. The `password` value will
be filled in and then `callback` will be called. Alternatively the user may
abort this password request, which will usually abort the TLS connection.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code. Certain implementations may
not support immediate cancellation.

**Parameters**

- `password`: a `GTlsPassword` object
- `cancellable`: an optional `GCancellable` cancellation object

**Returns** The status of the ask password interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `askPasswordAsync`

```ts
askPasswordAsync(password: Gio.TlsPassword, cancellable?: Gio.Cancellable | null): Promise<Gio.TlsInteractionResult>
```

Run asynchronous interaction to ask the user for a password. In general,
`g_tls_interaction_invoke_ask_password()` should be used instead of this
function.

Derived subclasses usually implement a password prompt, although they may
also choose to provide a password from elsewhere. The `password` value will
be filled in and then `callback` will be called. Alternatively the user may
abort this password request, which will usually abort the TLS connection.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code. Certain implementations may
not support immediate cancellation.

Certain implementations may not support immediate cancellation.

**Parameters**

- `password`: a `GTlsPassword` object
- `cancellable`: an optional `GCancellable` cancellation object

**Returns** The status of the ask password interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `askPasswordFinish`

```ts
askPasswordFinish(result: Gio.AsyncResult): Gio.TlsInteractionResult
```

Complete an ask password user interaction request. This should be once
the `g_tls_interaction_ask_password_async()` completion callback is called.

If `G_TLS_INTERACTION_HANDLED` is returned, then the `GTlsPassword` passed
to `g_tls_interaction_ask_password()` will have its password filled in.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code.

**Parameters**

- `result`: the result passed to the callback

**Returns** The status of the ask password interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `invokeAskPassword`

```ts
invokeAskPassword(password: Gio.TlsPassword, cancellable: Gio.Cancellable | null): Gio.TlsInteractionResult
```

Invoke the interaction to ask the user for a password. It invokes this
interaction in the main loop, specifically the `GMainContext` returned by
`g_main_context_get_thread_default()` when the interaction is created. This
is called by called by `GTlsConnection` or `GTlsDatabase` to ask the user
for a password.

Derived subclasses usually implement a password prompt, although they may
also choose to provide a password from elsewhere. The `password` value will
be filled in and then `callback` will be called. Alternatively the user may
abort this password request, which will usually abort the TLS connection.

The implementation can either be a synchronous (eg: modal dialog) or an
asynchronous one (eg: modeless dialog). This function will take care of
calling which ever one correctly.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code. Certain implementations may
not support immediate cancellation.

**Parameters**

- `password`: a `GTlsPassword` object
- `cancellable`: an optional `GCancellable` cancellation object

**Returns** The status of the ask password interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `invokeRequestCertificate`

```ts
invokeRequestCertificate(connection: Gio.TlsConnection, flags: Gio.TlsCertificateRequestFlags, cancellable: Gio.Cancellable | null): Gio.TlsInteractionResult
```

Invoke the interaction to ask the user to choose a certificate to
use with the connection. It invokes this interaction in the main
loop, specifically the `GMainContext` returned by
`g_main_context_get_thread_default()` when the interaction is
created. This is called by called by `GTlsConnection` when the peer
requests a certificate during the handshake.

Derived subclasses usually implement a certificate selector,
although they may also choose to provide a certificate from
elsewhere. Alternatively the user may abort this certificate
request, which may or may not abort the TLS connection.

The implementation can either be a synchronous (eg: modal dialog) or an
asynchronous one (eg: modeless dialog). This function will take care of
calling which ever one correctly.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code. Certain implementations may
not support immediate cancellation.

**Parameters**

- `connection`: a `GTlsConnection` object
- `flags`: flags providing more information about the request
- `cancellable`: an optional `GCancellable` cancellation object

**Returns** The status of the certificate request interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `requestCertificate`

```ts
requestCertificate(connection: Gio.TlsConnection, flags: Gio.TlsCertificateRequestFlags, cancellable: Gio.Cancellable | null): Gio.TlsInteractionResult
```

Run synchronous interaction to ask the user to choose a certificate to use
with the connection. In general, `g_tls_interaction_invoke_request_certificate()`
should be used instead of this function.

Derived subclasses usually implement a certificate selector, although they may
also choose to provide a certificate from elsewhere. Alternatively the user may
abort this certificate request, which will usually abort the TLS connection.

If `G_TLS_INTERACTION_HANDLED` is returned, then the `GTlsConnection`
passed to `g_tls_interaction_request_certificate()` will have had its
`GTlsConnection.certificate` filled in.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code. Certain implementations may
not support immediate cancellation.

**Parameters**

- `connection`: a `GTlsConnection` object
- `flags`: flags providing more information about the request
- `cancellable`: an optional `GCancellable` cancellation object

**Returns** The status of the request certificate interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `requestCertificateAsync`

```ts
requestCertificateAsync(connection: Gio.TlsConnection, flags: Gio.TlsCertificateRequestFlags, cancellable?: Gio.Cancellable | null): Promise<Gio.TlsInteractionResult>
```

Run asynchronous interaction to ask the user for a certificate to use with
the connection. In general, `g_tls_interaction_invoke_request_certificate()` should
be used instead of this function.

Derived subclasses usually implement a certificate selector, although they may
also choose to provide a certificate from elsewhere. `callback` will be called
when the operation completes. Alternatively the user may abort this certificate
request, which will usually abort the TLS connection.

**Parameters**

- `connection`: a `GTlsConnection` object
- `flags`: flags providing more information about the request
- `cancellable`: an optional `GCancellable` cancellation object

**Returns** The status of the request certificate interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `requestCertificateFinish`

```ts
requestCertificateFinish(result: Gio.AsyncResult): Gio.TlsInteractionResult
```

Complete a request certificate user interaction request. This should be once
the `g_tls_interaction_request_certificate_async()` completion callback is called.

If `G_TLS_INTERACTION_HANDLED` is returned, then the `GTlsConnection`
passed to `g_tls_interaction_request_certificate_async()` will have had its
`GTlsConnection.certificate` filled in.

If the interaction is cancelled by the cancellation object, or by the
user then `G_TLS_INTERACTION_FAILED` will be returned with an error that
contains a `G_IO_ERROR_CANCELLED` error code.

**Parameters**

- `result`: the result passed to the callback

**Returns** The status of the request certificate interaction.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._
