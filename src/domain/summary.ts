/**
 * 本地复盘总结（不联网时的兜底方案）。
 *
 * 规则很简单：用户手写的内容优先，没写就从今天的数据里挑一条最合适的补上，
 * 保证"点了生成就一定有东西可看"。AI 版本的提示词在 services/aiSummary.ts。
 */
import { todayIso } from '../utils'
import { selectDailyFocus } from './focusRecords'
import type { DailyReview, DashboardState, InboxItem, Task } from '../types'

export const buildLocalSummary = (
  review: DailyReview,
  completedTasks: Task[],
  openTasks: Task[],
  inbox: InboxItem[],
  tomorrowTasks: Task[] = [],
) => {
  const did =
    review.did.trim() ||
    (completedTasks.length
      ? `完成了 ${completedTasks.slice(0, 3).map((task) => task.title).join('、')}`
      : '今天还没有记录明确完成项')

  const stuck = review.stuck.trim() || '没有记录明显卡点'

  // 明天第一步的兜底顺序：手写 > 明日未完成任务 > 明日任一任务 > 今日遗留 > 灵感暂存。
  const tomorrow =
    review.tomorrow.trim() ||
    tomorrowTasks.find((task) => !task.done)?.title ||
    tomorrowTasks[0]?.title ||
    openTasks[0]?.title ||
    inbox[0]?.text ||
    '先写下明天醒来能直接开始的一小步'

  return [
    `今日推进：${did}`,
    `卡点观察：${stuck}`,
    `明天第一步：${tomorrow}`,
    tomorrowTasks.length
      ? `明日任务：${tomorrowTasks.map((task) => task.title).join('；')}`
      : '',
  ]
    .join('\n')
    .trim()
}

/** 不含密钥或配置；归档前后相同的每日数据应得到相同快照。 */
export const buildReviewInputSnapshot = (state: DashboardState, date = todayIso()) => {
  const focus = selectDailyFocus(state, date)
  return JSON.stringify({
    date, review: state.review, tasks: state.tasks, tomorrowTasks: state.tomorrowTasks,
    projects: state.projects, inbox: state.inbox, reminders: state.reminders,
    dayMode: state.dayMode, energy: state.energy, currentFocus: state.currentFocus,
    actualSeconds: focus.actualSeconds, plannedSeconds: focus.plannedSeconds,
    segmentCount: focus.segmentCount,
  })
}
