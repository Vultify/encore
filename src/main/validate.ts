// Checks for what the windows send. Anything crossing into the main process is untrusted, so every handler checks
// its input with these, and the limits live in one place so the handlers can't disagree about them.

// The most ids one request can carry.
export const MAX_IDS = 10_000
// The longest name or title accepted.
export const MAX_TEXT = 1000
// The longest key for a list songs play from. An album's key holds its title and its whole folder path, so it gets
// far more room than a name.
export const MAX_KEY = 4000

export const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0

export const isIdList = (value: unknown, max = MAX_IDS): value is number[] => Array.isArray(value) && value.length <= max && value.every(isId)

export const isText = (value: unknown, max = MAX_TEXT): value is string => typeof value === 'string' && value.length <= max

// Whether a value is one of a fixed list of choices, like the repeat modes.
export const isOneOf = <T extends string>(choices: readonly T[], value: unknown): value is T => (choices as readonly unknown[]).includes(value)
