#!/usr/bin/env node
// A stand-in for macOS `/usr/bin/security`, covering the subset KeychainKeyring uses:
//   security -i                       read command lines from stdin (tokenised like split_line() in
//                                     Apple's SecurityTool/macOS/security.c)
//   security find-generic-password -a A -s S [-w] [keychain]
//   security delete-generic-password -a A -s S [keychain]
//   security add-generic-password [-U] -a A -s S [-l L] -w PW [keychain]
// Exit codes match the real tool (low byte of the OSStatus): 44 not found, 45 duplicate, 36 locked.
//
// Env:
//   FAKE_SECURITY_DB        JSON file holding the items (required for anything but -h)
//   FAKE_SECURITY_ARGV_LOG  every invocation's argv is appended here as one JSON line
//   FAKE_SECURITY_MODE      "locked" -> every command fails with 36; "hang" -> never exits
//
// Unlike the real tool, add-generic-password REFUSES a password passed in argv (outside -i), so tests
// prove the secret never goes through the command line.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
if (process.env.FAKE_SECURITY_ARGV_LOG)
  appendFileSync(process.env.FAKE_SECURITY_ARGV_LOG, `${JSON.stringify(argv)}\n`)

const mode = process.env.FAKE_SECURITY_MODE

function main() {
  if (argv[0] === '-h' || argv.length === 0) {
    process.stderr.write('Usage: security [-h] [-i] [-l] [-p prompt] [-q] [-v] [command] [opt ...]\n')
    process.exit(0)
  }
  if (argv[0] === '-i') {
    let input = ''
    process.stdin.on('data', (d) => {
      input += d.toString()
    })
    process.stdin.on('end', () => {
      // like the real loop: run each line, the exit status is the last command's result
      let result = 0
      for (const line of input.split('\n')) {
        const words = splitLine(line)
        if (words.length === 0) continue
        result = execute(words, true)
        if (result !== 0) process.stderr.write(`${words[0]}: returned ${result}\n`)
      }
      process.exit(result)
    })
    return
  }
  process.exit(execute(argv, false))
}

/** Port of split_line(): whitespace-separated words, "..." or '...' quoting, backslash escapes. */
function splitLine(line) {
  const out = []
  let cur = ''
  let state = 'ws'
  let q = ''
  for (const ch of line) {
    if (state === 'ws') {
      if (/\s/.test(ch)) continue
      cur = ''
      if (ch === '"' || ch === "'") {
        q = ch
        state = 'quoted'
        continue
      }
      state = 'arg'
    }
    if (state === 'arg') {
      if (ch === '\\') state = 'arg-esc'
      else if (/\s/.test(ch)) {
        out.push(cur)
        state = 'ws'
      } else cur += ch
    } else if (state === 'quoted') {
      if (ch === '\\') state = 'quoted-esc'
      else if (ch === q) {
        out.push(cur)
        state = 'ws'
      } else cur += ch
    } else if (state === 'arg-esc') {
      cur += ch
      state = 'arg'
    } else if (state === 'quoted-esc') {
      cur += ch
      state = 'quoted'
    }
  }
  if (state !== 'ws') out.push(cur)
  return out
}

const WITH_VALUE = new Set(['a', 's', 'l', 'c', 'C', 'D', 'j', 'T', 'G', 'r', 'X'])

/** getopt-ish: returns { opts, rest }. `-w` takes a value only for add-generic-password. */
function parse(args, wTakesValue) {
  const opts = {}
  let i = 0
  for (; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('-') || a === '-') break
    const f = a.slice(1)
    if (WITH_VALUE.has(f) || (f === 'w' && wTakesValue)) {
      // a trailing value-less flag (for add -w: the real tool would prompt on the tty)
      if (i + 1 >= args.length) opts[f] = null
      else opts[f] = args[++i]
    } else opts[f] = true
  }
  return { opts, rest: args.slice(i) }
}

function load() {
  const path = process.env.FAKE_SECURITY_DB
  if (!path) {
    process.stderr.write('fake-security: FAKE_SECURITY_DB not set\n')
    process.exit(1)
  }
  return { path, db: existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {} }
}

const NOT_FOUND =
  'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.\n'

function execute(words, interactive) {
  const [cmd, ...args] = words
  if (mode === 'locked') {
    process.stderr.write(`security: ${cmd}: User interaction is not allowed.\n`)
    return 36
  }
  const known = ['find-generic-password', 'delete-generic-password', 'add-generic-password']
  if (!known.includes(cmd)) {
    process.stderr.write(`security: unknown command "${cmd}"\n`)
    return 1
  }
  const { opts, rest } = parse(args, cmd === 'add-generic-password')
  if (typeof opts.a !== 'string' || typeof opts.s !== 'string') {
    process.stderr.write(`Usage: security ${cmd} -a account -s service ...\n`)
    return 2
  }
  const keychain = rest[0] ?? '<default>'
  const { path, db } = load()
  const items = db[keychain] ?? {}
  const id = `${opts.s}\u0000${opts.a}`
  const save = () => {
    db[keychain] = items
    writeFileSync(path, JSON.stringify(db))
  }

  if (cmd === 'find-generic-password') {
    const item = items[id]
    if (!item) {
      process.stderr.write(NOT_FOUND)
      return 44
    }
    if (opts.w) process.stdout.write(`${item.password}\n`)
    else process.stdout.write(`keychain: "${keychain}"\nclass: "genp"\n    "acct"<blob>="${opts.a}"\n`)
    return 0
  }

  if (cmd === 'delete-generic-password') {
    if (!items[id]) {
      process.stderr.write(NOT_FOUND)
      return 44
    }
    delete items[id]
    save()
    process.stdout.write(`keychain: "${keychain}"\npassword has been deleted.\n`)
    return 0
  }

  // add-generic-password
  if (!interactive && typeof opts.w === 'string') {
    process.stderr.write('fake-security: REFUSING add-generic-password with the password in argv\n')
    return 1
  }
  if (typeof opts.w !== 'string') {
    process.stderr.write('security: no password given and no tty to prompt on\n')
    return 1
  }
  if (items[id] && !opts.U) {
    process.stderr.write(
      `security: SecKeychainItemCreateFromContent (${keychain}): The specified item already exists in the keychain.\n`,
    )
    return 45
  }
  items[id] = { password: opts.w, label: typeof opts.l === 'string' ? opts.l : opts.s }
  save()
  return 0
}

if (mode === 'hang') setInterval(() => {}, 1 << 30)
else main()
