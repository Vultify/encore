/// <reference lib="dom" />
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeMp3, makeWav } from './fixtures/audio'
import { makePng } from './fixtures/png'
import { launchEncore } from './launch'

let musicDir: string
let app: ElectronApplication
let page: Page

test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-mini-'))
  writeFileSync(join(musicDir, 'Band - Song A.wav'), makeWav(8))
  writeFileSync(join(musicDir, 'Band - Song B.mp3'), makeMp3(6, { title: 'Song B', artist: 'Band', cover: makePng(40, 40, [200, 40, 60]) }))
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.beforeEach(async () => {
  ;({ app, page } = await launchEncore())
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
  await page.reload()
  await page.getByRole('tab', { name: 'Local files' }).click()
})

test.afterEach(async () => {
  await app.close()
})

const dock = (): Locator => page.getByRole('region', { name: 'Player' })

interface WindowInfo {
  title: string
  visible: boolean
  onTop: boolean
  focusable: boolean
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
}

// What each window is doing, from the main process.
const windows = (): Promise<WindowInfo[]> =>
  app.evaluate(({ BrowserWindow, screen }) =>
    BrowserWindow.getAllWindows().map((win) => ({
      title: win.getTitle(),
      visible: win.isVisible(),
      onTop: win.isAlwaysOnTop(),
      focusable: win.isFocusable(),
      bounds: win.getBounds(),
      workArea: screen.getDisplayMatching(win.getBounds()).workArea
    }))
  )

const windowNamed = async (title: string): Promise<WindowInfo | undefined> => (await windows()).find((win) => win.title === title)

// Pops out from the dock and returns the mini player's page.
async function popOut(): Promise<Page> {
  const opened = app.waitForEvent('window')
  await dock().getByRole('button', { name: 'Pop out to mini player' }).click()
  const mini = await opened
  await mini.waitForLoadState('domcontentloaded')
  return mini
}

test('popping out swaps the window for a floating pill at the bottom center of the screen', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song B' }).dblclick()
  const mini = await popOut()
  const pill = mini.getByRole('region', { name: 'Mini player' })

  await expect(pill).toContainText('Song B')
  await expect(pill).toContainText('Band')
  await expect(pill.locator('img')).toHaveAttribute('src', /^encore-art:\/\/local\//)
  // A title that fits stays still.
  await expect(pill.locator('[data-scrolling]')).toHaveCount(0)
  await expect.poll(async () => (await windowNamed('Encore mini player'))?.visible).toBe(true)
  expect((await windowNamed('Encore'))?.visible).toBe(false)

  const info = (await windowNamed('Encore mini player'))!
  expect(info.onTop).toBe(true)
  expect(info.focusable).toBe(false)
  const center = info.bounds.x + info.bounds.width / 2
  expect(Math.abs(center - (info.workArea.x + info.workArea.width / 2))).toBeLessThanOrEqual(1)
  // The pill sits just above the taskbar; the window's see-through margin may reach past it.
  expect(info.bounds.y + info.bounds.height).toBeGreaterThan(info.workArea.y + info.workArea.height - 80)

  await mini.waitForTimeout(400)
  await mini.screenshot({ path: 'test-results/mini-player.png' })
})

test('the pill controls the player in the main window', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  const mini = await popOut()
  const pill = mini.getByRole('region', { name: 'Mini player' })
  await expect(pill).toContainText('Song A')

  await pill.getByRole('button', { name: 'Pause' }).click()
  await expect(dock().getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(pill.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

  await pill.getByRole('button', { name: 'Next song' }).click()
  await expect(dock()).toContainText('Song B')
  await expect(pill).toContainText('Song B')
  await expect(pill.getByRole('button', { name: 'Next song' })).toBeDisabled()

  await pill.getByRole('button', { name: 'Previous song' }).click()
  await expect(pill).toContainText('Song A')
})

test('the pill sets the volume, mutes, and shows the volume set in Encore', async () => {
  await dock().getByRole('button', { name: 'Mute' }).hover()
  await dock().getByLabel('Volume').fill('0.6')
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  const mini = await popOut()
  const pill = mini.getByRole('region', { name: 'Mini player' })
  const slider = pill.getByRole('slider', { name: 'Volume' })
  await expect(slider).toHaveValue('0.6')

  await slider.fill('0.3')
  await expect(dock().getByLabel('Volume')).toHaveValue('0.3')

  await pill.getByRole('button', { name: 'Mute' }).click()
  await expect(dock().getByRole('button', { name: 'Unmute' })).toBeVisible()
  await expect(slider).toHaveValue('0')
  await pill.getByRole('button', { name: 'Unmute' }).click()
  await expect(slider).toHaveValue('0.3')

  // The mouse wheel nudges it.
  await slider.hover()
  await mini.mouse.wheel(0, -100)
  await expect(slider).toHaveValue('0.35')
  await expect(dock().getByLabel('Volume')).toHaveValue('0.35')

  // A volume that makes no sense is ignored.
  await mini.evaluate(() => (window as unknown as { encore: EncoreApi }).encore.mini.send({ volume: 7 }))
  await mini.waitForTimeout(300)
  await expect(dock().getByLabel('Volume')).toHaveValue('0.35')
})

test('a title too long for the pill scrolls, so all of it can be read', async () => {
  const title = 'A Song Title Far Too Long To Ever Fit In The Mini Player'
  const longDir = mkdtempSync(join(tmpdir(), 'encore-mini-long-'))
  try {
    writeFileSync(join(longDir, 'Long.mp3'), makeMp3(6, { title, artist: 'Band' }))
    await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), longDir)
    await page.reload()
    await page.getByRole('tab', { name: 'Local files' }).click()
    await page.getByRole('listitem').filter({ hasText: title }).dblclick()

    const mini = await popOut()
    const pill = mini.getByRole('region', { name: 'Mini player' })
    const scrolling = pill.locator('[data-scrolling]')
    await expect(scrolling).toHaveCount(1)
    await expect(scrolling).toHaveAttribute('title', title)
    expect(await scrolling.locator(':scope > span').evaluate((track) => track.getAnimations().length)).toBe(1)
    await mini.waitForTimeout(400)
    await mini.screenshot({ path: 'test-results/mini-player-long.png' })
  } finally {
    rmSync(longDir, { recursive: true, force: true })
  }
})

test('with motion off, a long title ends in an ellipsis and scrolls only while the pointer is on the pill', async () => {
  const title = 'A Song Title Far Too Long To Ever Fit In The Mini Player'
  const longDir = mkdtempSync(join(tmpdir(), 'encore-mini-long-'))
  try {
    writeFileSync(join(longDir, 'Long.mp3'), makeMp3(6, { title, artist: 'Band' }))
    await page.evaluate(async (dir) => {
      const { encore } = window as unknown as { encore: EncoreApi }
      await encore.preferences.update({ motion: 'off' })
      await encore.library.importPaths([dir])
    }, longDir)
    await page.reload()
    await page.getByRole('tab', { name: 'Local files' }).click()
    await page.getByRole('listitem').filter({ hasText: title }).dblclick()

    const mini = await popOut()
    const pill = mini.getByRole('region', { name: 'Mini player' })
    const titleLine = pill.locator(`[title="${title}"]`)
    await expect(titleLine).toHaveCount(1)
    await expect(titleLine).not.toHaveAttribute('data-scrolling')
    expect(await titleLine.evaluate((line) => getComputedStyle(line).textOverflow)).toBe('ellipsis')

    await pill.getByRole('button', { name: 'Previous song' }).hover()
    await expect(titleLine).toHaveAttribute('data-scrolling', 'true')
    await mini.mouse.move(2, 2)
    await expect(titleLine).not.toHaveAttribute('data-scrolling')
  } finally {
    rmSync(longDir, { recursive: true, force: true })
  }
})

test('the progress line moves along while a song plays', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  const mini = await popOut()
  const width = (): Promise<number> =>
    mini.getByRole('region', { name: 'Mini player' }).locator('span[aria-hidden="true"]').last().evaluate((line) => line.getBoundingClientRect().width)
  const before = await width()
  await expect.poll(width, { timeout: 4000 }).toBeGreaterThan(before + 20)
})

test('clicking the song brings Encore back and puts the pill away', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  const mini = await popOut()
  await mini.getByRole('button', { name: 'Open Encore' }).click()

  await expect.poll(async () => (await windowNamed('Encore'))?.visible).toBe(true)
  expect((await windowNamed('Encore mini player'))?.visible).toBe(false)
})

test('with nothing playing, the pill says so and its buttons are off', async () => {
  const mini = await popOut()
  const pill = mini.getByRole('region', { name: 'Mini player' })
  await expect(pill).toContainText('Not playing')
  await expect(pill.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
  await expect(pill.getByRole('button', { name: 'Next song' })).toBeDisabled()
  await expect(pill.getByRole('button', { name: 'Previous song' })).toBeDisabled()
})

test('only the mini player can send presses to the player', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  await expect(dock().getByRole('button', { name: 'Pause' })).toBeVisible()
  // The main window trying the mini player's channel is ignored.
  await page.evaluate(() => (window as unknown as { encore: EncoreApi }).encore.mini.send('toggle'))
  await page.waitForTimeout(300)
  await expect(dock().getByRole('button', { name: 'Pause' })).toBeVisible()
})
