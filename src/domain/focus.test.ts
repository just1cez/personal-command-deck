import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultState } from '../state/defaults'
import type { DashboardState } from '../types'
import {
  pauseFocusSession,
  settleFocusSegment,
} from './focus'
import { computeFocusRecordStats } from './focusRecords'

const focusedState = (): DashboardState => {
  const state = structuredClone(defaultState)
  const project = state.projects[0]
  const task = state.tasks[0]
  return {
    ...state,
    focusRecords: [],
    focus: {
      running: true,
      durationMinutes: 25,
      secondsLeft: 1_500,
      projectId: project.id,
      taskId: task.id,
      taskLabel: task.title,
      sessionId: 'session-1',
      plannedSeconds: 1_500,
      startedAt: '2026-08-24T10:00:00.000Z',
      endsAt: '2026-08-24T10:25:00.000Z',
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('settleFocusSegment', () => {
  it('records a segment and updates linked project and task totals', () => {
    const state = focusedState()
    const project = state.projects[0]
    const task = state.tasks[0]
    const result = settleFocusSegment(
      state,
      125,
      'paused',
      '2026-08-24T10:02:05.000Z',
    )

    expect(result.projects[0].focusSeconds).toBe(project.focusSeconds + 125)
    expect(result.tasks[0].focusSeconds).toBe((task.focusSeconds ?? 0) + 125)
    expect(result.focusRecords).toHaveLength(1)
    expect(result.focusRecords[0]).toMatchObject({
      sessionId: 'session-1',
      actualSeconds: 125,
      plannedSeconds: 1_500,
      projectName: project.name,
      taskTitle: task.title,
      endReason: 'paused',
    })
  })

  it('keeps one session across paused segments and counts its plan once', () => {
    const firstState = focusedState()
    const first = settleFocusSegment(
      firstState,
      60,
      'paused',
      '2026-08-24T10:01:00.000Z',
    )
    const resumed: DashboardState = {
      ...firstState,
      projects: first.projects,
      tasks: first.tasks,
      focusRecords: first.focusRecords,
      focus: {
        ...pauseFocusSession(firstState.focus, 1_440),
        running: true,
        startedAt: '2026-08-24T10:05:00.000Z',
        endsAt: '2026-08-24T10:29:00.000Z',
      },
    }
    const second = settleFocusSegment(
      resumed,
      120,
      'reset',
      '2026-08-24T10:07:00.000Z',
    )
    const stats = computeFocusRecordStats(second.focusRecords)

    expect(second.focusRecords).toHaveLength(2)
    expect(new Set(second.focusRecords.map((record) => record.sessionId)).size).toBe(1)
    expect(stats.actualSeconds).toBe(180)
    expect(stats.plannedSeconds).toBe(1_500)
  })

  it('records free focus without mutating missing entities', () => {
    const state = focusedState()
    state.focus.projectId = 'deleted-project'
    state.focus.taskId = 'deleted-task'
    state.focus.taskLabel = '自由写作'
    const result = settleFocusSegment(
      state,
      30,
      'switched',
      '2026-08-24T10:00:30.000Z',
    )

    expect(result.projects).toEqual(state.projects)
    expect(result.tasks).toEqual(state.tasks)
    expect(result.focusRecords[0]).toMatchObject({
      targetLabel: '自由写作',
      projectName: '',
      taskTitle: '',
      actualSeconds: 30,
    })
  })

  it('does not create a record for zero seconds', () => {
    const state = focusedState()
    const result = settleFocusSegment(state, 0, 'paused')
    expect(result.focusRecords).toBe(state.focusRecords)
    expect(result.projects).toBe(state.projects)
    expect(result.tasks).toBe(state.tasks)
  })

  it('rejects an invalid end time without changing aggregates', () => {
    const state = focusedState()
    const result = settleFocusSegment(
      state,
      60,
      'paused',
      '2026-08-24T09:59:00.000Z',
    )
    expect(result.focusRecords).toBe(state.focusRecords)
    expect(result.projects).toBe(state.projects)
    expect(result.tasks).toBe(state.tasks)
  })
})

it('splits midnight focus, counts the plan once, and preserves entity totals', async () => {
  const { normalizeDashboardState } = await import('../state/normalize')
  const { selectDailyFocus } = await import('./focusRecords')
  const { formatLocalDate } = await import('../utils')
  const start = new Date(2026, 8, 22, 23, 50)
  const end = new Date(2026, 8, 23, 0, 15)
  const state = focusedState()
  state.archives = []
  state.focus.startedAt = start.toISOString()
  state.focus.endsAt = end.toISOString()
  const result = settleFocusSegment(state, 1500, 'completed', end.toISOString())
  expect(result.focusRecords.map(record => record.actualSeconds)).toEqual([600, 900])
  expect(result.focusRecords.map(record => record.plannedSeconds)).toEqual([1500, 0])
  expect(result.projects[0].focusSeconds).toBe(state.projects[0].focusSeconds + 1500)
  expect(result.tasks[0].focusSeconds).toBe((state.tasks[0].focusSeconds ?? 0) + 1500)
  expect(computeFocusRecordStats(result.focusRecords).plannedSeconds).toBe(1500)
  expect(selectDailyFocus({ ...state, ...result }, formatLocalDate(end)).actualSeconds).toBe(900)
  vi.useFakeTimers()
  vi.setSystemTime(end)
  const recovered = normalizeDashboardState(state)
  expect(recovered.focusRecords.map(record => record.actualSeconds)).toEqual([600, 900])
  const reloaded = normalizeDashboardState(recovered)
  expect(reloaded.focusRecords.map(record => record.plannedSeconds)).toEqual([1500, 0])
})

it('does not count a new plan when resuming on the following day', () => {
  const state = focusedState()
  state.archives = []
  state.focus.startedAt = new Date(2026, 8, 22, 23, 50).toISOString()
  state.focus.endsAt = new Date(2026, 8, 23, 0, 15).toISOString()
  const first = settleFocusSegment(state, 300, 'paused', new Date(2026, 8, 22, 23, 55).toISOString())
  const resumed = { ...state, ...first, focus: { ...state.focus,
    startedAt: new Date(2026, 8, 23, 0, 10).toISOString(),
    endsAt: new Date(2026, 8, 23, 0, 30).toISOString(),
  } }
  const second = settleFocusSegment(resumed, 1200, 'completed', resumed.focus.endsAt)
  expect(second.focusRecords.map(record => record.plannedSeconds)).toEqual([1500, 0])
})
