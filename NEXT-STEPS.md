# Next steps: deploying sync with kacperlubisz.com accounts

> **Remove this file** once the sync server is live and the Macs sync through it. It is a to-do list,
> not documentation: docs/hosting.md ("Two-way sync", "Vercel") is the lasting version.

## The whole deploy, in order

The code is done in three places; nothing is deployed yet (as of 2 Nov 2026, only heavy.kacperlubisz.com
resolves):

| repo | branch | what |
| --- | --- | --- |
| `Kacper-Lubisz/accounts` | `main` | the sign-in service, accounts.kacperlubisz.com |
| `Kacper-Lubisz/kacola` | `main` | two-way sync with account sign-in; the hosted server is `packages/vercel` |
| `Kacper-Lubisz/heavy` | `accounts-sign-in` (no PR) | heavy signs in through accounts instead of its own Better Auth |

1. **Accounts**: Vercel project + Neon + DNS + variables; do **not** run `/setup` yet if heavy moves
   next (its users, the owner among them, come over with their ids).
2. **kacola's sync server** at kacola.kacperlubisz.com.
3. **heavy cutover**: import heavy's users into accounts (rehearse on Neon branches first), then merge
   `accounts-sign-in`.
4. **Your account**: sign in by emailed link, add a passkey at accounts.kacperlubisz.com/account, keep
   the recovery code in the password manager. (If heavy is not moving yet, make it at `/setup` instead.)

Tooling: there is no Vercel CLI on the Mac yet (the dashboard works too; installing it goes in
machine-setup). DNS is at GoDaddy: one CNAME per subdomain, to the value Vercel shows.

## This repo (step 2, after accounts is live)

1. Vercel project for `packages/vercel`, domain `kacola.kacperlubisz.com` (CNAME at GoDaddy), Neon
   Postgres through the Marketplace. docs/hosting.md, "Vercel" → "Deploying".
2. Variables: `KACOLA_AUTH_SECRET` (`openssl rand -hex 32`), `KACOLA_ADMIN_TOKEN`,
   `KACOLA_ACCOUNTS_ISSUER=https://accounts.kacperlubisz.com` (also read at build time: the viewer then
   signs in with accounts), `KACOLA_ACCOUNTS_OWNERS` (your account id or email),
   `KACOLA_PUBLIC_URL=https://kacola.kacperlubisz.com`.
3. Smoke-test the preview: `packages/vercel/test/preview.e2e.test.ts` (docs/hosting.md, step 6).
4. On each Mac: uncomment `KACOLA_SYNC_URL=https://kacola.kacperlubisz.com` in kacola.env
   (Preferences → Open config file), restart the daemon when idle (`kacola daemon restart`), then
   Preferences › Advanced › Sync → Sign in. Open the URL in a browser to sign the viewer in.
