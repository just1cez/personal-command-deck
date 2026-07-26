/**
 * 列表内的上移 / 下移。
 *
 * 三种列表的排序规则**不一样**，放在一起看更容易理解差异：
 * - 明日任务：就是普通的相邻交换；
 * - 今日任务：Top 3 和普通待办共用一个数组，只能在**同类之间**交换；
 * - 项目：进行中和已结项共用一个数组，只能在**进行中**的项目之间交换。
 *
 * 统一约定：不能移动时返回 `null`，调用方据此跳过状态更新与动画，
 * 避免产生"看起来变了但其实没变"的多余渲染。
 */
import type { OrderDirection, Project, Task } from '../types'

/** 交换数组中两个下标的元素，返回新数组。 */
const swapItems = <T>(list: T[], indexA: number, indexB: number): T[] => {
  const next = [...list]
  ;[next[indexA], next[indexB]] = [next[indexB], next[indexA]]
  return next
}

const offsetOf = (direction: OrderDirection) => (direction === 'up' ? -1 : 1)

/**
 * 通用的相邻交换：按 id 找到元素并与上/下一个交换。
 * 用于明日任务这类"整个数组就是一个有序列表"的场景。
 */
export const moveItemById = <T extends { id: string }>(
  list: T[],
  id: string,
  direction: OrderDirection,
): T[] | null => {
  const index = list.findIndex((item) => item.id === id)
  const targetIndex = index + offsetOf(direction)
  if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return null
  return swapItems(list, index, targetIndex)
}

/**
 * 今日任务的换位：只在同一 kind（Top 3 / 普通待办）内部相邻交换。
 *
 * 实现上不是移动数组位置，而是把两条任务的**内容**互换到对方原来的槽位上，
 * 这样另一类任务在数组里的相对位置完全不受影响。
 */
export const moveTaskWithinKind = (
  tasks: Task[],
  id: string,
  direction: OrderDirection,
): Task[] | null => {
  const task = tasks.find((item) => item.id === id)
  if (!task) return null

  const group = tasks.filter((item) => item.kind === task.kind)
  const groupIndex = group.findIndex((item) => item.id === id)
  const targetGroupIndex = groupIndex + offsetOf(direction)
  if (groupIndex < 0 || targetGroupIndex < 0 || targetGroupIndex >= group.length) {
    return null
  }

  const target = group[targetGroupIndex]
  return tasks.map((item) => {
    if (item.id === id) return target
    if (item.id === target.id) return task
    return item
  })
}

/**
 * 项目的换位：只在"进行中"的项目之间相邻交换。
 * 先在进行中的子序列里找到目标项目，再回到完整数组里交换它们的真实位置。
 */
export const moveProjectWithinActive = (
  projects: Project[],
  id: string,
  direction: OrderDirection,
): Project[] | null => {
  const activeIds = projects
    .filter((project) => project.active !== false)
    .map((project) => project.id)

  const activeIndex = activeIds.indexOf(id)
  const targetId = activeIds[activeIndex + offsetOf(direction)]
  if (activeIndex < 0 || !targetId) return null

  const index = projects.findIndex((project) => project.id === id)
  const targetIndex = projects.findIndex((project) => project.id === targetId)
  if (index < 0 || targetIndex < 0) return null

  return swapItems(projects, index, targetIndex)
}
