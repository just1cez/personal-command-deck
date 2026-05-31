import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const releaseDir = resolve(projectRoot, 'release')

await rm(releaseDir, { recursive: true, force: true })
