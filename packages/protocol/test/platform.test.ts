import { describe, expect, it } from 'vitest'
import { APP_ID, packagingKind, platformPaths } from '../src/platform.ts'

const HOME = '/home/ana'

describe('platformPaths', () => {
  it('Linux dev / install.sh: XDG base directories with the usual fallbacks', () => {
    expect(platformPaths({ platform: 'linux', env: {}, home: HOME })).toEqual({
      kind: 'linux',
      dataDir: '/home/ana/.local/share/gnomeola',
      modelsDir: '/home/ana/.local/share/gnomeola/models',
      configDir: '/home/ana/.config/gnomeola',
      stateDir: '/home/ana/.local/state/gnomeola',
    })
    expect(
      platformPaths({
        platform: 'linux',
        env: { XDG_DATA_HOME: '/d', XDG_CONFIG_HOME: '/c', XDG_STATE_HOME: '/s' },
        home: HOME,
      }),
    ).toMatchObject({
      dataDir: '/d/gnomeola',
      modelsDir: '/d/gnomeola/models',
      configDir: '/c/gnomeola',
      stateDir: '/s/gnomeola',
    })
  })

  it('Flatpak: the sandbox XDG variables put everything under ~/.var/app/<id>', () => {
    // what `flatpak run` sets inside the sandbox
    const env = {
      FLATPAK_ID: APP_ID,
      XDG_DATA_HOME: `${HOME}/.var/app/${APP_ID}/data`,
      XDG_CONFIG_HOME: `${HOME}/.var/app/${APP_ID}/config`,
      XDG_STATE_HOME: `${HOME}/.var/app/${APP_ID}/.local/state`,
    }
    expect(platformPaths({ platform: 'linux', env, home: HOME })).toEqual({
      kind: 'flatpak',
      dataDir: '/home/ana/.var/app/org.gnome.Gnomeola/data/gnomeola',
      modelsDir: '/home/ana/.var/app/org.gnome.Gnomeola/data/gnomeola/models',
      configDir: '/home/ana/.var/app/org.gnome.Gnomeola/config/gnomeola',
      stateDir: '/home/ana/.var/app/org.gnome.Gnomeola/.local/state/gnomeola',
    })
  })

  it('macOS: ~/Library/Application Support/gnomeola, unless XDG variables are set explicitly', () => {
    const home = '/Users/ana'
    expect(platformPaths({ platform: 'darwin', env: {}, home })).toEqual({
      kind: 'macos',
      dataDir: '/Users/ana/Library/Application Support/gnomeola',
      modelsDir: '/Users/ana/Library/Application Support/gnomeola/models',
      configDir: '/Users/ana/Library/Application Support/gnomeola',
      stateDir: '/Users/ana/Library/Application Support/gnomeola/state',
    })
    expect(
      platformPaths({ platform: 'darwin', env: { XDG_CONFIG_HOME: '/Users/ana/.config' }, home }).configDir,
    ).toBe('/Users/ana/.config/gnomeola')
  })

  it('GNOMEOLA_DATA_DIR / GNOMEOLA_MODELS_DIR win everywhere; models do not follow the data dir', () => {
    for (const platform of ['linux', 'darwin']) {
      const p = platformPaths({ platform, env: { GNOMEOLA_DATA_DIR: '/tmp/d' }, home: HOME })
      expect(p.dataDir).toBe('/tmp/d')
      // test daemons on a temp data dir still find the user's downloaded models
      expect(p.modelsDir).not.toContain('/tmp/d')
      expect(platformPaths({ platform, env: { GNOMEOLA_MODELS_DIR: '/m' }, home: HOME }).modelsDir).toBe('/m')
    }
  })

  it('packagingKind', () => {
    expect(packagingKind({ platform: 'darwin', env: {} })).toBe('macos')
    expect(packagingKind({ platform: 'linux', env: { FLATPAK_ID: APP_ID } })).toBe('flatpak')
    expect(packagingKind({ platform: 'linux', env: {} })).toBe('linux')
  })
})
