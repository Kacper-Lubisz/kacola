---
description: "GTlsConnection is the base TLS connection class type, which wraps a Gio.IOStream and provides TLS encryption on top of it."
---

# GTlsConnection

`GTlsConnection` is the base TLS connection class type, which wraps
a `Gio.IOStream` and provides TLS encryption on top of it. Its
subclasses, `Gio.TlsClientConnection` and
`Gio.TlsServerConnection`, implement client-side and server-side TLS,
respectively.

For DTLS (Datagram TLS) support, see `Gio.DtlsConnection`.

_Available since 2.28._

```tsx
import { GTlsConnection } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GIOStream](.gtkx/reference/gio/io-stream.md) → **GTlsConnection**

## Props

`ref` receives the `Gio.TlsConnection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `advertisedProtocols`

`string[]`

The list of application-layer protocols that the connection
advertises that it is willing to speak. See
`g_tls_connection_set_advertised_protocols()`.

_Available since 2.60._

### `baseIoStream`

`Gio.IOStream` · construct-only

The `GIOStream` that the connection wraps. The connection holds a reference
to this stream, and may run operations on the stream from other threads
throughout its lifetime. Consequently, after the `GIOStream` has been
constructed, application code may only run its own operations on this
stream when no `GIOStream` operations are running.

_Available since 2.28._

### `certificate`

`Gio.TlsCertificate | ReactElement`

The connection's certificate; see
`g_tls_connection_set_certificate()`.

_Available since 2.28._

### `ciphersuiteName`

`string` · default `null` · read-only, observe with `onNotifyCiphersuiteName`

The name of the TLS ciphersuite in use. See `g_tls_connection_get_ciphersuite_name()`.

_Available since 2.70._

### `database`

`Gio.TlsDatabase | ReactElement`

The certificate database to use when verifying this TLS connection.
If no certificate database is set, then the default database will be
used. See `g_tls_backend_get_default_database()`.

When using a non-default database, `GTlsConnection` must fall back to using
the `GTlsDatabase` to perform certificate verification using
`g_tls_database_verify_chain()`, which means certificate verification will
not be able to make use of TLS session context. This may be less secure.
For example, if you create your own `GTlsDatabase` that just wraps the
default `GTlsDatabase`, you might expect that you have not changed anything,
but this is not true because you may have altered the behavior of
`GTlsConnection` by causing it to use `g_tls_database_verify_chain()`. See the
documentation of `g_tls_database_verify_chain()` for more details on specific
security checks that may not be performed. Accordingly, setting a
non-default database is discouraged except for specialty applications with
unusual security requirements.

_Available since 2.30._

### `interaction`

`Gio.TlsInteraction | ReactElement`

A `GTlsInteraction` object to be used when the connection or certificate
database need to interact with the user. This will be used to prompt the
user for passwords where necessary.

_Available since 2.30._

### `negotiatedProtocol`

`string` · default `null` · read-only, observe with `onNotifyNegotiatedProtocol`

The application-layer protocol negotiated during the TLS
handshake. See `g_tls_connection_get_negotiated_protocol()`.

_Available since 2.60._

### `peerCertificate`

`Gio.TlsCertificate` · read-only, observe with `onNotifyPeerCertificate`

The connection's peer's certificate, after the TLS handshake has
completed or failed. Note in particular that this is not yet set
during the emission of `GTlsConnection.accept-certificate`.

(You can watch for a `GObject.notify` signal on this property to
detect when a handshake has occurred.)

_Available since 2.28._

### `peerCertificateErrors`

`Gio.TlsCertificateFlags` · default `G_TLS_CERTIFICATE_NO_FLAGS` · read-only, observe with `onNotifyPeerCertificateErrors`

The errors noticed while verifying
`GTlsConnection.peerCertificate`. Normally this should be 0, but
it may not be if `GTlsClientConnection.validationFlags` is not
`G_TLS_CERTIFICATE_VALIDATE_ALL`, or if
`GTlsConnection.accept-certificate` overrode the default
behavior.

GLib guarantees that if certificate verification fails, at least
one error will be set, but it does not guarantee that all possible
errors will be set. Accordingly, you may not safely decide to
ignore any particular type of error. For example, it would be
incorrect to mask `G_TLS_CERTIFICATE_EXPIRED` if you want to allow
expired certificates, because this could potentially be the only
error flag set even if other problems exist with the certificate.

_Available since 2.28._

### `protocolVersion`

`Gio.TlsProtocolVersion` · default `G_TLS_PROTOCOL_VERSION_UNKNOWN` · read-only, observe with `onNotifyProtocolVersion`

The TLS protocol version in use. See `g_tls_connection_get_protocol_version()`.

_Available since 2.70._

### `rehandshakeMode`

`Gio.TlsRehandshakeMode` · default `G_TLS_REHANDSHAKE_SAFELY` · deprecated since 2.60

The rehandshaking mode. See
`g_tls_connection_set_rehandshake_mode()`.

> **Deprecated since 2.60.** The rehandshake mode is ignored.

_Available since 2.28._

### `requireCloseNotify`

`boolean` · default `true`

Whether or not proper TLS close notification is required.
See `g_tls_connection_set_require_close_notify()`.

_Available since 2.28._

### `useSystemCertdb`

`boolean` · default `true` · deprecated since 2.30

Whether or not the system certificate database will be used to
verify peer certificates. See
`g_tls_connection_set_use_system_certdb()`.

> **Deprecated since 2.30.** Use GTlsConnection:database instead

## Signals

### `onAcceptCertificate`

```ts
(peerCert: Gio.TlsCertificate, errors: Gio.TlsCertificateFlags, self: Gio.TlsConnection) => boolean | undefined
```

Emitted during the TLS handshake after the peer certificate has
been received. You can examine `peer_cert`'s certification path by
calling `g_tls_certificate_get_issuer()` on it.

For a client-side connection, `peer_cert` is the server's
certificate, and the signal will only be emitted if the
certificate was not acceptable according to `conn`'s
`GTlsClientConnection.validationFlags`. If you would like the
certificate to be accepted despite `errors`, return `true` from the
signal handler. Otherwise, if no handler accepts the certificate,
the handshake will fail with `G_TLS_ERROR_BAD_CERTIFICATE`.

GLib guarantees that if certificate verification fails, this signal
will be emitted with at least one error will be set in `errors`, but
it does not guarantee that all possible errors will be set.
Accordingly, you may not safely decide to ignore any particular
type of error. For example, it would be incorrect to ignore
`G_TLS_CERTIFICATE_EXPIRED` if you want to allow expired
certificates, because this could potentially be the only error flag
set even if other problems exist with the certificate.

For a server-side connection, `peer_cert` is the certificate
presented by the client, if this was requested via the server's
`GTlsServerConnection.authenticationMode`. On the server side,
the signal is always emitted when the client presents a
certificate, and the certificate will only be accepted if a
handler returns `true`.

Note that if this signal is emitted as part of asynchronous I/O
in the main thread, then you should not attempt to interact with
the user before returning from the signal handler. If you want to
let the user decide whether or not to accept the certificate, you
would have to return `false` from the signal handler on the first
attempt, and then after the connection attempt returns a
`G_TLS_ERROR_BAD_CERTIFICATE`, you can interact with the user, and
if the user decides to accept the certificate, remember that fact,
create a new connection, and return `true` from the signal handler
the next time.

If you are doing I/O in another thread, you do not
need to worry about this, and can simply block in the signal
handler until the UI thread returns an answer.

**Parameters**

- `peerCert`: the peer's `GTlsCertificate`
- `errors`: the problems with `peer_cert`.
- `self`: The instance the signal was emitted on.

**Returns** `true` to accept `peer_cert` (which will also
immediately end the signal emission). `false` to allow the signal
emission to continue, which will cause the handshake to fail if
no one else overrides it.

_Available since 2.28._

## Methods

Methods are called on the `Gio.TlsConnection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `emitAcceptCertificate`

```ts
emitAcceptCertificate(peerCert: Gio.TlsCertificate, errors: Gio.TlsCertificateFlags): boolean
```

Used by `GTlsConnection` implementations to emit the
`GTlsConnection.accept-certificate` signal.

**Parameters**

- `peerCert`: the peer's `GTlsCertificate`
- `errors`: the problems with `peer_cert`

**Returns** `true` if one of the signal handlers has returned
    `true` to accept `peer_cert`

_Available since 2.28._

### `getCertificate`

```ts
getCertificate(): Gio.TlsCertificate | null
```

Gets `conn`'s certificate, as set by
`g_tls_connection_set_certificate()`.

**Returns** `conn`'s certificate, or `null`

_Available since 2.28._

### `getChannelBindingData`

```ts
getChannelBindingData(type: Gio.TlsChannelBindingType): boolean
```

Query the TLS backend for TLS channel binding data of `type` for `conn`.

This call retrieves TLS channel binding data as specified in RFC
[5056](https://tools.ietf.org/html/rfc5056), RFC
[5929](https://tools.ietf.org/html/rfc5929), and related RFCs.  The
binding data is returned in `data`.  The `data` is resized by the callee
using `GByteArray` buffer management and will be freed when the `data`
is destroyed by `g_byte_array_unref()`. If `data` is `null`, it will only
check whether TLS backend is able to fetch the data (e.g. whether `type`
is supported by the TLS backend). It does not guarantee that the data
will be available though.  That could happen if TLS connection does not
support `type` or the binding data is not available yet due to additional
negotiation or input required.

**Parameters**

- `type`: `GTlsChannelBindingType` type of data to fetch

**Returns** `true` on success, `false` otherwise

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.66._

### `getCiphersuiteName`

```ts
getCiphersuiteName(): string | null
```

Returns the name of the current TLS ciphersuite, or `null` if the
connection has not handshaked or has been closed. Beware that the TLS
backend may use any of multiple different naming conventions, because
OpenSSL and GnuTLS have their own ciphersuite naming conventions that
are different from each other and different from the standard, IANA-
registered ciphersuite names. The ciphersuite name is intended to be
displayed to the user for informative purposes only, and parsing it
is not recommended.

**Returns** The name of the current TLS ciphersuite, or `null`

_Available since 2.70._

### `getDatabase`

```ts
getDatabase(): Gio.TlsDatabase | null
```

Gets the certificate database that `conn` uses to verify
peer certificates. See `g_tls_connection_set_database()`.

**Returns** the certificate database that `conn` uses or `null`

_Available since 2.30._

### `getInteraction`

```ts
getInteraction(): Gio.TlsInteraction | null
```

Get the object that will be used to interact with the user. It will be used
for things like prompting the user for passwords. If `null` is returned, then
no user interaction will occur for this connection.

**Returns** The interaction object.

_Available since 2.30._

### `getNegotiatedProtocol`

```ts
getNegotiatedProtocol(): string | null
```

Gets the name of the application-layer protocol negotiated during
the handshake.

If the peer did not use the ALPN extension, or did not advertise a
protocol that matched one of `conn`'s protocols, or the TLS backend
does not support ALPN, then this will be `null`. See
`g_tls_connection_set_advertised_protocols()`.

**Returns** the negotiated protocol, or `null`

_Available since 2.60._

### `getPeerCertificate`

```ts
getPeerCertificate(): Gio.TlsCertificate | null
```

Gets `conn`'s peer's certificate after the handshake has completed
or failed. (It is not set during the emission of
`GTlsConnection.accept-certificate`.)

**Returns** `conn`'s peer's certificate, or `null`

_Available since 2.28._

### `getPeerCertificateErrors`

```ts
getPeerCertificateErrors(): Gio.TlsCertificateFlags
```

Gets the errors associated with validating `conn`'s peer's
certificate, after the handshake has completed or failed. (It is
not set during the emission of `GTlsConnection.accept-certificate`.)

See `GTlsConnection.peerCertificateErrors` for more information.

**Returns** `conn`'s peer's certificate errors

_Available since 2.28._

### `getProtocolVersion`

```ts
getProtocolVersion(): Gio.TlsProtocolVersion
```

Returns the current TLS protocol version, which may be
`G_TLS_PROTOCOL_VERSION_UNKNOWN` if the connection has not handshaked, or
has been closed, or if the TLS backend has implemented a protocol version
that is not a recognized `GTlsProtocolVersion`.

**Returns** The current TLS protocol version

_Available since 2.70._

### `getRehandshakeMode`

```ts
getRehandshakeMode(): Gio.TlsRehandshakeMode
```

Gets `conn` rehandshaking mode. See
`g_tls_connection_set_rehandshake_mode()` for details.

**Returns** `G_TLS_REHANDSHAKE_SAFELY`

> **Deprecated since 2.60..** Changing the rehandshake mode is no longer required for compatibility. Also, rehandshaking has been removed from the TLS protocol in TLS 1.3.

_Available since 2.28._

### `getRequireCloseNotify`

```ts
getRequireCloseNotify(): boolean
```

Tests whether or not `conn` expects a proper TLS close notification
when the connection is closed. See
`g_tls_connection_set_require_close_notify()` for details.

**Returns** `true` if `conn` requires a proper TLS close
notification.

_Available since 2.28._

### `getUseSystemCertdb`

```ts
getUseSystemCertdb(): boolean
```

Gets whether `conn` uses the system certificate database to verify
peer certificates. See `g_tls_connection_set_use_system_certdb()`.

**Returns** whether `conn` uses the system certificate database

> **Deprecated since 2.30.** Use `g_tls_connection_get_database()` instead

### `handshake`

```ts
handshake(cancellable: Gio.Cancellable | null): boolean
```

Attempts a TLS handshake on `conn`.

On the client side, it is never necessary to call this method;
although the connection needs to perform a handshake after
connecting (or after sending a "STARTTLS"-type command),
`GTlsConnection` will handle this for you automatically when you try
to send or receive data on the connection. You can call
`g_tls_connection_handshake()` manually if you want to know whether
the initial handshake succeeded or failed (as opposed to just
immediately trying to use `conn` to read or write, in which case,
if it fails, it may not be possible to tell if it failed before or
after completing the handshake), but beware that servers may reject
client authentication after the handshake has completed, so a
successful handshake does not indicate the connection will be usable.

Likewise, on the server side, although a handshake is necessary at
the beginning of the communication, you do not need to call this
function explicitly unless you want clearer error reporting.

Previously, calling `g_tls_connection_handshake()` after the initial
handshake would trigger a rehandshake; however, this usage was
deprecated in GLib 2.60 because rehandshaking was removed from the
TLS protocol in TLS 1.3. Since GLib 2.64, calling this function after
the initial handshake will no longer do anything.

When using a `GTlsConnection` created by `GSocketClient`, the
`GSocketClient` performs the initial handshake, so calling this
function manually is not recommended.

`GTlsConnection.accept_certificate` may be emitted during the
handshake.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** success or failure

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.28._

### `handshakeAsync`

```ts
handshakeAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Asynchronously performs a TLS handshake on `conn`. See
`g_tls_connection_handshake()` for more information.

**Parameters**

- `ioPriority`: the [I/O priority](iface.AsyncResult.html#io-priority) of the request
- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` on success, `false` on failure, in which
case `error` will be set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.28._

### `handshakeFinish`

```ts
handshakeFinish(result: Gio.AsyncResult): boolean
```

Finish an asynchronous TLS handshake operation. See
`g_tls_connection_handshake()` for more information.

**Parameters**

- `result`: a `GAsyncResult`.

**Returns** `true` on success, `false` on failure, in which
case `error` will be set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.28._

### `setAdvertisedProtocols`

```ts
setAdvertisedProtocols(protocols: string[] | null): void
```

Sets the list of application-layer protocols to advertise that the
caller is willing to speak on this connection. The
Application-Layer Protocol Negotiation (ALPN) extension will be
used to negotiate a compatible protocol with the peer; use
`g_tls_connection_get_negotiated_protocol()` to find the negotiated
protocol after the handshake.  Specifying `null` for the the value
of `protocols` will disable ALPN negotiation.

See [IANA TLS ALPN Protocol IDs](https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids)
for a list of registered protocol IDs.

**Parameters**

- `protocols`: a `null`-terminated array of ALPN protocol names (eg, "http/1.1", "h2"), or `null`

_Available since 2.60._

### `setCertificate`

```ts
setCertificate(certificate: Gio.TlsCertificate): void
```

This sets the certificate that `conn` will present to its peer
during the TLS handshake. For a `GTlsServerConnection`, it is
mandatory to set this, and that will normally be done at construct
time.

For a `GTlsClientConnection`, this is optional. If a handshake fails
with `G_TLS_ERROR_CERTIFICATE_REQUIRED`, that means that the server
requires a certificate, and if you try connecting again, you should
call this method first. You can call
`g_tls_client_connection_get_accepted_cas()` on the failed connection
to get a list of Certificate Authorities that the server will
accept certificates from.

(It is also possible that a server will allow the connection with
or without a certificate; in that case, if you don't provide a
certificate, you can tell that the server requested one by the fact
that `g_tls_client_connection_get_accepted_cas()` will return
non-`null`.)

**Parameters**

- `certificate`: the certificate to use for `conn`

_Available since 2.28._

### `setDatabase`

```ts
setDatabase(database: Gio.TlsDatabase | null): void
```

Sets the certificate database that is used to verify peer certificates.
This is set to the default database by default. See
`g_tls_backend_get_default_database()`. If set to `null`, then
peer certificate validation will always set the
`G_TLS_CERTIFICATE_UNKNOWN_CA` error (meaning
`GTlsConnection.accept-certificate` will always be emitted on
client-side connections, unless that bit is not set in
`GTlsClientConnection.validationFlags`).

There are nonintuitive security implications when using a non-default
database. See `GTlsConnection.database` for details.

**Parameters**

- `database`: a `GTlsDatabase`

_Available since 2.30._

### `setInteraction`

```ts
setInteraction(interaction: Gio.TlsInteraction | null): void
```

Set the object that will be used to interact with the user. It will be used
for things like prompting the user for passwords.

The `interaction` argument will normally be a derived subclass of
`GTlsInteraction`. `null` can also be provided if no user interaction
should occur for this connection.

**Parameters**

- `interaction`: an interaction object, or `null`

_Available since 2.30._

### `setRehandshakeMode`

```ts
setRehandshakeMode(mode: Gio.TlsRehandshakeMode): void
```

Since GLib 2.64, changing the rehandshake mode is no longer supported
and will have no effect. With TLS 1.3, rehandshaking has been removed from
the TLS protocol, replaced by separate post-handshake authentication and
rekey operations.

**Parameters**

- `mode`: the rehandshaking mode

> **Deprecated since 2.60..** Changing the rehandshake mode is no longer required for compatibility. Also, rehandshaking has been removed from the TLS protocol in TLS 1.3.

_Available since 2.28._

### `setRequireCloseNotify`

```ts
setRequireCloseNotify(requireCloseNotify: boolean): void
```

Sets whether or not `conn` expects a proper TLS close notification
before the connection is closed. If this is `true` (the default),
then `conn` will expect to receive a TLS close notification from its
peer before the connection is closed, and will return a
`G_TLS_ERROR_EOF` error if the connection is closed without proper
notification (since this may indicate a network error, or
man-in-the-middle attack).

In some protocols, the application will know whether or not the
connection was closed cleanly based on application-level data
(because the application-level data includes a length field, or is
somehow self-delimiting); in this case, the close notify is
redundant and sometimes omitted. (TLS 1.1 explicitly allows this;
in TLS 1.0 it is technically an error, but often done anyway.) You
can use `g_tls_connection_set_require_close_notify()` to tell `conn`
to allow an "unannounced" connection close, in which case the close
will show up as a 0-length read, as in a non-TLS
`GSocketConnection`, and it is up to the application to check that
the data has been fully received.

Note that this only affects the behavior when the peer closes the
connection; when the application calls `g_io_stream_close()` itself
on `conn`, this will send a close notification regardless of the
setting of this property. If you explicitly want to do an unclean
close, you can close `conn`'s `GTlsConnection.baseIoStream` rather
than closing `conn` itself, but note that this may only be done when no other
operations are pending on `conn` or the base I/O stream.

**Parameters**

- `requireCloseNotify`: whether or not to require close notification

_Available since 2.28._

### `setUseSystemCertdb`

```ts
setUseSystemCertdb(useSystemCertdb: boolean): void
```

Sets whether `conn` uses the system certificate database to verify
peer certificates. This is `true` by default. If set to `false`, then
peer certificate validation will always set the
`G_TLS_CERTIFICATE_UNKNOWN_CA` error (meaning
`GTlsConnection.accept-certificate` will always be emitted on
client-side connections, unless that bit is not set in
`GTlsClientConnection.validationFlags`).

**Parameters**

- `useSystemCertdb`: whether to use the system certificate database

> **Deprecated since 2.30.** Use `g_tls_connection_set_database()` instead
