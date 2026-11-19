// Stops an installer build if any value from .env made it into the built app, where anyone could pull it out.
// It names the setting that leaked, never its value.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'out'

const secrets = existsSync('.env')
  ? readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter((match) => match && match[2].length >= 6)
      .map(([, name, value]) => ({ name, value }))
  : []

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else yield path
  }
}

const leaks = []
for (const path of files(OUT)) {
  const text = readFileSync(path, 'latin1')
  for (const { name, value } of secrets) if (text.includes(value)) leaks.push(`${name} in ${path}`)
}

if (leaks.length > 0) {
  console.error(`Stopped: values from .env are inside the built app:\n  ${leaks.join('\n  ')}`)
  process.exit(1)
}
console.log(`Checked ${OUT}/ for ${secrets.length} .env value(s): none found.`)
