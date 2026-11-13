import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { expect, test } from '@playwright/test'
import { findAudioFiles } from '../src/main/library/scan'

test('songs in nested folders are found, and other files are left out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'encore-scan-'))
  try {
    mkdirSync(join(dir, 'Artist', 'Album'), { recursive: true })
    writeFileSync(join(dir, 'Artist', 'Album', 'one.flac'), '')
    writeFileSync(join(dir, 'Artist', 'Album', 'cover.jpg'), '')
    writeFileSync(join(dir, 'two.MP3'), '')
    expect((await findAudioFiles([dir])).map((file) => [basename(file.path), file.format])).toEqual([
      ['one.flac', 'flac'],
      ['two.MP3', 'mp3']
    ])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a drive's Recycle Bin and system folders are left out, but other folders starting with $ aren't", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'encore-scan-'))
  try {
    for (const [folder, file] of [
      [join('$RECYCLE.BIN', 'S-1-5-21'), '$R1A2B3C.mp3'],
      ['System Volume Information', 'kept.mp3'],
      ['$uicideboy$', 'Paris.mp3']
    ]) {
      mkdirSync(join(dir, folder), { recursive: true })
      writeFileSync(join(dir, folder, file), '')
    }
    expect((await findAudioFiles([dir])).map((file) => basename(file.path))).toEqual(['Paris.mp3'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// Every drive's root has a folder like this (System Volume Information), so adding a whole drive has to work past it.
test("a subfolder that can't be opened is skipped, and the rest of the folder is still found", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'encore-scan-'))
  const locked = join(dir, 'Locked')
  const user = process.env.USERNAME!
  try {
    mkdirSync(join(dir, 'Album'))
    writeFileSync(join(dir, 'Album', 'song.mp3'), '')
    mkdirSync(locked)
    writeFileSync(join(locked, 'hidden.mp3'), '')
    execFileSync('icacls', [locked, '/deny', `${user}:(RX)`], { stdio: 'ignore' })

    expect((await findAudioFiles([dir])).map((file) => basename(file.path))).toEqual(['song.mp3'])
  } finally {
    execFileSync('icacls', [locked, '/remove:d', user], { stdio: 'ignore' })
    rmSync(dir, { recursive: true, force: true })
  }
})
