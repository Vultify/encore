import { expect, test } from '@playwright/test'
import type { MenuItemConstructorOptions } from 'electron'
import type { NowPlaying, UpdateStatus } from '../src/shared/api'
import { trayMenuTemplate, trayTooltip, type TrayState } from '../src/main/trayMenu'

const noop = (): void => {}
const actions = { show: noop, toggleMiniPlayer: noop, toggle: noop, next: noop, previous: noop, showUpdate: noop, installUpdate: noop, quit: noop }

const playing: NowPlaying = {
  trackId: 1,
  title: 'Song A',
  artist: 'Band',
  artworkId: null,
  playing: true,
  hasNext: true,
  position: 12,
  duration: 200,
  volume: 0.8,
  muted: false
}

const menuFor = (
  now: NowPlaying | null,
  miniPlayerOpen = false,
  shortcut = 'Control+Alt+Space',
  update: UpdateStatus = { state: 'current' }
): MenuItemConstructorOptions[] => trayMenuTemplate({ now, miniPlayerOpen, shortcut, update } satisfies TrayState, actions)

const item = (menu: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions | undefined =>
  menu.find((entry) => entry.label === label)

test('with nothing playing, the playback items are greyed out', () => {
  const menu = menuFor(null)
  expect(menu.map((entry) => entry.label ?? '-')).toEqual(['Play', 'Next', 'Previous', '-', 'Show Encore', 'Mini player', '-', 'Quit Encore'])
  expect(item(menu, 'Play')?.enabled).toBe(false)
  expect(item(menu, 'Next')?.enabled).toBe(false)
  expect(item(menu, 'Previous')?.enabled).toBe(false)
})

test('while a song plays, the menu names it and offers Pause', () => {
  const menu = menuFor(playing)
  expect(menu[0]).toMatchObject({ label: 'Song A · Band', enabled: false })
  expect(item(menu, 'Pause')?.enabled).toBe(true)
  expect(item(menu, 'Next')?.enabled).toBe(true)
  expect(item(menu, 'Play')).toBeUndefined()
})

test('a paused song offers Play, and Next is off at the end of the list', () => {
  const menu = menuFor({ ...playing, playing: false, hasNext: false })
  expect(item(menu, 'Play')?.enabled).toBe(true)
  expect(item(menu, 'Next')?.enabled).toBe(false)
  expect(item(menu, 'Previous')?.enabled).toBe(true)
})

test('the mini player item shows its shortcut and is ticked while it is open', () => {
  expect(item(menuFor(playing), 'Mini player')).toMatchObject({
    type: 'checkbox',
    checked: false,
    accelerator: 'Control+Alt+Space',
    registerAccelerator: false
  })
  expect(item(menuFor(playing, true), 'Mini player')?.checked).toBe(true)
  expect(item(menuFor(playing, false, 'Control+Shift+M'), 'Mini player')?.accelerator).toBe('Control+Shift+M')
})

test('an ampersand in a song shows as itself, not as a shortcut marker', () => {
  const menu = menuFor({ ...playing, title: 'Rock & Roll', artist: null })
  expect(menu[0].label).toBe('Rock && Roll')
})

test('the tooltip names the song and is cut to fit', () => {
  expect(trayTooltip(null)).toBe('Encore')
  expect(trayTooltip(playing)).toBe('Encore · Song A · Band')
  const long = trayTooltip({ ...playing, title: 'x'.repeat(300) })
  expect(long).toHaveLength(127)
  expect(long.endsWith('…')).toBe(true)
})

test('a new version gets its own item above Quit, which restarts into it once downloaded', () => {
  const labels = (update: UpdateStatus): string[] => menuFor(null, false, 'Control+Alt+Space', update).map((entry) => entry.label ?? '-')
  expect(labels({ state: 'available', version: '1.1.0' }).slice(-3)).toEqual(['Update to Encore 1.1.0', '-', 'Quit Encore'])
  expect(item(menuFor(null, false, 'Control+Alt+Space', { state: 'available', version: '1.1.0' }), 'Update to Encore 1.1.0')?.click).toBe(
    actions.showUpdate
  )

  const downloading = menuFor(null, false, 'Control+Alt+Space', { state: 'downloading', version: '1.1.0', percent: 40 })
  expect(item(downloading, 'Downloading Encore 1.1.0…')?.enabled).toBe(false)

  const ready = menuFor(null, false, 'Control+Alt+Space', { state: 'ready', version: '1.1.0' })
  expect(item(ready, 'Restart to update Encore')?.click).toBe(actions.installUpdate)

  for (const state of ['off', 'idle', 'checking', 'current', 'error'] as const) {
    expect(labels({ state }).slice(-2)).toEqual(['-', 'Quit Encore'])
    expect(labels({ state })).not.toContain('Restart to update Encore')
  }
})
