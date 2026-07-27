/**
 * 每日归档：把"今天"定格成一条只读记录。
 */
import { ARCHIVE_HISTORY_LIMIT } from '../config/constants'
import type { DailyArchive, DashboardState } from '../types'
import { todayIso, uid } from '../utils'
import { getTotalFocusMinutes } from './projects'
import { buildLocalSummary } from './summary'

/**
 * 用当前状态生成一条归档。
 * 总结优先用已经生成好的（可能是 AI 写的），没有就现场用本地规则拼一份，
 * 保证归档里永远不会出现空白总结。
 */
export const buildArchive = (current: DashboardState): DailyArchive => {
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

  return {
    id: uid(),
    date: todayIso(),
    createdAt: new Date().toISOString(),
    completedTasks,
    openTasks,
    tomorrowTasks: current.tomorrowTasks,
    inbox: current.inbox,
    review: current.review,
    summary,
    totalFocusMinutes: getTotalFocusMinutes(current.projects),
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
