import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultState } from '../state/defaults'
import { normalizeDashboardState } from '../state/normalize'
import { buildBackupFile, extractBackupState } from '../state/backup'
import { isLocalDateString } from '../state/parsers'
import { carryTomorrowTasksIntoToday } from './tasks'
import { applyRetentionPolicy, isWithinRetentionWindow } from './retention'
import { moveItemById, moveTaskWithinKind, moveProjectWithinActive } from './ordering'
import { getFocusSegmentSeconds, recoverOfflineFocus, settleFocusSegment } from './focus'
import { computeFocusRecordStats } from './focusRecords'
import { archiveDashboardToday } from './archive'
import { createDesktopNote, desktopNoteTaskTitle, patchDesktopNote } from './desktopNotes'
import { normalizeHttpUrl } from '../utils'

afterEach(() => vi.useRealTimers())

const runningState = () => {
  const state = structuredClone(defaultState)
  state.focusRecords = []
  state.archives = []
  state.focus = {
    ...state.focus, running: true, durationMinutes: 25, secondsLeft: 1500,
    projectId: state.projects[0].id, taskId: state.tasks[0].id,
    taskLabel: 'verification', sessionId: 'verification-session', plannedSeconds: 1500,
    startedAt: '2026-09-05T10:00:00Z', endsAt: '2026-09-05T10:25:00Z',
  }
  return state
}

describe('verification: time and archival boundaries', () => {
  it('caps delayed timer settlement at the scheduled end', () => {
    expect(getFocusSegmentSeconds('2026-09-05T10:00:00Z', '2026-09-05T10:25:00Z', Date.parse('2026-09-08T10:00:00Z'))).toBe(1500)
  })
  it('never generates negative elapsed time when the clock moves backwards', () => {
    expect(getFocusSegmentSeconds('2026-09-05T10:00:00Z', '2026-09-05T10:25:00Z', Date.parse('2026-09-05T09:00:00Z'))).toBe(0)
  })
  it('rejects reversed offline intervals', () => {
    expect(recoverOfflineFocus({ running: true, startedAt: '2026-09-05T10:25:00Z', endsAt: '2026-09-05T10:00:00Z' }, 25, Date.now()).wasRunning).toBe(false)
  })
  it('does not duplicate recovered time on a second normalization', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T10:05:00Z'))
    const once = normalizeDashboardState(runningState())
    const twice = normalizeDashboardState(once)
    expect(twice.focusRecords).toEqual(once.focusRecords)
    expect(twice.projects).toEqual(once.projects)
    expect(twice.tasks).toEqual(once.tasks)
  })
  it('conserves elapsed time across repeated archive checkpoints and completion', () => {
    const initial = runningState()
    const first = archiveDashboardToday(initial, new Date('2026-09-05T10:05:00Z'))
    const second = archiveDashboardToday(first, new Date('2026-09-05T10:10:00Z'))
    const settled = settleFocusSegment(second, 900, 'completed', '2026-09-05T10:25:00Z')
    const final = archiveDashboardToday({ ...second, ...settled, focus: { ...second.focus, running: false } }, new Date('2026-09-05T10:25:00Z'))
    expect(final.archives).toHaveLength(1)
    expect(final.archives[0].actualFocusSeconds).toBe(1500)
    expect(final.archives[0].plannedFocusMinutes).toBe(25)
    expect(final.projects[0].focusSeconds - initial.projects[0].focusSeconds).toBe(1500)
    expect(computeFocusRecordStats(final.archives[0].focusRecords).segmentCount).toBe(3)
    expect(initial.focusRecords).toEqual([])
  })
})

describe('verification: carryover, retention, ordering', () => {
  it('fills only available Top 3 slots and carries each task once', () => {
    const state = structuredClone(defaultState)
    state.tasks = [{ id: 'existing', title: 'existing', kind: 'top', done: false }]
    state.tomorrowTasks = Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: ` task ${i} `, kind: 'todo', done: false }))
    const carried = carryTomorrowTasksIntoToday(state, '2026-09-06')
    expect(carried.tasks.filter(task => task.kind === 'top')).toHaveLength(3)
    expect(carried.tasks).toHaveLength(5)
    expect(carried.tomorrowTasks).toEqual([])
    expect(carryTomorrowTasksIntoToday(carried, '2026-09-06')).toBe(carried)
    expect(state.tomorrowTasks).toHaveLength(4)
  })
  it('preserves records with missing dates and the exact retention boundary', () => {
    const now = Date.parse('2026-09-05T10:00:00Z')
    expect(isWithinRetentionWindow(undefined, 1, now)).toBe(true)
    expect(isWithinRetentionWindow('invalid', 1, now)).toBe(true)
    expect(isWithinRetentionWindow('2026-09-04T10:00:00Z', 1, now)).toBe(true)
    expect(isWithinRetentionWindow('2026-09-04T09:59:59Z', 1, now)).toBe(false)
    expect(isWithinRetentionWindow('2000-01-01', 0, now)).toBe(true)
  })
  it('retains active projects while removing expired completed projects', () => {
    const p = defaultState.projects[0]
    const result = applyRetentionPolicy([], [{ ...p, id: 'active' }, { ...p, id: 'old', active: false, completedAt: '2000-01-01' }], { reviewArchiveDays: 1, completedProjectDays: 1 })
    expect(result.projects.map(item => item.id)).toEqual(['active'])
  })
  it('keeps other task categories in place when reordering', () => {
    const tasks = [
      { id: 'a', title: 'a', kind: 'top' as const, done: false },
      { id: 'b', title: 'b', kind: 'todo' as const, done: false },
      { id: 'c', title: 'c', kind: 'top' as const, done: false },
    ]
    expect(moveTaskWithinKind(tasks, 'a', 'down')?.map(item => item.id)).toEqual(['c', 'b', 'a'])
    expect(moveTaskWithinKind(tasks, 'a', 'up')).toBeNull()
    expect(moveItemById(tasks, 'missing', 'down')).toBeNull()
    expect(tasks.map(item => item.id)).toEqual(['a', 'b', 'c'])
  })
  it('does not move completed projects', () => {
    const p = defaultState.projects[0]
    const projects = [{ ...p, id: 'a' }, { ...p, id: 'b', active: false }, { ...p, id: 'c' }]
    expect(moveProjectWithinActive(projects, 'a', 'down')?.map(item => item.id)).toEqual(['c', 'b', 'a'])
    expect(moveProjectWithinActive(projects, 'b', 'up')).toBeNull()
  })
})

describe('verification: backup and untrusted input', () => {
  it.each([null, [], {}, { app: 'another-app', state: {} }])('rejects unrelated backup input: %j', input => {
    expect(() => extractBackupState(input)).toThrow()
  })
  it('preserves empty lists and the current local credential when importing', () => {
    const state = structuredClone(defaultState)
    state.ai.apiKey = 'synthetic-verification-secret'
    state.tasks = []; state.projects = []; state.inbox = []
    const backup = buildBackupFile(state)
    expect(JSON.stringify(backup)).not.toContain('synthetic-verification-secret')
    const imported = normalizeDashboardState(extractBackupState(backup), { currentState: state, preserveAiKey: true })
    expect(imported.ai.apiKey).toBe(state.ai.apiKey)
    expect(imported.tasks).toEqual([])
    expect(imported.projects).toEqual([])
    expect(imported.inbox).toEqual([])
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///C:/test', 'vbscript:msgbox(1)'])('rejects unsafe external URL %s', url => {
    expect(normalizeHttpUrl(url)).toBe('')
  })
  it('validates leap days and rejects impossible calendar dates', () => {
    expect(isLocalDateString('2024-02-29')).toBe(true)
    expect(isLocalDateString('2026-02-29')).toBe(false)
    expect(isLocalDateString('2026-02-31')).toBe(false)
  })
  it('normalizes malformed nested JSON without throwing', () => {
    for (const value of [null, false, 42, '', [], {}, { nested: [] }]) {
      const input = Object.fromEntries(Object.keys(defaultState).map(key => [key, value]))
      expect(() => normalizeDashboardState(input)).not.toThrow()
    }
  })
  it('deduplicates note ids and restricts open notes and content length', () => {
    const notes = Array.from({ length: 10 }, () => ({ ...createDesktopNote('x'.repeat(9000)), id: 'duplicate' }))
    const normalized = normalizeDashboardState({ ...defaultState, desktopNotes: notes })
    expect(new Set(normalized.desktopNotes.map(note => note.id)).size).toBe(10)
    expect(normalized.desktopNotes.filter(note => note.isOpen)).toHaveLength(6)
    expect(normalized.desktopNotes.every(note => note.content.length === 8000)).toBe(true)
  })
  it('keeps note patches immutable and extracts the first nonempty line for tasks', () => {
    const note = createDesktopNote('\n  first line\nsecond line')
    expect(desktopNoteTaskTitle(note)).toBe('first line')
    expect(patchDesktopNote(note, {})).toBe(note)
    expect(patchDesktopNote(note, { content: 'changed' }).content).toBe('changed')
    expect(note.content).toContain('first line')
  })
})
