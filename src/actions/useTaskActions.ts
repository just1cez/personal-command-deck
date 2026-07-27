/**
 * 今日任务 / 明日任务的所有写操作。
 *
 * 约定：
 * - 需要输入校验的动作返回 `boolean`，`true` 才代表真的写进去了。
 *   调用方据此决定要不要清空输入框、收起表单——这样"校验规则"只有一份，
 *   不会出现"表单收起来了但任务没加上"。
 * - 状态计算全部委托给 domain/，这里只负责编排（更新状态 + 提示 + 动画）。
 */
import { useCallback } from 'react'
import { NOTICE } from '../config/constants'
import { moveItemById, moveTaskWithinKind } from '../domain/ordering'
import {
  carryTomorrowTasksIntoToday,
  createTask,
  isTopTaskLimitReached,
} from '../domain/tasks'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import type { OrderDirection, TaskKind } from '../types'
import { clampProgress, todayIso } from '../utils'

export const useTaskActions = () => {
  const { dashboard, updateDashboard, showNotice } = useDashboardStore()
  const { markOrderMove } = useDeckUi()

  /* ---------------------------------------------------------------------- */
  /* 今日任务                                                                */
  /* ---------------------------------------------------------------------- */

  const addTask = useCallback(
    (kind: TaskKind, rawTitle: string) => {
      const title = rawTitle.trim()
      if (!title) return false
      // Top 3 满了就不再接收，避免"最重要的事"变成第二个待办列表。
      if (kind === 'top' && isTopTaskLimitReached(dashboard.tasks)) return false

      updateDashboard(
        (current) => ({ ...current, tasks: [...current.tasks, createTask(title, kind)] }),
        `添加任务(${kind})`,
      )
      return true
    },
    [dashboard.tasks, updateDashboard],
  )

  /** 勾选/取消勾选；完成度会跟着跳到 100% 或 0%，保持两者永远一致。 */
  const toggleTask = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== id) return task
            const done = !task.done
            return { ...task, done, progress: done ? 100 : 0 }
          }),
        }),
        '切换任务完成状态',
      )
    },
    [updateDashboard],
  )

  /** 拖动进度条；拉满即视为完成。 */
  const setTaskProgress = useCallback(
    (id: string, value: number) => {
      const progress = clampProgress(value)
      updateDashboard(
        (current) => ({
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === id ? { ...task, progress, done: progress >= 100 } : task,
          ),
        }),
        '调整任务完成度',
      )
    },
    [updateDashboard],
  )

  const removeTask = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }),
        '删除任务',
      )
    },
    [updateDashboard],
  )

  const renameTask = useCallback(
    (id: string, title: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          tasks: current.tasks.map((task) => (task.id === id ? { ...task, title } : task)),
        }),
        '重命名任务',
      )
    },
    [updateDashboard],
  )

  /**
   * 同类任务之间上移/下移。
   * 先用当前快照试算一次：不能移动就直接返回，能移动才更新状态并播放动画，
   * 这样"有没有动"和"有没有动画"永远一致。
   */
  const moveTask = useCallback(
    (id: string, direction: OrderDirection) => {
      if (!moveTaskWithinKind(dashboard.tasks, id, direction)) return

      updateDashboard((current) => {
        const tasks = moveTaskWithinKind(current.tasks, id, direction)
        return tasks ? { ...current, tasks } : current
      }, '调整任务顺序')
      markOrderMove(id, direction)
    },
    [dashboard.tasks, markOrderMove, updateDashboard],
  )

  /* ---------------------------------------------------------------------- */
  /* 明日任务                                                                */
  /* ---------------------------------------------------------------------- */

  const addTomorrowTask = useCallback(
    (rawTitle: string) => {
      const title = rawTitle.trim()
      if (!title) return false

      updateDashboard(
        (current) => ({
          ...current,
          tomorrowTasks: [...current.tomorrowTasks, createTask(title, 'todo')],
        }),
        '添加明日任务',
      )
      return true
    },
    [updateDashboard],
  )

  const toggleTomorrowTask = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          tomorrowTasks: current.tomorrowTasks.map((task) =>
            task.id === id ? { ...task, done: !task.done } : task,
          ),
        }),
        '切换明日任务状态',
      )
    },
    [updateDashboard],
  )

  const removeTomorrowTask = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          tomorrowTasks: current.tomorrowTasks.filter((task) => task.id !== id),
        }),
        '删除明日任务',
      )
    },
    [updateDashboard],
  )

  const moveTomorrowTask = useCallback(
    (id: string, direction: OrderDirection) => {
      if (!moveItemById(dashboard.tomorrowTasks, id, direction)) return

      updateDashboard((current) => {
        const tomorrowTasks = moveItemById(current.tomorrowTasks, id, direction)
        return tomorrowTasks ? { ...current, tomorrowTasks } : current
      }, '调整明日任务顺序')
      markOrderMove(id, direction)
    },
    [dashboard.tomorrowTasks, markOrderMove, updateDashboard],
  )

  /** 手动把明日任务提前搬进今日（跨天时会自动执行同样的搬运）。 */
  const promoteTomorrowTasks = useCallback(() => {
    updateDashboard(
      (current) => carryTomorrowTasksIntoToday(current, todayIso()),
      '带入明日任务',
    )
    showNotice(NOTICE.tomorrowTasksPromoted)
  }, [showNotice, updateDashboard])

  return {
    addTask,
    toggleTask,
    setTaskProgress,
    removeTask,
    renameTask,
    moveTask,
    addTomorrowTask,
    toggleTomorrowTask,
    removeTomorrowTask,
    moveTomorrowTask,
    promoteTomorrowTasks,
  }
}
