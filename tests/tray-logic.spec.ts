import { expect, test } from '@playwright/test'
import type { MenuItemConstructorOptions } from 'electron'
import type { NowPlaying } from '../src/shared/api'
import { trayMenuTemplate, trayTooltip } from '../src/main/trayMenu'

const noop = (): void => {}
const actions = { show: noop, toggle: noop, next: noop, previous: noop, quit: noop }

const playing: NowPlaying = { trackId: 1, title: 'Song A', artist: 'Band', artworkId: null, playing: true, hasNext: true }

const item = (menu: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions | undefined =>
  menu.find((entry) => entry.label === label)

test('with nothing playing, the playback items are greyed out', () => {
  const menu = trayMenuTemplate(null, actions)
  expect(menu.map((entry) => entry.label ?? '-')).toEqual(['Play', 'Next', 'Previous', '-', 'Show Encore', '-', 'Quit Encore'])
  expect(item(menu, 'Play')?.enabled).toBe(false)
  expect(item(menu, 'Next')?.enabled).toBe(false)
  expect(item(menu, 'Previous')?.enabled).toBe(false)
})

test('while a song plays, the menu names it and offers Pause', () => {
  const menu = trayMenuTemplate(playing, actions)
  expect(menu[0]).toMatchObject({ label: 'Song A · Band', enabled: false })
  expect(item(menu, 'Pause')?.enabled).toBe(true)
  expect(item(menu, 'Next')?.enabled).toBe(true)
  expect(item(menu, 'Play')).toBeUndefined()
})

test('a paused song offers Play, and Next is off at the end of the list', () => {
  const menu = trayMenuTemplate({ ...playing, playing: false, hasNext: false }, actions)
  expect(item(menu, 'Play')?.enabled).toBe(true)
  expect(item(menu, 'Next')?.enabled).toBe(false)
  expect(item(menu, 'Previous')?.enabled).toBe(true)
})

test('an ampersand in a song shows as itself, not as a shortcut marker', () => {
  const menu = trayMenuTemplate({ ...playing, title: 'Rock & Roll', artist: null }, actions)
  expect(menu[0].label).toBe('Rock && Roll')
})

test('the tooltip names the song and is cut to fit', () => {
  expect(trayTooltip(null)).toBe('Encore')
  expect(trayTooltip(playing)).toBe('Encore · Song A · Band')
  const long = trayTooltip({ ...playing, title: 'x'.repeat(300) })
  expect(long).toHaveLength(127)
  expect(long.endsWith('…')).toBe(true)
})
