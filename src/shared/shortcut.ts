// Turns key presses into Electron shortcuts like Control+Alt+Space, checks them, and labels them as Ctrl + Alt + Space.

export interface KeyPress {
  // KeyboardEvent.code, which names the physical key, so a shortcut means the same key on any keyboard layout.
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

const MODIFIERS = ['Control', 'Alt', 'Shift', 'Super']

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Delete: 'Delete'
}

const LABELS: Record<string, string> = { Control: 'Ctrl', Super: 'Win', Up: '↑', Down: '↓', Left: '←', Right: '→' }

const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/

function keyFor(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (FUNCTION_KEY.test(code)) return code
  return NAMED_KEYS[code] ?? null
}

const isKey = (key: string): boolean => /^[A-Z0-9]$/.test(key) || FUNCTION_KEY.test(key) || Object.values(NAMED_KEYS).includes(key)

// A shortcut needs Ctrl, Alt, or the Windows key plus one other key, so it never gets in the way of typing.
export function isAllowedShortcut(accelerator: string): boolean {
  const parts = accelerator.split('+')
  const key = parts.pop()
  if (!key || !isKey(key)) return false
  if (new Set(parts).size !== parts.length || !parts.every((part) => MODIFIERS.includes(part))) return false
  return parts.some((part) => part !== 'Shift')
}

// The shortcut a key press makes, or null while only modifiers are held or the combination isn't allowed.
export function shortcutFor(press: KeyPress): string | null {
  const key = keyFor(press.code)
  if (!key) return null
  const modifiers = [press.ctrlKey && 'Control', press.altKey && 'Alt', press.shiftKey && 'Shift', press.metaKey && 'Super']
  const accelerator = [...modifiers.filter(Boolean), key].join('+')
  return isAllowedShortcut(accelerator) ? accelerator : null
}

export const shortcutLabel = (accelerator: string): string =>
  accelerator
    .split('+')
    .map((part) => LABELS[part] ?? part)
    .join(' + ')
