import { afterEach, describe, expect, it, vi } from 'vitest'
import { FOCUS_RECORD_LIMIT } from '../config/constants'
import { defaultState } from './defaults'
import { normalizeDashboardState, normalizeFocusRecords } from './normalize'

const record = (id: string) => ({
  id,
  sessionId: `session-${id}`,
  startedAt: '2026-08-24T10:00:00.000Z',
  endedAt: '2026-08-24T10:01:00.000Z',
  plannedSeconds: 1_500,
  actualSeconds: 60,
  targetLabel: '测试目标',
  projectName: '',
  taskTitle: '',
  endReason: 'paused',
})

afterEach(() => vi.useRealTimers())

describe('normalizeFocusRecords', () => {
  it('drops malformed records, deduplicates ids and derives the local date', () => {
    const records = normalizeFocusRecords([
      record('same'),
      { ...record('same'), actualSeconds: 90 },
      { ...record('bad'), actualSeconds: 0 },
      { ...record('reverse'), endedAt: '2026-08-24T09:00:00.000Z' },
    ])

    expect(records).toHaveLength(1)
    expect(records[0].actualSeconds).toBe(90)
    expect(records[0].date).toMatch(/^2026-08-24$/)
  })

  it('keeps only the newest configured number of records', () => {
    const records = normalizeFocusRecords(
      Array.from({ length: FOCUS_RECORD_LIMIT + 5 }, (_, index) => record(String(index))),
    )
    expect(records).toHaveLength(FOCUS_RECORD_LIMIT)
    expect(records.some((item) => item.id === '0')).toBe(false)
  })
})

describe('offline focus recovery', () => {
  it('records an appClosed segment and restores an unfinished round as paused', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T10:05:00.000Z'))
    const state = structuredClone(defaultState)
    const project = state.projects[0]
    const task = state.tasks[0]
    const normalized = normalizeDashboardState({
      ...state,
      focusRecords: [],
      focus: {
        running: true,
        durationMinutes: 25,
        secondsLeft: 1_500,
        projectId: project.id,
        taskId: task.id,
        taskLabel: task.title,
        sessionId: 'offline-session',
        plannedSeconds: 1_500,
        startedAt: '2026-08-24T10:00:00.000Z',
        endsAt: '2026-08-24T10:25:00.000Z',
      },
    })

    expect(normalized.focus).toMatchObject({
      running: false,
      secondsLeft: 1_200,
      sessionId: 'offline-session',
    })
    expect(normalized.focusRecords[0]).toMatchObject({
      actualSeconds: 300,
      endReason: 'appClosed',
    })
    expect(normalized.projects[0].focusSeconds).toBe(project.focusSeconds + 300)
    expect(normalized.tasks[0].focusSeconds).toBe((task.focusSeconds ?? 0) + 300)
  })

  it('marks an expired offline round completed and clears the session', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T10:30:00.000Z'))
    const state = structuredClone(defaultState)
    const normalized = normalizeDashboardState({
      ...state,
      focusRecords: [],
      focus: {
        running: true,
        durationMinutes: 25,
        secondsLeft: 1_500,
        projectId: state.projects[0].id,
        taskId: '',
        taskLabel: '完整一轮',
        sessionId: 'expired-session',
        plannedSeconds: 1_500,
        startedAt: '2026-08-24T10:00:00.000Z',
        endsAt: '2026-08-24T10:25:00.000Z',
      },
    })

    expect(normalized.focus.running).toBe(false)
    expect(normalized.focus.sessionId).toBeUndefined()
    expect(normalized.focusRecords[0]).toMatchObject({
      actualSeconds: 1_500,
      endReason: 'completed',
    })
  })
})
