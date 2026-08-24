/**
 * 每日归档：把"今天"定格成一条只读记录。
 */
import { ARCHIVE_HISTORY_LIMIT } from '../config/constants'
import type { DailyArchive, DashboardState } from '../types'
import { formatLocalDate, todayIso, uid } from '../utils'
import { getElapsedFocusSeconds, settleFocusSegment } from './focus'
import {
  computeFocusRecordStats,
  mergeFocusRecords,
  selectFocusRecordsForDate,
} from './focusRecords'
import { buildLocalSummary } from './summary'

/**
 * 用当前状态生成一条归档。
 * 总结优先用已经生成好的（可能是 AI 写的），没有就现场用本地规则拼一份，
 * 保证归档里永远不会出现空白总结。
 */
export const buildArchive = (
  current: DashboardState,
  existing?: DailyArchive,
  date = todayIso(),
  createdAt = new Date().toISOString(),
): DailyArchive => {
  const completedTasks = current.tasks.filter((task) => task.done)
  const openTasks = current.tasks.filter((task) => !task.done)

  const summary =
    current.reviewSummary ||
    buildLocalSummary(
      current.review,
      completedTasks,
      openTasks,
      current.inbox,
      current.tomorrowTasks,
    )

  const existingRecords = existing?.focusRecords ?? []
  const currentRecords = selectFocusRecordsForDate(current.focusRecords, date)
  const focusRecords = mergeFocusRecords(existingRecords, currentRecords)
  const focusStats = computeFocusRecordStats(focusRecords)
  // 老归档只有累计分钟、没有明细；这部分无法反推，作为不可见基数继续保留。
  const legacyActualSeconds = Math.max(
    0,
    (existing?.actualFocusSeconds ?? 0) -
      computeFocusRecordStats(existingRecords).actualSeconds,
  )
  const legacyPlannedSeconds = Math.max(
    0,
    (existing?.plannedFocusMinutes ?? 0) * 60 -
      computeFocusRecordStats(existingRecords).plannedSeconds,
  )
  const actualFocusSeconds = legacyActualSeconds + focusStats.actualSeconds
  const plannedFocusMinutes = Math.floor(
    (legacyPlannedSeconds + focusStats.plannedSeconds) / 60,
  )

  return {
    id: existing?.id ?? uid(),
    date,
    createdAt,
    completedTasks,
    openTasks,
    tomorrowTasks: current.tomorrowTasks,
    inbox: current.inbox,
    review: current.review,
    summary,
    focusRecords,
    plannedFocusMinutes,
    actualFocusSeconds,
    totalFocusMinutes: Math.floor(actualFocusSeconds / 60),
  }
}

/** 归档今天；运行中的会话先切段，但保持原结束时间继续倒计时。 */
export const archiveDashboardToday = (
  current: DashboardState,
  now = new Date(),
): DashboardState => {
  const date = formatLocalDate(now)
  const checkpointAt = now.toISOString()
  const existing = current.archives.find((item) => item.date === date)
  let source = current

  if (current.focus.running) {
    const settlement = settleFocusSegment(
      current,
      getElapsedFocusSeconds(current.focus, now.getTime()),
      'archived',
      checkpointAt,
    )
    source = {
      ...current,
      projects: settlement.projects,
      tasks: settlement.tasks,
      focusRecords: settlement.focusRecords,
      focus: {
        ...current.focus,
        sessionId: settlement.sessionId || current.focus.sessionId,
        startedAt: checkpointAt,
      },
    }
  }

  const archive = buildArchive(source, existing, date, checkpointAt)
  return {
    ...source,
    archives: upsertArchive(source.archives, archive),
    focusRecords: source.focusRecords.filter((record) => record.date !== date),
    reviewSummary: archive.summary,
  }
}

/**
 * 把归档写入历史：同一天重复归档会覆盖旧的那条，最新的排在最前。
 * 超出上限的老记录直接截断（保留策略是另一套按天数的清理，见 domain/retention.ts）。
 */
export const upsertArchive = (archives: DailyArchive[], archive: DailyArchive) =>
  [archive, ...archives.filter((item) => item.date !== archive.date)].slice(
    0,
    ARCHIVE_HISTORY_LIMIT,
  )
