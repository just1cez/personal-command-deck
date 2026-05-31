import { readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const releaseDir = resolve(projectRoot, 'release')
const allowedFilePattern = /^Personal Command Deck Setup \d+\.\d+\.\d+\.exe$/
const allowedEntries = new Set(['win-unpacked'])

let entries = []
try {
  entries = await readdir(releaseDir, { withFileTypes: true })
} catch (error) {
  if (error?.code === 'ENOENT') process.exit(0)
  throw error
}

await Promise.all(
  entries.map((entry) => {
    const keep =
      allowedEntries.has(entry.name) ||
      (entry.isFile() && allowedFilePattern.test(entry.name))
    if (keep) return Promise.resolve()
    return rm(resolve(releaseDir, entry.name), { recursive: true, force: true })
  }),
)
