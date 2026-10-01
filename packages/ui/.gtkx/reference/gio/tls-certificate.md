---
description: "A certificate used for TLS authentication and encryption."
---

# GTlsCertificate

A certificate used for TLS authentication and encryption.
This can represent either a certificate only (eg, the certificate
received by a client from a server), or the combination of
a certificate and a private key (which is needed when acting as a
`Gio.TlsServerConnection`).

_Available since 2.28._

```tsx
import { GTlsCertificate } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GTlsCertificate**

## Props

`ref` receives the `Gio.TlsCertificate` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `certificate`

`Uint8Array` · construct-only

The DER (binary) encoded representation of the certificate.
This property and the `GTlsCertificate.certificatePem` property
represent the same data, just in different forms.

_Available since 2.28._

### `certificatePem`

`string` · default `null` · construct-only

The PEM (ASCII) encoded representation of the certificate.
This property and the `GTlsCertificate.certificate`
property represent the same data, just in different forms.

_Available since 2.28._

### `dnsNames`

`bigint[]` · read-only, observe with `onNotifyDnsNames`

The DNS names from the certificate's Subject Alternative Names (SANs),
`null` if unavailable.

_Available since 2.70._

### `ipAddresses`

`bigint[]` · read-only, observe with `onNotifyIpAddresses`

The IP addresses from the certificate's Subject Alternative Names (SANs),
`null` if unavailable.

_Available since 2.70._

### `issuer`

`Gio.TlsCertificate` · construct-only

A `GTlsCertificate` representing the entity that issued this
certificate. If `null`, this means that the certificate is either
self-signed, or else the certificate of the issuer is not
available.

Beware the issuer certificate may not be the same as the
certificate that would actually be used to construct a valid
certification path during certificate verification.
[RFC 4158](https://datatracker.ietf.org/doc/html/rfc4158) explains
why an issuer certificate cannot be naively assumed to be part of the
the certification path (though GLib's TLS backends may not follow the
path building strategies outlined in this RFC). Due to the complexity
of certification path building, GLib does not provide any way to know
which certification path will actually be used. Accordingly, this
property cannot be used to make security-related decisions. Only
GLib itself should make security decisions about TLS certificates.

_Available since 2.28._

### `issuerName`

`string` · default `null` · read-only, observe with `onNotifyIssuerName`

The issuer from the certificate,
`null` if unavailable.

_Available since 2.70._

### `notValidAfter`

`GLib.DateTime` · read-only, observe with `onNotifyNotValidAfter`

The time at which this cert is no longer valid,
`null` if unavailable.

_Available since 2.70._

### `notValidBefore`

`GLib.DateTime` · read-only, observe with `onNotifyNotValidBefore`

The time at which this cert is considered to be valid,
`null` if unavailable.

_Available since 2.70._

### `password`

`string` · default `null` · construct-only

An optional password used when constructed with GTlsCertificate:pkcs12-data.

_Available since 2.72._

### `pkcs11Uri`

`string` · default `null` · construct-only

A URI referencing the [PKCS \`11`](https://docs.oasis-open.org/pkcs11/pkcs11-base/v3.0/os/pkcs11-base-v3.0-os.html)
objects containing an X.509 certificate and optionally a private key.

If `null`, the certificate is either not backed by PKCS \`11` or the
`GTlsBackend` does not support PKCS \`11`.

_Available since 2.68._

### `pkcs12Data`

`Uint8Array` · construct-only

The PKCS `12` formatted data used to construct the object.

See also: `g_tls_certificate_new_from_pkcs12()`

_Available since 2.72._

### `privateKey`

`Uint8Array` · construct-only

The DER (binary) encoded representation of the certificate's
private key, in either [PKCS \`1` format](https://datatracker.ietf.org/doc/html/rfc8017)
or unencrypted [PKCS \`8` format.](https://datatracker.ietf.org/doc/html/rfc5208)
PKCS \`8` format is supported since 2.32; earlier releases only
support PKCS \`1`. You can use the `openssl rsa` tool to convert
PKCS \`8` keys to PKCS \`1`.

This property (or the `GTlsCertificate.privateKeyPem` property)
can be set when constructing a key (for example, from a file).
Since GLib 2.70, it is now also readable; however, be aware that if
the private key is backed by a PKCS \`11` URI – for example, if it
is stored on a smartcard – then this property will be `null`. If so,
the private key must be referenced via its PKCS \`11` URI,
`GTlsCertificate.privateKeyPkcs11Uri`. You must check both
properties to see if the certificate really has a private key.
When this property is read, the output format will be unencrypted
PKCS \`8`.

_Available since 2.28._

### `privateKeyPem`

`string` · default `null` · construct-only

The PEM (ASCII) encoded representation of the certificate's
private key in either [PKCS \`1` format](https://datatracker.ietf.org/doc/html/rfc8017)
("`BEGIN RSA PRIVATE KEY`") or unencrypted
[PKCS \`8` format](https://datatracker.ietf.org/doc/html/rfc5208)
("`BEGIN PRIVATE KEY`"). PKCS \`8` format is supported since 2.32;
earlier releases only support PKCS \`1`. You can use the `openssl rsa`
tool to convert PKCS \`8` keys to PKCS \`1`.

This property (or the `GTlsCertificate.privateKey` property)
can be set when constructing a key (for example, from a file).
Since GLib 2.70, it is now also readable; however, be aware that if
the private key is backed by a PKCS \`11` URI - for example, if it
is stored on a smartcard - then this property will be `null`. If so,
the private key must be referenced via its PKCS \`11` URI,
`GTlsCertificate.privateKeyPkcs11Uri`. You must check both
properties to see if the certificate really has a private key.
When this property is read, the output format will be unencrypted
PKCS \`8`.

_Available since 2.28._

### `privateKeyPkcs11Uri`

`string` · default `null` · construct-only

A URI referencing a [PKCS \`11`](https://docs.oasis-open.org/pkcs11/pkcs11-base/v3.0/os/pkcs11-base-v3.0-os.html)
object containing a private key.

_Available since 2.68._

### `subjectName`

`string` · default `null` · read-only, observe with `onNotifySubjectName`

The subject from the cert,
`null` if unavailable.

_Available since 2.70._

## Methods

Methods are called on the `Gio.TlsCertificate` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getDnsNames`

```ts
getDnsNames(): GLib.Bytes[] | null
```

Gets the value of `GTlsCertificate.dnsNames`.

**Returns** A `GPtrArray` of
`GBytes` elements, or `null` if it's not available.

_Available since 2.70._

### `getIpAddresses`

```ts
getIpAddresses(): Gio.InetAddress[] | null
```

Gets the value of `GTlsCertificate.ipAddresses`.

**Returns** A `GPtrArray`
of `GInetAddress` elements, or `null` if it's not available.

_Available since 2.70._

### `getIssuer`

```ts
getIssuer(): Gio.TlsCertificate | null
```

Gets the `GTlsCertificate` representing `cert`'s issuer, if known

**Returns** The certificate of `cert`'s issuer,
or `null` if `cert` is self-signed or signed with an unknown
certificate.

_Available since 2.28._

### `getIssuerName`

```ts
getIssuerName(): string | null
```

Returns the issuer name from the certificate.

**Returns** The issuer name, or `null` if it's not available.

_Available since 2.70._

### `getNotValidAfter`

```ts
getNotValidAfter(): GLib.DateTime | null
```

Returns the time at which the certificate became or will become invalid.

**Returns** The not-valid-after date, or `null` if it's not available.

_Available since 2.70._

### `getNotValidBefore`

```ts
getNotValidBefore(): GLib.DateTime | null
```

Returns the time at which the certificate became or will become valid.

**Returns** The not-valid-before date, or `null` if it's not available.

_Available since 2.70._

### `getSubjectName`

```ts
getSubjectName(): string | null
```

Returns the subject name from the certificate.

**Returns** The subject name, or `null` if it's not available.

_Available since 2.70._

### `isSame`

```ts
isSame(certTwo: Gio.TlsCertificate): boolean
```

Check if two `GTlsCertificate` objects represent the same certificate.
The raw DER byte data of the two certificates are checked for equality.
This has the effect that two certificates may compare equal even if
their `GTlsCertificate.issuer`, `GTlsCertificate.privateKey`, or
`GTlsCertificate.privateKeyPem` properties differ.

**Parameters**

- `certTwo`: second certificate to compare

**Returns** whether the same or not

_Available since 2.34._

### `verify`

```ts
verify(identity: Gio.SocketConnectable | null, trustedCa: Gio.TlsCertificate | null): Gio.TlsCertificateFlags
```

This verifies `cert` and returns a set of `GTlsCertificateFlags`
indicating any problems found with it. This can be used to verify a
certificate outside the context of making a connection, or to
check a certificate against a CA that is not part of the system
CA database.

If `cert` is valid, `G_TLS_CERTIFICATE_NO_FLAGS` is returned.

If `identity` is not `null`, `cert`'s name(s) will be compared against
it, and `G_TLS_CERTIFICATE_BAD_IDENTITY` will be set in the return
value if it does not match. If `identity` is `null`, that bit will
never be set in the return value.

If `trusted_ca` is not `null`, then `cert` (or one of the certificates
in its chain) must be signed by it, or else
`G_TLS_CERTIFICATE_UNKNOWN_CA` will be set in the return value. If
`trusted_ca` is `null`, that bit will never be set in the return
value.

GLib guarantees that if certificate verification fails, at least one
error will be set in the return value, but it does not guarantee
that all possible errors will be set. Accordingly, you may not safely
decide to ignore any particular type of error. For example, it would
be incorrect to mask `G_TLS_CERTIFICATE_EXPIRED` if you want to allow
expired certificates, because this could potentially be the only
error flag set even if other problems exist with the certificate.

Because TLS session context is not used, `GTlsCertificate` may not
perform as many checks on the certificates as `GTlsConnection` would.
For example, certificate constraints may not be honored, and
revocation checks may not be performed. The best way to verify TLS
certificates used by a TLS connection is to let `GTlsConnection`
handle the verification.

**Parameters**

- `identity`: the expected peer identity
- `trustedCa`: the certificate of a trusted authority

**Returns** the appropriate `GTlsCertificateFlags`

_Available since 2.28._
