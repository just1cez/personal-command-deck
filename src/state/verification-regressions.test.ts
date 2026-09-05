/** Regression tests for defects found and fixed on 2026-09-05. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, STORAGE_CORRUPT_KEY, STORAGE_RECOVERY_KEY } from '../config/constants'
import { defaultState } from './defaults'
import { normalizeDashboardState } from './normalize'
import { buildBackupFile, extractBackupState } from './backup'
import { loadDashboardState, saveDashboardState } from './storage'
import { buildReviewPrompt } from '../services/aiSummary'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('regressions found during thorough verification', () => {
  it('K1: preserves corrupt persisted data before saving fallback defaults', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const disk = new Map([[STORAGE_KEY, '{broken-original-data']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => { disk.set(key, value) },
    })
    const loaded = loadDashboardState()
    saveDashboardState(loaded) // same load -> persistence sequence as the provider
    expect([...disk.values()]).toContain('{broken-original-data')
  })
  it('K2: preserves elapsed, uncheckpointed focus when exporting a running session', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T10:05:00Z'))
    const state = structuredClone(defaultState)
    state.focusRecords = []
    state.focus = {
      ...state.focus, running: true, projectId: state.projects[0].id,
      startedAt: '2026-09-05T10:00:00Z', endsAt: '2026-09-05T10:25:00Z',
      sessionId: 'running-export', plannedSeconds: 1500, secondsLeft: 1200,
    }
    const restored = normalizeDashboardState(extractBackupState(buildBackupFile(state)))
    expect(restored.focusRecords.reduce((sum, record) => sum + record.actualSeconds, 0)).toBe(300)
  })
  it('K3: preserves the session id of paused focus without a project across reload', () => {
    const state = structuredClone(defaultState)
    state.projects = []
    state.focus = { ...state.focus, running: false, projectId: '', taskLabel: 'free focus', secondsLeft: 1200, durationMinutes: 25, sessionId: 'original-session', plannedSeconds: 1500 }
    expect(normalizeDashboardState(state).focus.sessionId).toBe('original-session')
  })
  it('K4: rejects unsupported future backup versions before destructive import', () => {
    const backup = { ...buildBackupFile(defaultState), version: 999 }
    expect(() => extractBackupState(backup)).toThrow()
  })
  it('K5: removes duplicate task ids so actions target exactly one task', () => {
    const state = normalizeDashboardState({ ...defaultState, tasks: [
      { id: 'same', title: 'first', kind: 'todo', done: false },
      { id: 'same', title: 'second', kind: 'todo', done: false },
    ] })
    expect(new Set(state.tasks.map(task => task.id)).size).toBe(state.tasks.length)
  })
  it('K6: daily review prompt includes today free-focus time', () => {
    const state = structuredClone(defaultState)
    state.projects = []
    state.focusRecords = [{ id: 'free', sessionId: 'free-session', date: '2026-09-05', startedAt: '2026-09-05T10:00:00Z', endedAt: '2026-09-05T10:05:00Z', actualSeconds: 300, plannedSeconds: 1500, endReason: 'paused', targetLabel: 'free', projectName: '', taskTitle: '' }]
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T10:05:00Z'))
    expect(buildReviewPrompt(state)).toContain('5 分钟')
  })
  it('refuses to overwrite corrupt data if the protective copy cannot be saved', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const disk = new Map([[STORAGE_KEY, '{original']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === STORAGE_CORRUPT_KEY) throw new Error('QuotaExceededError')
        disk.set(key, value)
      },
    })
    expect(saveDashboardState(defaultState)).toBe(false)
    expect(disk.get(STORAGE_KEY)).toBe('{original')
  })
  it('restores the latest valid snapshot and excludes keys from recovery copies', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const previous = structuredClone(defaultState)
    previous.ai.apiKey = 'synthetic-recovery-secret'
    const current = structuredClone(defaultState)
    current.tasks = [{ id: 'recovery', title: 'recover this task', done: false, kind: 'todo' }]
    const disk = new Map([[STORAGE_KEY, JSON.stringify(previous)]])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => { disk.set(key, value) },
    })
    expect(saveDashboardState(current)).toBe(true)
    expect(disk.get(STORAGE_RECOVERY_KEY)).not.toContain('synthetic-recovery-secret')
    disk.set(STORAGE_KEY, '{broken')
    expect(loadDashboardState().tasks[0].title).toBe('recover this task')
  })
  it('deduplicates all action-addressable entity ids from imported data', () => {
    const state = normalizeDashboardState({
      ...defaultState,
      projects: [defaultState.projects[0], { ...defaultState.projects[0], name: 'duplicate project' }],
      quickLinks: [defaultState.quickLinks[0], { ...defaultState.quickLinks[0], label: 'duplicate link' }],
      inbox: [defaultState.inbox[0], { ...defaultState.inbox[0], text: 'duplicate inbox item' }],
      reminders: [defaultState.reminders[0], { ...defaultState.reminders[0], title: 'duplicate reminder' }],
    })
    for (const collection of [state.projects, state.quickLinks, state.inbox, state.reminders]) {
      expect(new Set(collection.map(item => item.id)).size).toBe(collection.length)
    }
  })
})
