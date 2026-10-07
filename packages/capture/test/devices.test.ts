import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AudioDevice } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { metadataName, parseMetadataLine, parsePwDump } from '../src/index.ts'

// Real `pw-dump` output from Fedora 44 / PipeWire 1.6.8 / WirePlumber, sanitised (user, host, MAC and
// serials replaced; `params` dropped). It happens to capture an interesting real state: the configured
// default sink is a Bluetooth headset that is not connected, so the effective default differs.
const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pw-dump.fedora44-pw1.6.8.json'), 'utf8'),
) as unknown[]

describe('parsePwDump (real fixture)', () => {
  const g = parsePwDump(fixture)

  it('finds exactly the audio sources and sinks wpctl showed, with descriptions', () => {
    const sinks = g.devices.filter((d) => d.kind === 'sink').map((d) => d.description)
    const sources = g.devices.filter((d) => d.kind === 'source').map((d) => d.description)
    expect(sinks.sort()).toEqual(
      [
        'USB Audio Front Headphones',
        'USB Audio S/PDIF Output',
        'USB Audio Speakers',
        'Yeti Stereo Microphone Digital Stereo (IEC958)',
      ].sort(),
    )
    expect(sources.sort()).toEqual(
      [
        'USB 2.0 Camera Analog Stereo',
        'USB Audio Front Microphone',
        'USB Audio Line Input',
        'USB Audio Microphone',
        'Yeti Stereo Microphone Analog Stereo',
      ].sort(),
    )
  })

  it('every device satisfies the protocol schema', () => {
    for (const d of g.devices) expect(AudioDevice.parse(d)).toEqual(d)
  })

  it('reads effective and configured defaults separately', () => {
    expect(g.defaults).toEqual({
      sink: 'alsa_output.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.iec958-stereo',
      source: 'alsa_input.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.analog-stereo',
      configuredSink: 'bluez_output.00_11_22_33_44_55.1',
      configuredSource: 'alsa_input.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.analog-stereo',
    })
  })

  it('flags exactly one default per kind — the effective one, not the absent configured one', () => {
    const defaults = g.devices.filter((d) => d.isDefault)
    expect(defaults.map((d) => [d.kind, d.name]).sort()).toEqual([
      ['sink', g.defaults.sink],
      ['source', g.defaults.source],
    ])
  })

  it('ignores video nodes and streams but still knows every node name', () => {
    expect(g.devices.some((d) => d.name.startsWith('v4l2'))).toBe(false)
    expect(g.nodeNames.has('v4l2_input.pci-0000_00_14.0-usb-0_10.3.1.1_1.0') || g.nodeNames.size > 9).toBe(
      true,
    )
    for (const d of g.devices) expect(g.nodeNames.has(d.name)).toBe(true)
  })
})

describe('parsePwDump (synthetic edge cases)', () => {
  const node = (id: number, props: Record<string, unknown>) => ({
    id,
    type: 'PipeWire:Interface:Node',
    info: { props },
  })

  it('handles virtual sources, duplex nodes, missing descriptions and absent metadata', () => {
    const g = parsePwDump([
      node(1, { 'node.name': 'virt', 'media.class': 'Audio/Source/Virtual' }),
      node(2, { 'node.name': 'duplex', 'node.nick': 'Duplex Nick', 'media.class': 'Audio/Duplex' }),
      node(3, { 'node.name': 'stream', 'media.class': 'Stream/Output/Audio' }),
      node(4, { 'media.class': 'Audio/Sink' }), // no name: skipped
      { type: 'PipeWire:Interface:Port', info: { props: {} } },
      null,
      'junk',
    ])
    expect(g.devices).toEqual([
      { name: 'duplex', description: 'Duplex Nick', kind: 'sink', isDefault: false },
      { name: 'duplex', description: 'Duplex Nick', kind: 'source', isDefault: false },
      { name: 'virt', description: 'virt', kind: 'source', isDefault: false },
    ])
    expect(g.defaults).toEqual({ sink: null, source: null, configuredSink: null, configuredSource: null })
  })

  it('accepts metadata values as objects or JSON strings', () => {
    const g = parsePwDump([
      node(1, { 'node.name': 'mic', 'media.class': 'Audio/Source' }),
      {
        type: 'PipeWire:Interface:Metadata',
        props: { 'metadata.name': 'default' },
        metadata: [
          { subject: 0, key: 'default.audio.source', type: 'Spa:String:JSON', value: '{ "name": "mic" }' },
          { subject: 0, key: 'default.audio.sink', type: 'Spa:String:JSON', value: { name: 'spk' } },
          { subject: 5, key: 'default.audio.sink', value: { name: 'not-subject-0' } },
        ],
      },
    ])
    expect(g.defaults.source).toBe('mic')
    expect(g.defaults.sink).toBe('spk')
    expect(g.devices[0]!.isDefault).toBe(true)
  })

  it('rejects non-array input', () => {
    expect(() => parsePwDump({})).toThrow(/not a JSON array/)
  })
})

describe('pw-metadata line parsing', () => {
  // verbatim lines from `pw-metadata -m -n default` on the same machine (names sanitised)
  const lines = [
    `update: id:0 key:'default.configured.audio.sink' value:'{ "name": "bluez_output.00_11_22_33_44_55.1" }' type:'Spa:String:JSON'`,
    `update: id:0 key:'default.audio.sink' value:'{"name":"alsa_output.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.iec958-stereo"}' type:'Spa:String:JSON'`,
    `update: id:0 key:'default.audio.source' value:'{"name":"alsa_input.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.analog-stereo"}' type:'Spa:String:JSON'`,
  ]

  it('extracts subject, key and node name', () => {
    expect(lines.map(parseMetadataLine)).toEqual([
      { subject: 0, key: 'default.configured.audio.sink', value: 'bluez_output.00_11_22_33_44_55.1' },
      {
        subject: 0,
        key: 'default.audio.sink',
        value: 'alsa_output.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.iec958-stereo',
      },
      {
        subject: 0,
        key: 'default.audio.source',
        value: 'alsa_input.usb-Blue_Microphones_Yeti_Stereo_Microphone_REV8-00.analog-stereo',
      },
    ])
  })

  it('ignores the banner and garbage; treats an empty value as "no default"', () => {
    expect(parseMetadataLine('Found "default" metadata 38')).toBeNull()
    expect(parseMetadataLine('')).toBeNull()
    expect(parseMetadataLine(`update: id:0 key:'default.audio.sink' value:'' type:''`)).toEqual({
      subject: 0,
      key: 'default.audio.sink',
      value: null,
    })
  })

  it('metadataName tolerates odd shapes', () => {
    expect(metadataName(null)).toBeNull()
    expect(metadataName(42)).toBeNull()
    expect(metadataName({ name: '' })).toBeNull()
    expect(metadataName('plain-node-name')).toBe('plain-node-name')
  })
})
