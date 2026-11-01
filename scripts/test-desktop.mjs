import { spawn } from 'node:child_process'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const electron = require('electron')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = await mkdtemp(join(tmpdir(), 'command-deck-test-'))
async function run(stage) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.VITE_DEV_SERVER_URL
  await new Promise((resolveRun, reject) => {
    const child = spawn(electron, [join(root, 'scripts', 'desktop-integration.cjs'), profile, stage], {
      env, cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let error = ''
    child.stdout.on('data', data => process.stdout.write(data))
    child.stderr.on('data', data => { error += data.toString() })
    child.on('error', reject)
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Desktop test ${stage} timed out: ${error}`)) }, 60000)
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolveRun() : reject(new Error(`Desktop test ${stage} failed (${code}): ${error}`)) })
  })
  await access(join(profile, `${stage}.passed`))
}
try {
  await run('exercise')
  await run('reopen')
  await run('final')
  await run('crash')
  console.log('PASS: Electron save, close, failure recovery, quit and reopen')
} finally {
  const target = resolve(profile)
  const base = resolve(tmpdir()) + sep
  if (!target.startsWith(base) || !target.slice(base.length).startsWith('command-deck-test-')) throw new Error('Unsafe test cleanup path')
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
