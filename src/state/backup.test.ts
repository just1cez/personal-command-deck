import { describe, expect, it } from 'vitest'
import { defaultState } from './defaults'
import { buildBackupFile, extractBackupState } from './backup'

describe('focus-record backup compatibility', () => {
  it('exports backup v2 while stopping the timer and redacting the API key', () => {
    const state = structuredClone(defaultState)
    state.ai.apiKey = 'secret'
    state.focus.running = true
    state.focus.startedAt = '2026-08-24T10:00:00.000Z'
    state.focus.endsAt = '2026-08-24T10:25:00.000Z'

    const backup = buildBackupFile(state)

    expect(backup.version).toBe(2)
    expect(backup.state.ai.apiKey).toBe('')
    expect(backup.state.focus.running).toBe(false)
    expect(backup.state.focus.startedAt).toBeUndefined()
    expect(backup.state.focusRecords).toEqual([])
  })

  it('continues accepting a v1 backup envelope', () => {
    const legacy = {
      app: 'Personal Command Deck',
      version: 1,
      state: { theme: 'dark', focus: { running: false } },
    }

    expect(extractBackupState(legacy)).toEqual(legacy.state)
  })
})
