import { describe, expect, it } from 'vitest'
import { defaultState } from '../state/defaults'
import type { DashboardState } from '../types'
import { archiveDashboardToday } from './archive'

const runningState = (): DashboardState => {
  const state = structuredClone(defaultState)
  return {
    ...state,
    focusRecords: [],
    focus: {
      running: true,
      durationMinutes: 25,
      secondsLeft: 1_500,
      projectId: state.projects[0].id,
      taskId: state.tasks[0].id,
      taskLabel: state.tasks[0].title,
      sessionId: 'archive-session',
      plannedSeconds: 1_500,
      startedAt: '2026-08-24T10:00:00.000Z',
      endsAt: '2026-08-24T10:25:00.000Z',
    },
  }
}

describe('archiveDashboardToday', () => {
  it('checkpoints a running focus without stopping its countdown', () => {
    const archived = archiveDashboardToday(
      runningState(),
      new Date('2026-08-24T10:05:00.000Z'),
    )
    const today = archived.archives[0]

    expect(today.focusRecords).toHaveLength(1)
    expect(today.focusRecords[0]).toMatchObject({
      actualSeconds: 300,
      endReason: 'archived',
      sessionId: 'archive-session',
    })
    expect(today.actualFocusSeconds).toBe(300)
    expect(today.plannedFocusMinutes).toBe(25)
    expect(archived.focusRecords).toHaveLength(0)
    expect(archived.focus).toMatchObject({
      running: true,
      startedAt: '2026-08-24T10:05:00.000Z',
      endsAt: '2026-08-24T10:25:00.000Z',
    })
  })

  it('merges a repeated archive without duplicating plans or prior segments', () => {
    const first = archiveDashboardToday(
      runningState(),
      new Date('2026-08-24T10:05:00.000Z'),
    )
    const second = archiveDashboardToday(
      first,
      new Date('2026-08-24T10:10:00.000Z'),
    )
    const today = second.archives[0]

    expect(second.archives).toHaveLength(1)
    expect(today.focusRecords).toHaveLength(2)
    expect(today.actualFocusSeconds).toBe(600)
    expect(today.plannedFocusMinutes).toBe(25)
    expect(today.id).toBe(first.archives[0].id)
  })
})
