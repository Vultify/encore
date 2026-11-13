/// <reference lib="dom" />
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { makeWav } from './fixtures/audio'
import { dropFiles } from './drop'
import { startLookupServer, type LookupServer } from './fixtures/lookup-server'
import { launchEncore, makeDataDir } from './launch'

let app: ElectronApplication
let page: Page
let dirs: string[] = []

const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

test.afterEach(async () => {
  await app?.close()
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

async function open(dataDir?: string, env: Record<string, string> = {}, args: string[] = []): Promise<void> {
  ;({ app, page } = await launchEncore(dataDir, env, args))
}

async function openSettings(): Promise<Locator> {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('region', { name: 'Settings' })
  await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible()
  return settings
}

// The accent is a registered color, so the browser reports it as rgb().
const accent = (): Promise<string> => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())

const registered = (accelerator: string): Promise<boolean> =>
  app.evaluate(({ globalShortcut }, value) => globalShortcut.isRegistered(value), accelerator)

// A copy of Encore already running, like one open in dev mode, holds Ctrl + Alt + Space, so the test copy can't.
async function skipUnlessOwnsDefaultShortcut(): Promise<void> {
  test.skip(!(await registered('Control+Alt+Space')), 'Another copy of Encore is holding Ctrl + Alt + Space')
}

// The Windows folder picker can't be clicked by a test, so it answers with this folder instead.
const pickFolder = (folder: string): Promise<void> =>
  app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog
  }, folder)

const localFiles = (): Locator => page.getByRole('list', { name: 'Local files' }).getByRole('listitem')

test('the gear opens Settings with every group', async () => {
  await open()
  const settings = await openSettings()
  for (const group of ['Mini player', 'Look', 'Home', 'Music', 'Startup']) {
    await expect(settings.getByRole('region', { name: group })).toBeVisible()
  }
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: 'test-results/settings.png' })
})

test('a fixed accent color replaces the album color, and is kept after a restart', async () => {
  const dataDir = makeDataDir()
  dirs.push(dataDir)
  await open(dataDir)
  const settings = await openSettings()
  await expect(settings.getByRole('radio', { name: 'Follow the album cover' })).toHaveAttribute('aria-checked', 'true')

  await settings.getByRole('radio', { name: 'Violet' }).click()
  await expect(settings.getByRole('radio', { name: 'Violet' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(accent).toBe('rgb(199, 125, 255)')
  await app.close()

  await open(dataDir)
  await expect.poll(accent).toBe('rgb(199, 125, 255)')
  const again = await openSettings()
  await again.getByRole('radio', { name: 'Follow the album cover' }).click()
  await expect.poll(accent).toBe('rgb(43, 196, 168)')
})

test('Motion matches Windows unless set On or Off, and is kept after a restart', async () => {
  const dataDir = makeDataDir()
  dirs.push(dataDir)
  await open(dataDir)
  const motion = (): Promise<string | undefined> => page.evaluate(() => document.documentElement.dataset.motion)
  const settings = await openSettings()
  const choices = settings.getByRole('radiogroup', { name: 'Motion' })
  await expect(choices.getByRole('radio', { name: 'Match Windows' })).toHaveAttribute('aria-checked', 'true')

  // Matching Windows follows its Animation effects setting as it changes.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(motion).toBe('full')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(motion).toBe('reduce')

  // On wins over Windows, and so does Off.
  await choices.getByRole('radio', { name: 'On' }).click()
  await expect.poll(motion).toBe('full')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await choices.getByRole('radio', { name: 'Off' }).click()
  await expect.poll(motion).toBe('reduce')
  await settings.getByRole('region', { name: 'Look' }).screenshot({ path: 'test-results/settings-look.png' })
  await app.close()

  await open(dataDir)
  await expect.poll(motion).toBe('reduce')
  const again = await openSettings()
  await expect(again.getByRole('radiogroup', { name: 'Motion' }).getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true')
})

test('recording a new mini player shortcut swaps the global one, and Reset goes back', async () => {
  await open()
  await skipUnlessOwnsDefaultShortcut()
  const settings = await openSettings()
  const row = settings.getByRole('region', { name: 'Mini player' })
  await expect(row).toContainText('CtrlAltSpace')

  await row.getByRole('button', { name: 'Change' }).click()
  await expect(row).toContainText('Press the new keys')
  // A plain key isn't a shortcut.
  await page.keyboard.press('KeyK')
  await expect(row).toContainText('Hold Ctrl, Alt, or the Windows key')
  await page.keyboard.press('Control+Shift+KeyK')
  await expect(row).toContainText('CtrlShiftK')
  await expect.poll(() => registered('Control+Shift+K')).toBe(true)
  expect(await registered('Control+Alt+Space')).toBe(false)

  await row.getByRole('button', { name: 'Reset' }).click()
  await expect(row).toContainText('CtrlAltSpace')
  await expect.poll(() => registered('Control+Alt+Space')).toBe(true)
  expect(await registered('Control+Shift+K')).toBe(false)
})

test('a shortcut that is already taken is refused and the old one stays', async () => {
  await open()
  await app.evaluate(({ globalShortcut }) => globalShortcut.register('Control+Shift+J', () => {}))
  const settings = await openSettings()
  const row = settings.getByRole('region', { name: 'Mini player' })

  await row.getByRole('button', { name: 'Change' }).click()
  await page.keyboard.press('Control+Shift+KeyJ')
  await expect(row).toContainText('Ctrl + Shift + J is already used')
  await expect(row).toContainText('CtrlAltSpace')

  // Escape leaves recording without changing anything.
  await row.getByRole('button', { name: 'Change' }).click()
  await page.keyboard.press('Escape')
  await expect(row.getByRole('button', { name: 'Change' })).toBeVisible()
  await expect(row).toContainText('CtrlAltSpace')
})

test('while recording, held keys show right away and the current shortcut steps aside', async () => {
  await open()
  await skipUnlessOwnsDefaultShortcut()
  const settings = await openSettings()
  const row = settings.getByRole('region', { name: 'Mini player' })

  await row.getByRole('button', { name: 'Change' }).click()
  await expect.poll(() => registered('Control+Alt+Space')).toBe(false)
  await page.keyboard.down('Alt')
  await expect(row).toContainText('Alt+ …')
  await page.keyboard.up('Alt')
  await expect(row).toContainText('Press the new keys')

  // Cancelling takes the shortcut back.
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect.poll(() => registered('Control+Alt+Space')).toBe(true)

  // Pressing the current shortcut while recording keeps it, instead of opening the mini player.
  await row.getByRole('button', { name: 'Change' }).click()
  await page.keyboard.press('Control+Alt+Space')
  await expect(row).toContainText('CtrlAltSpace')
  await expect.poll(() => registered('Control+Alt+Space')).toBe(true)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
})

test('music folders: adding one reads its songs, new songs show up by themselves, and it is caught up after a restart', async () => {
  const dataDir = makeDataDir()
  dirs.push(dataDir)
  const folder = tempDir('encore-folder-')
  writeFileSync(join(folder, 'Band - First.wav'), makeWav(3))

  await open(dataDir)
  await pickFolder(folder)
  const settings = await openSettings()
  await settings.getByRole('button', { name: 'Add folder' }).click()
  await expect(settings.getByRole('list', { name: 'Music folders' })).toContainText(folder)
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 song' })).toBeVisible()

  // A song saved into the folder while Encore is open.
  writeFileSync(join(folder, 'Band - Second.wav'), makeWav(3))
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Library' }).click()
  await page.getByRole('tab', { name: 'Local files' }).click()
  await expect(localFiles().filter({ hasText: 'Second' })).toBeVisible({ timeout: 10_000 })
  await app.close()

  // A song saved while Encore was closed.
  writeFileSync(join(folder, 'Band - Third.wav'), makeWav(3))
  await open(dataDir)
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 song from your music folders' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('tab', { name: 'Local files' }).click()
  await expect(localFiles()).toHaveCount(3)

  // Removing the folder stops watching it, and its songs stay.
  const again = await openSettings()
  await again.getByRole('button', { name: `Stop watching ${folder}` }).click()
  await expect(again.getByRole('list', { name: 'Music folders' })).toHaveCount(0)
  writeFileSync(join(folder, 'Band - Fourth.wav'), makeWav(3))
  await page.waitForTimeout(3500)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Library' }).click()
  await page.getByRole('tab', { name: 'Local files' }).click()
  await expect(localFiles()).toHaveCount(3)
})

test('a whole album folder moved into a music folder at once is read too', async () => {
  const folder = tempDir('encore-folder-')
  const elsewhere = tempDir('encore-elsewhere-')
  const album = join(elsewhere, 'Album')
  mkdirSync(album)
  writeFileSync(join(album, 'Band - Moved One.wav'), makeWav(3))
  writeFileSync(join(album, 'Band - Moved Two.wav'), makeWav(3))

  await open()
  await pickFolder(folder)
  const settings = await openSettings()
  await settings.getByRole('button', { name: 'Add folder' }).click()
  await expect(settings.getByRole('list', { name: 'Music folders' })).toContainText(folder)

  // Moving the folder reports only the folder itself, the way iTunes or File Explorer moving an album does.
  renameSync(album, join(folder, 'Album'))
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Library' }).click()
  await page.getByRole('tab', { name: 'Local files' }).click()
  await expect(localFiles()).toHaveCount(2, { timeout: 10_000 })
})

test('with Identify new songs automatically on, new songs are looked up without leaving the page', async () => {
  const lookup: LookupServer = await startLookupServer({
    numb: [
      {
        trackId: 2,
        trackName: 'Numb',
        artistName: 'LINKIN PARK',
        collectionName: 'Meteora',
        trackNumber: 13,
        releaseDate: '2003-03-25T08:00:00Z',
        trackTimeMillis: 187_000
      }
    ]
  })
  try {
    await open(undefined, { ENCORE_LOOKUP_URL: lookup.url })
    const settings = await openSettings()
    const toggle = settings.getByRole('switch', { name: 'Identify new songs automatically' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    const music = tempDir('encore-auto-')
    writeFileSync(join(music, 'Linkin Park - Numb.wav'), makeWav(186))
    await dropFiles(page, [join(music, 'Linkin Park - Numb.wav')])

    const library = page.getByRole('region', { name: 'Library' })
    await expect(library.getByRole('region', { name: 'Identify songs' })).toContainText('1 match is ready to review', { timeout: 10_000 })
    await expect(library.getByRole('heading', { name: 'Review matches' })).toHaveCount(0)
  } finally {
    await lookup.close()
  }
})

test('Start with Windows waits for the installed app, and a sign-in start stays in the tray', async () => {
  await open()
  const settings = await openSettings()
  await expect(settings.getByRole('switch', { name: 'Start with Windows' })).toBeDisabled()
  await expect(settings).toContainText('This works once Encore is installed.')
  await app.close()

  await open(undefined, {}, ['--hidden'])
  await page.waitForLoadState('load')
  await page.waitForTimeout(800)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false)
})
