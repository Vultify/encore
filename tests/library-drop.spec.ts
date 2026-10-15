/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'

let app: ElectronApplication
let page: Page
let musicDir: string

// A small fake music folder: supported files at two depths plus files Encore should skip.
test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-drop-'))
  mkdirSync(join(musicDir, 'Album', 'Disc 2'), { recursive: true })
  for (const file of ['Album/01 Intro.mp3', 'Album/02 Song.FLAC', 'Album/Disc 2/03 Live.m4a', 'Loose.wav', 'cover.jpg', 'notes.txt']) {
    writeFileSync(join(musicDir, file), '')
  }
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.beforeEach(async () => {
  app = await electron.launch({ args: ['.'] })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterEach(async () => {
  await app.close()
})

// Picks real files from disk through a hidden input, then fires the drag events a real drop would.
async function dropFiles(paths: string[], events = ['dragenter', 'dragover', 'drop']): Promise<void> {
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.id = 'test-picker'
    input.hidden = true
    document.body.append(input)
  })
  await page.setInputFiles('#test-picker', paths)
  await page.evaluate((types) => {
    const input = document.getElementById('test-picker') as HTMLInputElement
    const data = new DataTransfer()
    for (const file of input.files ?? []) data.items.add(file)
    input.remove()
    for (const type of types) {
      document.body.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }))
    }
  }, events)
}

test('shows the drop overlay while files are dragged over the window', async () => {
  await dropFiles([join(musicDir, 'Loose.wav')], ['dragenter', 'dragover'])
  await expect(page.getByText('Drop to add to your library')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/drop-overlay.png' })

  await page.evaluate(() => {
    document.body.dispatchEvent(new DragEvent('dragleave', { bubbles: true, dataTransfer: new DataTransfer() }))
  })
  await expect(page.getByText('Drop to add to your library')).toBeHidden()
})

test('dropped songs show up in Local files', async () => {
  await dropFiles([join(musicDir, 'Loose.wav'), join(musicDir, 'cover.jpg')])

  await expect(page.getByRole('status').filter({ hasText: 'Added 1 song' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Local files' })).toHaveAttribute('aria-selected', 'true')
  const list = page.getByRole('list', { name: 'Local files' })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('Loose')
  await expect(page.getByText('Drop to add to your library')).toBeHidden()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/local-files.png' })

  await dropFiles([join(musicDir, 'Loose.wav')])
  await expect(page.getByRole('status').filter({ hasText: 'already in your library' })).toBeVisible()
  await expect(list.getByRole('listitem')).toHaveCount(1)
})

test('dropping only non-music files says nothing was found', async () => {
  await dropFiles([join(musicDir, 'notes.txt')])
  await expect(page.getByRole('status').filter({ hasText: 'No MP3, FLAC, WAV, or M4A files' })).toBeVisible()
})

test('scanning a folder finds music in every subfolder', async () => {
  const found = await page.evaluate(
    (dir) => (window as unknown as { encore: EncoreApi }).encore.library.scanPaths([dir, dir]),
    musicDir
  )
  expect(found.map((file) => `${file.name}.${file.format}`).sort()).toEqual([
    '01 Intro.mp3',
    '02 Song.flac',
    '03 Live.m4a',
    'Loose.wav'
  ])
})

test('the window stays on Encore when a drop misses the handler', async () => {
  const url = page.url()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(`location.href = 'file:///C:/'`))
  await page.waitForTimeout(300)
  expect(page.url()).toBe(url)
})
