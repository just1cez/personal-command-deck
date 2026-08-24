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
