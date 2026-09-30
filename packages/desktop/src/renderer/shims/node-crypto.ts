// The protocol's id generator imports node:crypto. The renderer never mints ids, but the module graph
// reaches it; Web Crypto stands in (aliased in electron.vite.config.ts and tsconfig.web.json, the same
// shim packages/web uses).
export const randomBytes = (n: number) => {
  const b = crypto.getRandomValues(new Uint8Array(n))
  return { toString: (_enc?: string) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('') }
}
