#!/usr/bin/env bash
# Makes "kacola Local Signing", a self-signed code-signing identity in the login keychain, once per Mac.
# scripts/build-macos.ts signs with it when it is there. macOS keys kacola's permissions (calendars,
# microphone, screen recording) to the app's signature: an ad-hoc signature is new on every build, so
# every rebuild loses them; one identity across builds keeps them.
#
#   packaging/macos/signing-identity.sh          (idempotent; asks for your login password once if
#                                                 macOS wants the certificate trusted for code signing)
# Remove it with: security delete-identity -c "kacola Local Signing"
set -euo pipefail

NAME="kacola Local Signing"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning | grep -q "\"$NAME\""; then
  echo "$NAME: already set up"
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

if ! security find-certificate -c "$NAME" "$KEYCHAIN" >/dev/null 2>&1; then
  cat >"$tmp/cert.cnf" <<EOF
[req]
distinguished_name = dn
prompt = no
x509_extensions = ext
[dn]
CN = $NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
EOF
  # /usr/bin/openssl (LibreSSL) writes a PKCS#12 that `security import` reads; OpenSSL 3's default does not
  /usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$tmp/cert.cnf" \
    -keyout "$tmp/key.pem" -out "$tmp/cert.pem" 2>/dev/null
  pass=$(/usr/bin/openssl rand -hex 16)
  /usr/bin/openssl pkcs12 -export -name "$NAME" -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
    -out "$tmp/id.p12" -passout "pass:$pass"
  # -T: codesign may use the key without asking each build
  security import "$tmp/id.p12" -k "$KEYCHAIN" -P "$pass" -T /usr/bin/codesign >/dev/null
  echo "$NAME: created in the login keychain"
else
  security find-certificate -c "$NAME" -p "$KEYCHAIN" >"$tmp/cert.pem"
fi

if ! security find-identity -v -p codesigning | grep -q "\"$NAME\""; then
  echo "$NAME: trusting it for code signing only (macOS asks for your login password)"
  security add-trusted-cert -r trustAsRoot -p codeSign -k "$KEYCHAIN" "$tmp/cert.pem"
fi

cp /usr/bin/true "$tmp/probe"
codesign --force -s "$NAME" "$tmp/probe" && codesign --verify "$tmp/probe"
echo "$NAME: ready (builds from scripts/build-macos.ts now keep kacola's permissions)"
