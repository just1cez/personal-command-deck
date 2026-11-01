import { formatLocalDate } from '../utils'
import type { DashboardState, FocusRecord } from '../types'

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
    plannedBySession.set(record.sessionId, Math.max(plannedBySession.get(record.sessionId) ?? 0, record.plannedSeconds))
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

/** 收据与 AI 使用同一份当天口径，并保留老归档没有明细的累计基数。 */
export const selectDailyFocus = (dashboard: DashboardState, date: string) => {
  const archived = dashboard.archives.find(archive => archive.date === date)
  const archivedRecords = archived?.focusRecords ?? []
  const records = mergeFocusRecords(archivedRecords, selectFocusRecordsForDate(dashboard.focusRecords, date))
  const archivedStats = computeFocusRecordStats(archivedRecords)
  const stats = computeFocusRecordStats(records)
  const actualSeconds = stats.actualSeconds + Math.max(0, (archived?.actualFocusSeconds ?? 0) - archivedStats.actualSeconds)
  const plannedSeconds = stats.plannedSeconds + Math.max(0, (archived?.plannedFocusMinutes ?? 0) * 60 - archivedStats.plannedSeconds)
  return { records, ...stats, actualSeconds, actualMinutes: Math.floor(actualSeconds / 60), plannedSeconds, plannedMinutes: Math.floor(plannedSeconds / 60) }
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

/** 按本地午夜拆段；累计取整保证分段秒数之和不变。计划只属于首次结算日。 */
export const splitFocusRecordByDate = (record: FocusRecord, previous: FocusRecord[] = []): FocusRecord[] => {
  const start = new Date(record.startedAt).getTime()
  const end = new Date(record.endedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [record]
  const planDate = previous.find(item => item.sessionId === record.sessionId && item.plannedSeconds > 0)?.date
    ?? formatLocalDate(new Date(start))
  const records: FocusRecord[] = []
  let cursor = start
  let allocated = 0
  while (cursor < end) {
    const midnight = new Date(cursor)
    midnight.setHours(24, 0, 0, 0)
    const boundary = Math.min(end, midnight.getTime())
    const cumulative = boundary === end
      ? record.actualSeconds
      : Math.floor(record.actualSeconds * (boundary - start) / (end - start))
    const date = formatLocalDate(new Date(cursor))
    records.push({
      ...record,
      id: records.length ? `${record.id}:${date}` : record.id,
      date,
      startedAt: new Date(cursor).toISOString(),
      endedAt: new Date(boundary).toISOString(),
      actualSeconds: cumulative - allocated,
      plannedSeconds: date === planDate ? record.plannedSeconds : 0,
    })
    allocated = cumulative
    cursor = boundary
  }
  return records
}
