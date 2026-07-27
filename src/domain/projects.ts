/**
 * 项目列表相关的选择器与派生值。
 */
import { DEFAULT_PROJECT_NAME } from '../config/constants'
import type { Project } from '../types'
import { uid } from '../utils'
import { secondsToDisplayMinutes } from './focus'

/**
 * 进行中的项目。
 * 用 `!== false` 而不是 `=== true`：早期数据里可能根本没有 `active` 字段，
 * 这类项目应当按"进行中"处理。
 */
export const selectActiveProjects = (projects: Project[]) =>
  projects.filter((project) => project.active !== false)

/** 已结项的项目。 */
export const selectCompletedProjects = (projects: Project[]) =>
  projects.filter((project) => project.active === false)

/** 所有项目累计的专注分钟数（含已结项，代表"总投入"）。 */
export const getTotalFocusMinutes = (projects: Project[]) =>
  projects.reduce(
    (total, project) =>
      total + secondsToDisplayMinutes(project.focusSeconds ?? project.minutes * 60),
    0,
  )

/** 创建一个新项目。 */
export const createProject = (name: string, nextAction: string): Project => ({
  id: uid(),
  name,
  nextAction,
  minutes: 0,
  focusSeconds: 0,
  active: true,
})

/**
 * 任务型目标（不属于任何项目）默认把时间记到哪个项目上。
 * 优先级：主场项目 > 第一个进行中的项目 > 列表里的第一个。
 */
export const resolveDefaultFocusProject = (activeProjects: Project[]) =>
  activeProjects.find((project) => project.name === DEFAULT_PROJECT_NAME) ??
  activeProjects.find((project) => project.active) ??
  activeProjects[0]

/**
 * 聚焦页"来自项目推进"这一行取哪个项目：
 * 正在专注的项目优先，否则退回默认项目。
 */
export const resolveSuggestedProject = (
  activeProjects: Project[],
  focusedProject?: Project,
) =>
  focusedProject ??
  activeProjects.find((project) => project.active) ??
  activeProjects[0]
