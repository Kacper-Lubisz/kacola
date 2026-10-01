// A reader for the GVariant text format that `gdbus call` and `gsettings get` print — just the subset
// those print for the Shell's extension API: tuples, arrays, dictionaries, variants, strings, numbers
// and booleans, with the optional type annotations (`@a{sv} {}`, `@as []`, `uint32 5`).
//
//   ({'uuid': <'x@y'>, 'state': <1.0>, 'enabled': <true>, 'shell-version': <[<'50'>]>},)  → [{…}]
//   ['a@b', 'c@d']                                                                       → ['a@b', 'c@d']
//
// Variants are unwrapped (`<1.0>` → 1), tuples become arrays, dictionaries become plain objects.

export type GValue = string | number | boolean | null | GValue[] | { [k: string]: GValue }

const TYPE_WORDS = new Set([
  'byte',
  'int16',
  'uint16',
  'int32',
  'uint32',
  'int64',
  'uint64',
  'double',
  'boolean',
  'string',
  'objectpath',
  'signature',
  'handle',
])

export function parseGVariant(text: string): GValue {
  let i = 0
  const s = text.trim()
  const fail = (what: string): never => {
    throw new Error(`gvariant: ${what} at ${i} in ${JSON.stringify(s.slice(0, 200))}`)
  }
  const ws = () => {
    while (i < s.length && /\s/.test(s[i]!)) i++
  }
  const eat = (c: string) => {
    ws()
    if (s[i] !== c) fail(`expected ${c}`)
    i++
  }
  const str = (): string => {
    const q = s[i]!
    i++
    let out = ''
    while (i < s.length && s[i] !== q) {
      if (s[i] === '\\') {
        const n = s[i + 1]
        i += 2
        if (n === 'n') out += '\n'
        else if (n === 't') out += '\t'
        else if (n === 'u') {
          out += String.fromCharCode(Number.parseInt(s.slice(i, i + 4), 16))
          i += 4
        } else if (n === 'U') {
          out += String.fromCodePoint(Number.parseInt(s.slice(i, i + 8), 16))
          i += 8
        } else out += n ?? ''
      } else out += s[i++]
    }
    if (s[i] !== q) fail('unterminated string')
    i++
    return out
  }
  const list = (close: string): GValue[] => {
    const out: GValue[] = []
    ws()
    while (s[i] !== close) {
      out.push(value())
      ws()
      if (s[i] === ',') i++
      ws()
      if (i >= s.length) fail(`expected ${close}`)
    }
    i++
    return out
  }
  const value = (): GValue => {
    ws()
    const c = s[i]
    if (c === undefined) return fail('unexpected end')
    if (c === '@') {
      // a type annotation: skip the type string up to the next space
      while (i < s.length && !/\s/.test(s[i]!)) i++
      return value()
    }
    if (c === '(') {
      i++
      return list(')')
    }
    if (c === '[') {
      i++
      return list(']')
    }
    if (c === '<') {
      i++
      const v = value()
      eat('>')
      return v
    }
    if (c === '{') {
      i++
      const obj: { [k: string]: GValue } = {}
      ws()
      while (s[i] !== '}') {
        const k = value()
        eat(':')
        obj[String(k)] = value()
        ws()
        if (s[i] === ',') i++
        ws()
        if (i >= s.length) fail('expected }')
      }
      i++
      return obj
    }
    if (c === "'" || c === '"') return str()
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i))?.[0]
    if (word) {
      i += word.length
      if (word === 'true') return true
      if (word === 'false') return false
      if (word === 'nothing') return null
      if (word === 'just') return value()
      if (TYPE_WORDS.has(word)) return value()
      return fail(`unknown word ${word}`)
    }
    const num = /^[-+]?(0x[0-9a-fA-F]+|[0-9]*\.?[0-9]+(e[-+]?[0-9]+)?|inf|nan)/.exec(s.slice(i))?.[0]
    if (num) {
      i += num.length
      return Number(num)
    }
    return fail(`unexpected ${c}`)
  }
  const v = value()
  ws()
  if (i !== s.length) fail('trailing text')
  return v
}

/** GVariant text for a string array, as `gsettings set` takes it. */
export function formatStrv(items: readonly string[]): string {
  if (!items.length) return '@as []'
  return `[${items.map((x) => `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`
}
