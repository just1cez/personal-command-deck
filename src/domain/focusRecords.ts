import type { FocusRecord } from '../types'

export type FocusRecordStats = {
  actualSeconds: number
  actualMinutes: number
  plannedSeconds: number
  plannedMinutes: number
  segmentCount: number
}

/** 后出现的同 id 记录覆盖较早快照，供重复归档和今日实时汇总使用。 */
export const mergeFocusRecords = (...groups: FocusRecord[][]): FocusRecord[] => {
  const byId = new Map<string, FocusRecord>()
  groups.flat().forEach((record) => byId.set(record.id, record))
  return [...byId.values()].sort(
    (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
  )
}

export const selectFocusRecordsForDate = (records: FocusRecord[], date: string) =>
  records.filter((record) => record.date === date)

export const computeFocusRecordStats = (records: FocusRecord[]): FocusRecordStats => {
  const actualSeconds = records.reduce((total, record) => total + record.actualSeconds, 0)
  const plannedBySession = new Map<string, number>()
  records.forEach((record) => {
    if (!plannedBySession.has(record.sessionId)) {
      plannedBySession.set(record.sessionId, record.plannedSeconds)
    }
  })
  const plannedSeconds = [...plannedBySession.values()].reduce(
    (total, seconds) => total + seconds,
    0,
  )
  return {
    actualSeconds,
    actualMinutes: Math.floor(actualSeconds / 60),
    plannedSeconds,
    plannedMinutes: Math.floor(plannedSeconds / 60),
    segmentCount: records.length,
  }
}

export const focusEndReasonLabels = {
  paused: '暂停',
  reset: '重置',
  switched: '切换目标',
  completed: '自然完成',
  appClosed: '应用关闭',
  archived: '归档切段',
} as const

export const formatFocusActualMinutes = (seconds: number) =>
  seconds > 0 && seconds < 60 ? '<1' : String(Math.floor(seconds / 60))
