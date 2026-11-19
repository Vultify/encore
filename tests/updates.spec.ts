/// <reference lib="dom" />
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { startUpdateServer, type UpdateServer } from './fixtures/update-server'
import { launchEncore, makeDataDir, TempDirs } from './launch'

let app: ElectronApplication | undefined
let page: Page
let server: UpdateServer | undefined
const temp = new TempDirs()

test.afterEach(async () => {
  await app?.close()
  app = undefined
  await server?.close()
  server = undefined
  temp.removeAll()
})

// Encore checks the stand-in server instead of GitHub, and keeps what it downloads in a folder of the test's own.
async function open(options: Parameters<typeof startUpdateServer>[1] | null, dataDir?: string): Promise<string> {
  const cache = temp.make('encore-cache-')
  const env: Record<string, string> = { LOCALAPPDATA: cache }
  if (options) {
    server = await startUpdateServer(temp.make('encore-feed-'), options)
    env.ENCORE_UPDATE_CONFIG = server.configPath
  }
  ;({ app, page } = await launchEncore(dataDir, env))
  return cache
}

const gear = (): Locator => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' })

async function openSettings(): Promise<Locator> {
  await gear().click()
  const settings = page.getByRole('region', { name: 'Settings' })
  await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible()
  return settings
}

const updateCard = (): Locator => page.getByRole('region', { name: 'Update' })
const updatesRow = (settings: Locator): Locator => settings.getByRole('region', { name: 'About' })

test('while developing, updates are off and Check now waits for the installed app', async () => {
  await open(null)
  const settings = await openSettings()
  await expect(updatesRow(settings).getByText('Updates work once Encore is installed.')).toBeVisible()
  await expect(updatesRow(settings).getByRole('button', { name: 'Check now' })).toBeDisabled()
  await expect(gear()).toHaveAccessibleName('Settings')
  await expect(updateCard()).toHaveCount(0)
})

test('a new version shows a dot on the gear and one notice, then downloads and offers a restart', async () => {
  const dataDir = temp.keep(makeDataDir())
  const cache = await open({ version: '99.0.0' }, dataDir)

  // Encore checks by itself shortly after opening.
  await expect(gear()).toHaveAccessibleName('Settings, update available')
  const notice = page.getByRole('status').filter({ hasText: 'Encore 99.0.0 is out' })
  await expect(notice).toBeVisible()
  await notice.getByRole('button', { name: 'See update' }).click()

  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible()
  await expect(updateCard().getByText('Encore 99.0.0 is available')).toBeVisible()
  await expect(updateCard().getByRole('link', { name: "What's new" })).toHaveAttribute(
    'href',
    'https://github.com/Vultify/encore/releases/tag/v99.0.0'
  )
  await page.screenshot({ path: 'test-results/update-available.png' })

  await updateCard().getByRole('button', { name: 'Download' }).click()
  await expect(updateCard().getByText('Encore 99.0.0 is ready')).toBeVisible()
  await expect(updateCard().getByRole('button', { name: 'Restart to update' })).toBeVisible()
  await page.screenshot({ path: 'test-results/update-ready.png' })

  // Something served by a test feed is never installed, so Restart leaves this Encore running as it is.
  await updateCard().getByRole('button', { name: 'Restart to update' }).click()
  await page.waitForTimeout(1000)
  await expect(updateCard().getByText('Encore 99.0.0 is ready')).toBeVisible()

  // The download landed in the test's own cache folder, never the real Encore's.
  const pending = join(cache, 'encore-updater-test', 'pending')
  expect(existsSync(pending) && readdirSync(pending).some((file) => file.endsWith('.exe'))).toBe(true)
  expect(server?.requests).toContain('/Encore-Setup.exe')

  // Opening Encore again still shows the dot, but the notice for this version has already been seen.
  await app?.close()
  await server?.close()
  server = await startUpdateServer(temp.make('encore-feed-'), { version: '99.0.0' })
  ;({ app, page } = await launchEncore(dataDir, { LOCALAPPDATA: cache, ENCORE_UPDATE_CONFIG: server.configPath }))
  await expect(gear()).toHaveAccessibleName('Settings, update available')
  await page.waitForTimeout(1000)
  await expect(page.getByRole('status').filter({ hasText: 'is out' })).toHaveCount(0)
})

test('Check now says when Encore is already on the newest version', async () => {
  await open({ version: '0.0.1' })
  const settings = await openSettings()
  await updatesRow(settings).getByRole('button', { name: 'Check now' }).click()
  await expect(updatesRow(settings).getByText("You're on the newest version.")).toBeVisible()
  await expect(gear()).toHaveAccessibleName('Settings')
})

test("a check Encore makes by itself fails quietly, and Check now says when GitHub can't be reached", async () => {
  await open({ version: '99.0.0', failWith: 404 })
  const settings = await openSettings()
  await expect.poll(() => server?.requests.length).toBeGreaterThan(0)
  await page.waitForTimeout(500)
  await expect(updatesRow(settings).getByText('Encore checks GitHub for new versions.')).toBeVisible()

  await updatesRow(settings).getByRole('button', { name: 'Check now' }).click()
  await expect(updatesRow(settings).getByText("Couldn't reach GitHub to check. Try again in a bit.")).toBeVisible()
  await expect(updateCard()).toHaveCount(0)
})

test("a download that doesn't match its checksum can be tried again", async () => {
  await open({ version: '99.0.0', corrupt: true })
  await openSettings()
  await updateCard().getByRole('button', { name: 'Download' }).click()
  await expect(updateCard().getByText("The download didn't finish. Check your internet connection and try again.")).toBeVisible()
  await expect(updateCard().getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(updateCard().getByRole('button', { name: 'Restart to update' })).toHaveCount(0)
})

test('with automatic checks off, Encore only checks when asked', async () => {
  const dataDir = temp.keep(makeDataDir())
  await open(null, dataDir)
  const settings = await openSettings()
  const automatic = settings.getByRole('switch', { name: 'Check for updates automatically' })
  await expect(automatic).toBeChecked()
  await automatic.click()
  await expect(automatic).not.toBeChecked()
  await app?.close()

  server = await startUpdateServer(temp.make('encore-feed-'), { version: '99.0.0' })
  ;({ app, page } = await launchEncore(dataDir, { LOCALAPPDATA: temp.make('encore-cache-'), ENCORE_UPDATE_CONFIG: server.configPath }))
  await page.waitForTimeout(2000)
  expect(server.requests).toEqual([])
  await expect(gear()).toHaveAccessibleName('Settings')

  const reopened = await openSettings()
  await expect(updatesRow(reopened).getByText('Encore only checks for new versions when you click Check now.')).toBeVisible()
  await updatesRow(reopened).getByRole('button', { name: 'Check now' }).click()
  await expect(gear()).toHaveAccessibleName('Settings, update available')
  expect(server.requests).toContain('/latest.yml')
})

test('a new version found while Encore is in the tray waits to be announced until the window opens', async () => {
  const cache = temp.make('encore-cache-')
  server = await startUpdateServer(temp.make('encore-feed-'), { version: '99.0.0' })
  ;({ app, page } = await launchEncore(undefined, { LOCALAPPDATA: cache, ENCORE_UPDATE_CONFIG: server.configPath }, ['--hidden']))

  await expect(gear()).toHaveAccessibleName('Settings, update available')
  await page.waitForTimeout(1000)
  const notice = page.getByRole('status').filter({ hasText: 'Encore 99.0.0 is out' })
  await expect(notice).toHaveCount(0)

  await app.evaluate(({ BrowserWindow }) => {
    const [win] = BrowserWindow.getAllWindows()
    win.show()
    win.focus()
  })
  await expect(notice).toBeVisible()
})
