/**
 * 项目的增删改与结项 / 恢复。
 *
 * 这里最容易出错的是"项目状态变化时，正在跑的专注会话怎么办"。
 * 三条规则各不相同，对应 domain/focus.ts 里三个命名清晰的变换函数：
 * - 删除项目  -> detachFocusProject（只解绑，时间随项目一起丢弃）
 * - 结项      -> releaseFocusForCompletedProject（先把时间记上再解绑）
 * - 恢复项目  -> 不动专注会话
 */
import { useCallback } from 'react'
import { IDLE_FOCUS_LABEL } from '../config/constants'
import {
  detachFocusProject,
  getElapsedFocusSeconds,
  releaseFocusForCompletedProject,
  settleFocusSegment,
} from '../domain/focus'
import { moveProjectWithinActive } from '../domain/ordering'
import { createProject } from '../domain/projects'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import type { OrderDirection, Project } from '../types'
import { clampProgress } from '../utils'

export const useProjectActions = () => {
  const { dashboard, updateDashboard } = useDashboardStore()
  const { markOrderMove, closeProjectFocusDraftIfMatches } = useDeckUi()

  const addProject = useCallback(
    (rawName: string, rawNextAction: string) => {
      const name = rawName.trim()
      const nextAction = rawNextAction.trim()
      // 必须同时有名字和下一步动作：只有名字的项目等于一个永远推不动的愿望。
      if (!name || !nextAction) return false

      updateDashboard(
        (current) => ({
          ...current,
          projects: [...current.projects, createProject(name, nextAction)],
        }),
        '添加项目',
      )
      return true
    },
    [updateDashboard],
  )

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      updateDashboard(
        (current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.id === id ? { ...project, ...patch } : project,
          ),
        }),
        '编辑项目',
      )
    },
    [updateDashboard],
  )

  const setProjectProgress = useCallback(
    (id: string, value: number) => {
      updateProject(id, { progress: clampProgress(value) })
    },
    [updateProject],
  )

  /**
   * 删除项目。
   * 如果正在专注这个项目，先保存这一段的项目/任务名称快照，再删除并停表。
   */
  const removeProject = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => {
          if (current.focus.projectId !== id) {
            return {
              ...current,
              projects: current.projects.filter((project) => project.id !== id),
            }
          }
          const settlement = settleFocusSegment(
            current,
            getElapsedFocusSeconds(current.focus),
            'switched',
          )
          return {
            ...current,
            projects: settlement.projects.filter((project) => project.id !== id),
            tasks: settlement.tasks,
            focusRecords: settlement.focusRecords,
            focus: detachFocusProject(current.focus),
          }
        },
        '删除项目',
      )
      closeProjectFocusDraftIfMatches(id)
    },
    [closeProjectFocusDraftIfMatches, updateDashboard],
  )

  /**
   * 结项。
   * 与删除相反：先把正在跑的这一段时间记进项目再收尾，
   * 因为结项后这些数据还要在"已结项"列表里被看到。
   */
  const completeProject = useCallback(
    (id: string) => {
      updateDashboard((current) => {
        const isFocusedProject = current.focus.projectId === id
        const settlement = isFocusedProject
          ? settleFocusSegment(
              current,
              getElapsedFocusSeconds(current.focus),
              'switched',
            )
          : null
        const projects = settlement?.projects ?? current.projects

        return {
          ...current,
          projects: projects.map((project) =>
            project.id === id
              ? {
                  ...project,
                  active: false,
                  completedAt: new Date().toISOString(),
                }
              : project,
          ),
          tasks: settlement?.tasks ?? current.tasks,
          focusRecords: settlement?.focusRecords ?? current.focusRecords,
          currentFocus: isFocusedProject ? IDLE_FOCUS_LABEL : current.currentFocus,
          focus: isFocusedProject
            ? releaseFocusForCompletedProject(current.focus)
            : current.focus,
        }
      }, '结项')
      closeProjectFocusDraftIfMatches(id)
    },
    [closeProjectFocusDraftIfMatches, updateDashboard],
  )

  /** 把已结项的项目放回进行中。 */
  const restoreProject = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.id === id ? { ...project, active: true, completedAt: undefined } : project,
          ),
        }),
        '恢复项目',
      )
    },
    [updateDashboard],
  )

  /** 进行中项目之间的上移/下移；已结项项目在数组里的位置不受影响。 */
  const moveProject = useCallback(
    (id: string, direction: OrderDirection) => {
      if (!moveProjectWithinActive(dashboard.projects, id, direction)) return

      updateDashboard((current) => {
        const projects = moveProjectWithinActive(current.projects, id, direction)
        return projects ? { ...current, projects } : current
      }, '调整项目顺序')
      markOrderMove(id, direction)
    },
    [dashboard.projects, markOrderMove, updateDashboard],
  )

  return {
    addProject,
    updateProject,
    setProjectProgress,
    removeProject,
    completeProject,
    restoreProject,
    moveProject,
  }
}
