/**
 * 今日任务与明日任务的业务规则。
 */
import { TOP_TASK_LIMIT } from '../config/constants'
import type { DashboardState, Task, TaskKind } from '../types'
import { uid } from '../utils'

/** 今日 Top 3。 */
export const selectTopTasks = (tasks: Task[]) => tasks.filter((task) => task.kind === 'top')

/** 普通待办。 */
export const selectTodos = (tasks: Task[]) => tasks.filter((task) => task.kind === 'todo')

/** Top 3 是否已满（满了就不允许再添加）。 */
export const isTopTaskLimitReached = (tasks: Task[]) =>
  selectTopTasks(tasks).length >= TOP_TASK_LIMIT

/** 创建一条新任务；新任务的完成度默认由 `done` 推导，无需显式写入。 */
export const createTask = (title: string, kind: TaskKind): Task => ({
  id: uid(),
  title,
  done: false,
  kind,
})

/**
 * 把"明日任务"搬进今日任务。
 *
 * 触发时机有两个：跨天后自动搬（`dailyCarryoverDate` 落后于今天），
 * 以及用户在复盘页手动点"带入今日任务"。
 *
 * 规则：
 * - 空标题的条目直接丢弃；
 * - 前若干条填进 Top 3 的空位，填满后剩下的都变成普通待办；
 * - 搬完清空明日列表，并把 `dailyCarryoverDate` 推进到目标日期。
 *
 * 没有任何可搬的条目时，只在日期确实变化的情况下才返回新对象，
 * 避免每次跨天检查都触发一次无意义的重渲染与写盘。
 */
export const carryTomorrowTasksIntoToday = (
  current: DashboardState,
  carryoverDate = current.dailyCarryoverDate,
): DashboardState => {
  const openTopSlots = Math.max(0, TOP_TASK_LIMIT - selectTopTasks(current.tasks).length)

  const carriedTasks = current.tomorrowTasks
    .filter((task) => task.title.trim())
    .map((task, index) =>
      createTask(task.title.trim(), index < openTopSlots ? 'top' : 'todo'),
    )

  if (!carriedTasks.length) {
    return current.dailyCarryoverDate === carryoverDate
      ? current
      : { ...current, dailyCarryoverDate: carryoverDate }
  }

  return {
    ...current,
    dailyCarryoverDate: carryoverDate,
    tasks: [...current.tasks, ...carriedTasks],
    tomorrowTasks: [],
  }
}

/** 待搬运的明日任务条数（用于提示"已带入 N 项"）。 */
export const countCarryableTomorrowTasks = (tasks: Task[]) =>
  tasks.filter((task) => task.title.trim()).length
