/**
 * 跨视图共用的派生数据。
 *
 * 这些值都是状态的纯函数，之所以集中算一次再通过 context 分发，
 * 是为了让三个主视图看到**同一份引用**：既省掉重复计算，也让依赖它们的
 * useMemo（例如命令面板的搜索结果）不会因为每次重新构造数组而白白失效。
 *
 * 刻意按"任务 / 项目 / 提醒"分成三组：调用方可以分别 memo，
 * 这样专注计时每秒更新 focus 字段时，项目和提醒的派生结果不会跟着重算。
 *
 * 只有单个视图用得到的派生值（归档列表、聚焦目标等）就地计算即可，不必放这里。
 */
import type { DashboardState, Project, Reminder, Task } from '../types'
import { getTotalFocusMinutes, selectActiveProjects, selectCompletedProjects } from './projects'
import { countUpcomingUrgentReminders } from './reminders'
import { selectTodos, selectTopTasks } from './tasks'

export type TaskStats = {
  topTasks: Task[]
  todos: Task[]
  /** 今日已完成的任务数（Top 3 + 普通待办）。 */
  completedTaskCount: number
  /** 今日已完成的 Top 3 数量。 */
  completedTopCount: number
  /** 今日完成率，0-100 的整数。 */
  completionRate: number
}

export type ProjectStats = {
  activeProjects: Project[]
  completedProjects: Project[]
  /** 所有项目累计专注分钟数（含已结项）。 */
  totalFocusMinutes: number
}

export type ReminderStats = {
  /** 未来 3 天内到期的提醒数量（不含已过期）。 */
  urgentReminderCount: number
}

export type DeckStats = TaskStats & ProjectStats & ReminderStats

export const computeTaskStats = (tasks: DashboardState['tasks']): TaskStats => {
  const topTasks = selectTopTasks(tasks)
  const completedTaskCount = tasks.filter((task) => task.done).length

  return {
    topTasks,
    todos: selectTodos(tasks),
    completedTaskCount,
    completedTopCount: topTasks.filter((task) => task.done).length,
    completionRate: tasks.length ? Math.round((completedTaskCount / tasks.length) * 100) : 0,
  }
}

export const computeProjectStats = (projects: Project[]): ProjectStats => ({
  activeProjects: selectActiveProjects(projects),
  completedProjects: selectCompletedProjects(projects),
  totalFocusMinutes: getTotalFocusMinutes(projects),
})

export const computeReminderStats = (reminders: Reminder[]): ReminderStats => ({
  urgentReminderCount: countUpcomingUrgentReminders(reminders),
})
