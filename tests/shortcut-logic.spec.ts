import { expect, test } from '@playwright/test'
import { isAllowedShortcut, shortcutFor, shortcutLabel, type KeyPress } from '../src/shared/shortcut'

const press = (code: string, held: Partial<Omit<KeyPress, 'code'>> = {}): KeyPress => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...held
})

test('a key with Ctrl, Alt, or Windows held makes a shortcut', () => {
  expect(shortcutFor(press('Space', { ctrlKey: true, altKey: true }))).toBe('Control+Alt+Space')
  expect(shortcutFor(press('KeyM', { ctrlKey: true, shiftKey: true }))).toBe('Control+Shift+M')
  expect(shortcutFor(press('Digit5', { altKey: true }))).toBe('Alt+5')
  expect(shortcutFor(press('F9', { metaKey: true }))).toBe('Super+F9')
  expect(shortcutFor(press('ArrowUp', { ctrlKey: true, altKey: true }))).toBe('Control+Alt+Up')
})

test('keys that would get in the way of typing are refused', () => {
  expect(shortcutFor(press('KeyM'))).toBeNull()
  expect(shortcutFor(press('KeyM', { shiftKey: true }))).toBeNull()
  expect(shortcutFor(press('F9'))).toBeNull()
  // Keys outside the supported set, like punctuation, aren't offered.
  expect(shortcutFor(press('Semicolon', { ctrlKey: true }))).toBeNull()
})

test('only well-formed shortcuts pass the check the settings file and main process use', () => {
  expect(isAllowedShortcut('Control+Alt+Space')).toBe(true)
  expect(isAllowedShortcut('Alt+F4')).toBe(true)
  expect(isAllowedShortcut('Space')).toBe(false)
  expect(isAllowedShortcut('Shift+A')).toBe(false)
  expect(isAllowedShortcut('Control+Control+A')).toBe(false)
  expect(isAllowedShortcut('Control+Banana')).toBe(false)
  expect(isAllowedShortcut('Hyper+A')).toBe(false)
  expect(isAllowedShortcut('')).toBe(false)
})

test('shortcuts read the way they are written on the keys', () => {
  expect(shortcutLabel('Control+Alt+Space')).toBe('Ctrl + Alt + Space')
  expect(shortcutLabel('Super+Shift+Left')).toBe('Win + Shift + ←')
})
