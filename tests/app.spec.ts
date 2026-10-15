import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchEncore } from './launch'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  const encore = await launchEncore()
  app = encore.app
  page = encore.page
})

test.afterEach(async () => {
  await app.close()
})

const isVisible = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
const isMaximized = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())

test('opens the Stage layout', async () => {
  await expect(page).toHaveTitle('Encore')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Now playing' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Library' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Player' })).toBeVisible()
  await expect(page.getByText('Your library is empty')).toBeVisible()
  await page.screenshot({ path: 'test-results/stage-library.png' })
})

test('switches views from the nav pill', async () => {
  const nav = page.getByRole('navigation', { name: 'Main' })

  await nav.getByRole('button', { name: 'Home' }).click()
  await expect(page.getByRole('region', { name: 'Home' })).toBeVisible()

  await nav.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.screenshot({ path: 'test-results/stage-search.png' })

  await nav.getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('region', { name: 'Library' })).toBeVisible()
})

test('maximize and restore from the title bar', async () => {
  await page.getByRole('button', { name: 'Maximize' }).click()
  await expect.poll(isMaximized).toBe(true)
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()

  await page.getByRole('button', { name: 'Restore' }).click()
  await expect.poll(isMaximized).toBe(false)
})

test('close hides the window to the tray instead of quitting', async () => {
  await expect.poll(isVisible).toBe(true)
  await page.getByRole('button', { name: 'Close to tray' }).click()
  await expect.poll(isVisible).toBe(false)
})
