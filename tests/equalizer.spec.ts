/// <reference lib="dom" />
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeTune, makeWav } from './fixtures/audio'
import { launchEncore, makeDataDir } from './launch'

let app: ElectronApplication | undefined
let page: Page
let dirs: string[] = []

test.afterEach(async () => {
  await app?.close()
  app = undefined
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

async function open(dataDir?: string): Promise<void> {
  ;({ app, page } = await launchEncore(dataDir))
}

function keptDataDir(): string {
  const dir = makeDataDir()
  dirs.push(dir)
  return dir
}

const dock = (): Locator => page.getByRole('region', { name: 'Player' })
const eqButton = (): Locator => dock().getByRole('button', { name: 'Equalizer' })
const panel = (): Locator => page.getByRole('dialog', { name: 'Equalizer' })
const power = (): Locator => panel().getByRole('switch', { name: 'Equalizer' })
const preset = (name: string): Locator => panel().getByRole('radio', { name, exact: true })
const band = (name: string): Locator => panel().getByRole('slider', { name, exact: true })

test('the equalizer opens from the dock, presets set the sliders, and moving one makes it Custom', async () => {
  await open()
  await eqButton().click()
  await expect(panel()).toBeVisible()
  await expect(power()).toHaveAttribute('aria-checked', 'false')
  await expect(preset('Flat')).toHaveAttribute('aria-checked', 'true')

  // Picking a preset turns the equalizer on.
  await preset('Bass boost').click()
  await expect(power()).toHaveAttribute('aria-checked', 'true')
  await expect(band('32 Hz')).toHaveValue('6')
  await expect(band('16 kHz')).toHaveValue('0')
  await expect(eqButton()).toHaveAttribute('title', 'Equalizer (on)')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/equalizer.png' })

  // Moving a band starts Custom from where Bass boost had everything.
  await band('1 kHz').focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(band('1 kHz')).toHaveValue('2')
  await expect(band('1 kHz')).toHaveAttribute('aria-valuetext', '+2 dB')
  await expect(preset('Custom')).toHaveAttribute('aria-checked', 'true')
  await expect(band('32 Hz')).toHaveValue('6')

  // Custom keeps its levels while another preset is picked.
  await preset('Rock').click()
  await expect(band('1 kHz')).toHaveValue('-1')
  await preset('Custom').click()
  await expect(band('1 kHz')).toHaveValue('2')

  // Off keeps the preset and levels for later.
  await power().click()
  await expect(power()).toHaveAttribute('aria-checked', 'false')
  await expect(preset('Custom')).toHaveAttribute('aria-checked', 'true')
  await expect(eqButton()).toHaveAttribute('title', 'Equalizer')

  // Escape closes it and goes back to the button. So does clicking anywhere else.
  await page.keyboard.press('Escape')
  await expect(panel()).toHaveCount(0)
  await expect(eqButton()).toBeFocused()
  await eqButton().click()
  await expect(panel()).toBeVisible()
  await eqButton().click()
  await expect(panel()).toHaveCount(0)
  await eqButton().click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Library' }).click()
  await expect(panel()).toHaveCount(0)
})

test('Escape in the Now Playing view closes only the equalizer', async () => {
  const music = mkdtempSync(join(tmpdir(), 'encore-eq-'))
  dirs.push(music)
  writeFileSync(join(music, 'Band - Tone.wav'), makeWav(4))
  await open()
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), music)
  await page.reload()
  await page.getByRole('tab', { name: 'Local files' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Tone' }).dblclick()
  await dock().getByRole('button', { name: 'Pause' }).click()
  await dock().getByRole('button', { name: 'Open Now Playing' }).click()
  await expect(page.getByRole('button', { name: 'Close Now Playing' })).toBeVisible()

  await eqButton().click()
  await preset('Vocal').click()
  await page.keyboard.press('Escape')
  await expect(panel()).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Close Now Playing' })).toBeVisible()
})

test('the equalizer is the same after a restart, and an older settings file starts it off and flat', async () => {
  const dataDir = keptDataDir()
  writeFileSync(join(dataDir, 'settings.json'), JSON.stringify({ player: { volume: 0.5, muted: false, session: null } }))
  await open(dataDir)
  await eqButton().click()
  await expect(power()).toHaveAttribute('aria-checked', 'false')
  await expect(preset('Flat')).toHaveAttribute('aria-checked', 'true')

  await preset('Vocal').click()
  await band('64 Hz').fill('-5')
  await expect(preset('Custom')).toHaveAttribute('aria-checked', 'true')
  await app!.close()
  app = undefined
  const saved = JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'))
  expect(saved.player.equalizer).toEqual({ enabled: true, preset: 'custom', custom: [-2, -5, -1, 1, 3, 4, 4, 3, 1, 0] })

  await open(dataDir)
  await eqButton().click()
  await expect(power()).toHaveAttribute('aria-checked', 'true')
  await expect(preset('Custom')).toHaveAttribute('aria-checked', 'true')
  await expect(band('64 Hz')).toHaveValue('-5')
  await expect(band('250 Hz')).toHaveValue('1')
  await expect(eqButton()).toHaveAttribute('title', 'Equalizer (on)')
})

// Web Audio only hears songs the page is allowed to read. Without that, a song would play through the equalizer
// as silence while its time still ticks along.
test('songs reach the equalizer as real sound, not silence', async () => {
  const music = mkdtempSync(join(tmpdir(), 'encore-eq-'))
  dirs.push(music)
  writeFileSync(join(music, 'Tone.wav'), makeTune(3))
  await open()
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), music)

  const loudest = await page.evaluate(async () => {
    const [track] = await (window as unknown as { encore: EncoreApi }).encore.library.getTracks()
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.src = `encore-media://track/${track.id}`
    const context = new AudioContext()
    const analyser = new AnalyserNode(context, { fftSize: 2048 })
    // The analyser is wired to a silent output, so the test makes no noise.
    context.createMediaElementSource(audio).connect(analyser).connect(new GainNode(context, { gain: 0 })).connect(context.destination)
    await audio.play()
    await new Promise((resolve) => setTimeout(resolve, 700))
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    audio.pause()
    await context.close()
    return samples.reduce((most, sample) => Math.max(most, Math.abs(sample)), 0)
  })
  expect(loudest).toBeGreaterThan(0.05)
})
