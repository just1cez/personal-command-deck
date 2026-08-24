/**
 * 专注计时的启动、暂停、重置与时长调整。
 *
 * 四个动作共享同一条主线：**先结算上一段，再改变会话状态**。
 * 结算逻辑收在 domain/focus.ts 的 settleFocusSegment 里，这里只负责调用时机。
 */
import { useCallback } from 'react'
import { FREE_FOCUS_LABEL, IDLE_FOCUS_LABEL } from '../config/constants'
import {
  clampFocusMinutes,
  createFocusEndTime,
  getElapsedFocusSeconds,
  getFocusSecondsLeft,
  getFocusSegmentSeconds,
  isSamePausedFocus,
  pauseFocusSession,
  resetFocusSession,
  settleFocusSegment,
} from '../domain/focus'
import { requestWebNotificationPermission } from '../services/notifications'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import type { Project } from '../types'
import { uid } from '../utils'

export const useFocusActions = () => {
  const { dashboard, stats, updateDashboard, queueNotice } = useDashboardStore()
  const {
    projectFocusDraft,
    openProjectFocusDraft,
    closeProjectFocusDraft,
    setActiveMainView,
  } = useDeckUi()

  /**
   * 开始（或继续）一轮专注。
   *
   * @param projectId 计入哪个项目，默认沿用上一次的项目
   * @param taskLabel 本轮目标文案，留空则用项目的下一步动作
   * @param taskId    可选：同时把时长记到某条今日待办上
   *
   * 三个细节：
   * - 找不到（或没有）进行中的项目时**照样可以开始**，记为「自由专注」，
   *   只是这段时间不会计入任何项目——先动起来比先建档更重要；
   * - 从"正在跑"切到别的目标时，先把已过去的时间结算掉，不能白跑；
   * - 如果要启动的正是刚才暂停的那一轮，接着剩余秒数跑，而不是重新计时。
   */
  const startFocus = useCallback(
    (projectId = dashboard.focus.projectId, taskLabel = '', taskId = '') => {
      // 在用户表达"我要专注"的这一刻请求通知权限，授权弹窗才有上下文。
      requestWebNotificationPermission()

      updateDashboard((current) => {
        // 已结项的项目不再接收新的专注时间。
        const project = current.projects.find(
          (item) => item.id === projectId && item.active !== false,
        )
        const nextProjectId = project?.id ?? ''
        const nextLabel = taskLabel || project?.nextAction || FREE_FOCUS_LABEL

        const isSwitchingRunningFocus =
          current.focus.running &&
          (current.focus.projectId !== nextProjectId || current.focus.taskLabel !== nextLabel)
        const elapsedSeconds = isSwitchingRunningFocus
          ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
          : 0

        const resuming = isSamePausedFocus(current.focus, nextProjectId, nextLabel)
        const secondsLeft = resuming
          ? current.focus.secondsLeft
          : current.focus.durationMinutes * 60

        const { projects, tasks, focusRecords, notice } = settleFocusSegment(
          current,
          elapsedSeconds,
          'switched',
        )
        if (notice) queueNotice(notice)

        return {
          ...current,
          projects,
          tasks,
          focusRecords,
          currentFocus: nextLabel,
          focus: {
            ...current.focus,
            running: true,
            projectId: nextProjectId,
            taskLabel: nextLabel,
            // 续跑时保留原来的关联待办，重新开始才用新传入的。
            taskId: resuming ? current.focus.taskId : taskId,
            sessionId: resuming ? current.focus.sessionId || uid() : uid(),
            plannedSeconds: resuming
              ? current.focus.plannedSeconds ?? current.focus.durationMinutes * 60
              : secondsLeft,
            secondsLeft,
            endsAt: createFocusEndTime(secondsLeft),
            startedAt: new Date().toISOString(),
          },
        }
      }, '开始专注')
    },
    [dashboard.focus.projectId, queueNotice, updateDashboard],
  )

  /** 暂停：结算这一段，保留剩余秒数与目标，随时可以继续。 */
  const pauseFocus = useCallback(() => {
    updateDashboard((current) => {
      const elapsedSeconds = getElapsedFocusSeconds(current.focus)
      const secondsLeft = current.focus.running
        ? getFocusSecondsLeft(current.focus.endsAt)
        : current.focus.secondsLeft

      const { projects, tasks, focusRecords, sessionId, notice } = settleFocusSegment(
        current,
        elapsedSeconds,
        'paused',
      )
      if (notice) queueNotice(notice)

      return {
        ...current,
        projects,
        tasks,
        focusRecords,
        focus: pauseFocusSession({ ...current.focus, sessionId }, secondsLeft),
      }
    }, '暂停专注')
  }, [queueNotice, updateDashboard])

  /** 重置：结算这一段后清空本轮目标，回到整轮待命。 */
  const resetFocus = useCallback(() => {
    updateDashboard((current) => {
      const { projects, tasks, focusRecords, notice } = settleFocusSegment(
        current,
        getElapsedFocusSeconds(current.focus),
        'reset',
      )
      if (notice) queueNotice(notice)

      return {
        ...current,
        projects,
        tasks,
        focusRecords,
        currentFocus: IDLE_FOCUS_LABEL,
        focus: resetFocusSession(current.focus),
      }
    }, '重置专注')
  }, [queueNotice, updateDashboard])

  /**
   * 调整整轮时长。
   * 正在跑的时候只改"下一轮"的时长，本轮的 endsAt 不动——
   * 中途把倒计时改长改短会让人分不清到底还剩多久。
   */
  const setFocusDuration = useCallback(
    (durationMinutes: number) => {
      updateDashboard(
        (current) => ({
          ...current,
          focus: {
            ...current.focus,
            durationMinutes,
            secondsLeft: current.focus.running
              ? getFocusSecondsLeft(current.focus.endsAt)
              : durationMinutes * 60,
            endsAt: current.focus.running ? current.focus.endsAt : undefined,
            startedAt: current.focus.running ? current.focus.startedAt : undefined,
          },
        }),
        '调整专注时长',
      )
    },
    [updateDashboard],
  )

  /* ---------------------------------------------------------------------- */
  /* 项目专注弹窗                                                            */
  /* ---------------------------------------------------------------------- */

  /** 打开弹窗，默认时长沿用当前设置。 */
  const openProjectFocusDialog = useCallback(
    (project: Project) => {
      openProjectFocusDraft(project.id, dashboard.focus.durationMinutes)
    },
    [dashboard.focus.durationMinutes, openProjectFocusDraft],
  )

  /** 弹窗当前指向的项目；null 表示弹窗关闭或项目已不在进行中。 */
  const projectFocusTarget = stats.activeProjects.find(
    (project) => project.id === projectFocusDraft.projectId,
  )

  /** 确认弹窗：按草稿里的时长和关联待办开一轮新的专注，并切回聚焦页。 */
  const startProjectFocus = useCallback(() => {
    if (!projectFocusTarget) return
    requestWebNotificationPermission()
    const durationMinutes = clampFocusMinutes(projectFocusDraft.minutes)

    updateDashboard((current) => {
      const project = current.projects.find((item) => item.id === projectFocusTarget.id)
      if (!project) return current

      const { projects, tasks, focusRecords, notice } = settleFocusSegment(
        current,
        getElapsedFocusSeconds(current.focus),
        'switched',
      )
      if (notice) queueNotice(notice)

      const secondsLeft = durationMinutes * 60
      return {
        ...current,
        projects,
        tasks,
        focusRecords,
        currentFocus: project.nextAction,
        focus: {
          ...current.focus,
          durationMinutes,
          running: true,
          projectId: project.id,
          taskLabel: project.nextAction,
          taskId: projectFocusDraft.taskId,
          sessionId: uid(),
          plannedSeconds: secondsLeft,
          secondsLeft,
          endsAt: createFocusEndTime(secondsLeft),
          startedAt: new Date().toISOString(),
        },
      }
    }, '开始项目专注')

    closeProjectFocusDraft()
    setActiveMainView('start')
  }, [
    closeProjectFocusDraft,
    projectFocusDraft.minutes,
    projectFocusDraft.taskId,
    projectFocusTarget,
    queueNotice,
    setActiveMainView,
    updateDashboard,
  ])

  return {
    startFocus,
    pauseFocus,
    resetFocus,
    setFocusDuration,
    openProjectFocusDialog,
    projectFocusTarget,
    startProjectFocus,
  }
}
