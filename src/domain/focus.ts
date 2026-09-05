/**
 * 专注会话的全部业务规则（纯函数，不依赖 React）。
 *
 * 核心模型：
 * - 计时**不靠每秒自减**。启动时记下 `startedAt` 和 `endsAt`，剩余秒数永远由
 *   `endsAt - now` 推算。这样窗口最小化、系统休眠、页面卡顿都不会把时间算丢。
 * - "结算"指把这一段实际专注的秒数写回项目（以及可选的关联待办）。
 *   暂停、重置、切换目标、自然结束这四个时机都要结算，逻辑完全一致，
 *   因此统一收敛到 {@link settleFocusSegment}。
 *
 * 把这些规则从组件里抽出来的直接好处：可以脱离 UI 单独推演和验证时间计算。
 */
import {
  FOCUS_MINUTES_MAX,
  FOCUS_MINUTES_MIN,
  FOCUS_RECORD_LIMIT,
  NOTICE,
} from '../config/constants'
import type {
  DashboardState,
  FocusEndReason,
  FocusRecord,
  FocusSession,
  Project,
  Task,
} from '../types'
import { clamp, formatLocalDate, uid } from '../utils'

/* -------------------------------------------------------------------------- */
/* 时间换算                                                                    */
/* -------------------------------------------------------------------------- */

/** 秒 -> 展示用分钟（向下取整：不满 1 分钟不计）。 */
export const secondsToDisplayMinutes = (seconds: number) => Math.floor(seconds / 60)

/** 把用户输入的分钟数夹到合法区间。 */
export const clampFocusMinutes = (minutes: number) =>
  clamp(minutes, FOCUS_MINUTES_MIN, FOCUS_MINUTES_MAX)

/** 由剩余秒数算出本轮结束时刻（ISO）。 */
export const createFocusEndTime = (secondsLeft: number) =>
  new Date(Date.now() + Math.max(0, secondsLeft) * 1000).toISOString()

/** 距离 `endsAt` 还剩多少秒；无效或已结束一律返回 0。 */
export const getFocusSecondsLeft = (endsAt?: string) => {
  if (!endsAt) return 0
  const endTime = new Date(endsAt).getTime()
  if (!Number.isFinite(endTime)) return 0
  return Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
}

/**
 * 这一段已经专注了多少秒。
 * 用 `min(now, endsAt)` 封顶，避免"计时早已结束、页面很久之后才被唤醒"时多记时间。
 */
export const getFocusSegmentSeconds = (
  startedAt?: string,
  endsAt?: string,
  now = Date.now(),
) => {
  if (!startedAt || !endsAt) return 0
  const startTime = new Date(startedAt).getTime()
  const endTime = new Date(endsAt).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0
  return Math.max(
    0,
    Math.floor((Math.min(now, endTime) - startTime) / 1000),
  )
}

/** 正在运行时这一段已过去的秒数；没在跑就是 0（没有可结算的时间）。 */
export const getElapsedFocusSeconds = (focus: FocusSession, now = Date.now()) =>
  focus.running ? getFocusSegmentSeconds(focus.startedAt, focus.endsAt, now) : 0

/* -------------------------------------------------------------------------- */
/* 会话状态判断                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 是否存在"暂停在半路、可以继续"的会话。
 * 判据：没在跑 + 有项目和目标 + 剩余秒数处于 (0, 整轮) 之间。
 */
export const isPausedFocusSession = (focus: FocusSession) =>
  !focus.running &&
  Boolean(focus.taskLabel) &&
  focus.secondsLeft > 0 &&
  focus.secondsLeft < focus.durationMinutes * 60

/** 即将启动的目标是否正是刚才暂停的那个——是的话应当续跑而不是重置计时。 */
export const isSamePausedFocus = (
  focus: FocusSession,
  projectId: string,
  taskLabel: string,
) =>
  !focus.running &&
  focus.projectId === projectId &&
  focus.taskLabel === taskLabel &&
  focus.secondsLeft > 0 &&
  focus.secondsLeft < focus.durationMinutes * 60

/* -------------------------------------------------------------------------- */
/* 结算：把专注时间写回项目与任务                                              */
/* -------------------------------------------------------------------------- */

/**
 * 给项目累加专注秒数，并同步展示用的分钟数。
 * `focusSeconds ?? minutes * 60` 是为了兼容只有 minutes 字段的早期数据。
 */
export const addFocusSecondsToProject = (project: Project, seconds: number): Project => {
  const focusSeconds = Math.max(
    0,
    (project.focusSeconds ?? project.minutes * 60) + Math.max(0, seconds),
  )
  return {
    ...project,
    focusSeconds,
    minutes: secondsToDisplayMinutes(focusSeconds),
  }
}

/** 给任务累加专注秒数。 */
export const addFocusSecondsToTask = (task: Task, seconds: number): Task => ({
  ...task,
  focusSeconds: Math.max(0, (task.focusSeconds ?? 0) + Math.max(0, seconds)),
})

/** 结算提示文案：不足 1 分钟也要给反馈，否则用户会以为没记上。 */
export const formatFocusRecordNotice = (projectName: string, seconds: number) =>
  seconds < 60
    ? NOTICE.focusRecordedUnderOneMinute(projectName, seconds)
    : NOTICE.focusRecorded(projectName, secondsToDisplayMinutes(seconds))

/** 一次结算的结果：新的项目列表、新的任务列表，以及要不要给用户提示。 */
export type FocusSettlement = {
  projects: Project[]
  tasks: Task[]
  focusRecords: FocusRecord[]
  /** 兼容升级前正在运行但没有 sessionId 的会话。 */
  sessionId: string
  /** 空字符串表示这次不需要提示（没有可结算的时间，或项目已被删除）。 */
  notice: string
}

const settleProjects = (current: DashboardState, seconds: number) => {
  const projectId = current.focus.projectId
  if (seconds <= 0) return { projects: current.projects, notice: '' }

  const targetProject = current.projects.find((project) => project.id === projectId)
  // 项目可能已经被删掉了，这时候静默丢弃这段时间，不打扰用户。
  if (!targetProject) return { projects: current.projects, notice: '' }

  return {
    projects: current.projects.map((project) =>
      project.id === projectId ? addFocusSecondsToProject(project, seconds) : project,
    ),
    notice: formatFocusRecordNotice(targetProject.name, seconds),
  }
}

const settleTasks = (current: DashboardState, seconds: number): Task[] => {
  const taskId = current.focus.taskId
  if (!taskId || seconds <= 0) return current.tasks
  if (!current.tasks.some((task) => task.id === taskId)) return current.tasks

  return current.tasks.map((task) =>
    task.id === taskId ? addFocusSecondsToTask(task, seconds) : task,
  )
}

/**
 * 把这一段专注时间同时结算到当前项目和关联待办上。
 *
 * 暂停 / 重置 / 切换目标 / 自然结束都调用它，保证四条路径的记账规则完全一致。
 * 传入 0 秒时是空操作，返回原数组，不会产生多余的引用变化。
 */
export const settleFocusSegment = (
  current: DashboardState,
  seconds: number,
  endReason: FocusEndReason,
  endedAt = new Date().toISOString(),
): FocusSettlement => {
  if (seconds <= 0 || !current.focus.startedAt) {
    return {
      projects: current.projects,
      tasks: current.tasks,
      focusRecords: current.focusRecords,
      sessionId: current.focus.sessionId ?? '',
      notice: '',
    }
  }

  const startedTime = new Date(current.focus.startedAt).getTime()
  const requestedEndedTime = new Date(endedAt).getTime()
  const focusEndedTime = new Date(current.focus.endsAt ?? endedAt).getTime()
  const endedTime = Math.min(requestedEndedTime, focusEndedTime)
  if (!Number.isFinite(startedTime) || !Number.isFinite(endedTime) || endedTime < startedTime) {
    return {
      projects: current.projects,
      tasks: current.tasks,
      focusRecords: current.focusRecords,
      sessionId: current.focus.sessionId ?? '',
      notice: '',
    }
  }

  const { projects, notice } = settleProjects(current, seconds)
  const targetProject = current.projects.find(
    (project) => project.id === current.focus.projectId,
  )
  const targetTask = current.tasks.find((task) => task.id === current.focus.taskId)
  const sessionId = current.focus.sessionId || uid()
  const record: FocusRecord = {
    id: uid(),
    sessionId,
    date: formatLocalDate(new Date(current.focus.startedAt)),
    startedAt: current.focus.startedAt,
    endedAt: new Date(endedTime).toISOString(),
    plannedSeconds:
      current.focus.plannedSeconds ?? current.focus.durationMinutes * 60,
    actualSeconds: seconds,
    targetLabel: current.focus.taskLabel || targetTask?.title || targetProject?.nextAction || '',
    projectId: current.focus.projectId || undefined,
    taskId: current.focus.taskId || undefined,
    projectName: targetProject?.name ?? '',
    taskTitle: targetTask?.title ?? '',
    endReason,
  }

  return {
    projects,
    tasks: settleTasks(current, seconds),
    focusRecords: [...current.focusRecords, record].slice(-FOCUS_RECORD_LIMIT),
    sessionId,
    notice,
  }
}

/* -------------------------------------------------------------------------- */
/* 会话变换                                                                    */
/* -------------------------------------------------------------------------- */

/** 停表并回到"整轮待命"：清空本轮目标、秒数复位。用于重置与自然结束。 */
export const resetFocusSession = (focus: FocusSession): FocusSession => ({
  ...focus,
  running: false,
  secondsLeft: focus.durationMinutes * 60,
  taskLabel: '',
  taskId: '',
  sessionId: undefined,
  plannedSeconds: undefined,
  endsAt: undefined,
  startedAt: undefined,
})

/** 停表但保留剩余秒数与目标文案，方便随后继续。 */
export const pauseFocusSession = (focus: FocusSession, secondsLeft: number): FocusSession => ({
  ...focus,
  running: false,
  secondsLeft,
  endsAt: undefined,
  startedAt: undefined,
})

/**
 * 项目被**删除**时：只解绑项目并停表。
 * 刻意保留 secondsLeft 与 taskLabel——用户可能只是删错了项目，界面不该跟着全清。
 */
export const detachFocusProject = (focus: FocusSession): FocusSession => ({
  ...focus,
  projectId: '',
  taskId: '',
  running: false,
  sessionId: undefined,
  plannedSeconds: undefined,
  endsAt: undefined,
  startedAt: undefined,
})

/**
 * 项目**结项**时：解绑项目、停表、清空目标文案并把秒数复位。
 * 注意这里不清 taskId（与历史行为保持一致）。
 */
export const releaseFocusForCompletedProject = (focus: FocusSession): FocusSession => ({
  ...focus,
  projectId: '',
  running: false,
  taskLabel: '',
  secondsLeft: focus.durationMinutes * 60,
  taskId: '',
  sessionId: undefined,
  plannedSeconds: undefined,
  endsAt: undefined,
  startedAt: undefined,
})

/* -------------------------------------------------------------------------- */
/* 断电恢复                                                                    */
/* -------------------------------------------------------------------------- */

/** 上次会话在计时中退出后，重新打开时要补的账。 */
export type OfflineFocusRecovery = {
  /** 上次退出时是否正在计时。false 时其余字段无意义。 */
  wasRunning: boolean
  /** 离线期间实际过去的秒数，需要补记到项目与任务上。 */
  offlineSeconds: number
  /** 这一轮是否已经在离线期间跑完。 */
  expired: boolean
  /** 未跑完时应当恢复的剩余秒数。 */
  secondsLeft: number
}

/**
 * 计算"关掉应用时正在跑的那一轮"该怎么收尾。
 *
 * 关键点：时间是真实流逝的，不能因为应用没开着就当作没发生。
 * `min(now, endsAt)` 保证只补到本轮结束为止，隔了三天再打开也不会多记。
 * 未跑完时至少留 1 秒，避免恢复出一个"0 秒但没结束"的诡异状态。
 */
export const recoverOfflineFocus = (
  session: { running: boolean; startedAt: string; endsAt: string },
  durationMinutes: number,
  now: number,
): OfflineFocusRecovery => {
  const startedAtTime = new Date(session.startedAt).getTime()
  const endsAtTime = new Date(session.endsAt).getTime()
  const wasRunning =
    session.running &&
    Number.isFinite(startedAtTime) &&
    Number.isFinite(endsAtTime) &&
    endsAtTime > startedAtTime

  if (!wasRunning) {
    return { wasRunning: false, offlineSeconds: 0, expired: false, secondsLeft: 0 }
  }

  const expired = now >= endsAtTime
  return {
    wasRunning: true,
    offlineSeconds: Math.max(
      0,
      Math.floor((Math.min(now, endsAtTime) - startedAtTime) / 1000),
    ),
    expired,
    secondsLeft: expired
      ? durationMinutes * 60
      : Math.min(durationMinutes * 60, Math.max(1, Math.ceil((endsAtTime - now) / 1000))),
  }
}

/* -------------------------------------------------------------------------- */
/* 本轮目标                                                                    */
/* -------------------------------------------------------------------------- */

/** 聚焦页展示的一行目标：主文案 + 来源说明。 */
export type FocusTarget = {
  label: string
  source: string
}

/** 用户手动选择的目标，比自动推荐多了"要计到哪个项目/待办"。 */
export type ManualFocusTarget = FocusTarget & {
  projectId: string
  taskId: string
}

/** 下拉框里 option.value 的编码方式。 */
const TASK_CHOICE_PREFIX = 'task:'
const PROJECT_CHOICE_PREFIX = 'project:'

export const taskFocusChoice = (taskId: string) => `${TASK_CHOICE_PREFIX}${taskId}`
export const projectFocusChoice = (projectId: string) => `${PROJECT_CHOICE_PREFIX}${projectId}`

/**
 * 解析下拉框选中的目标。
 * 返回 null 表示"选中的东西已经不存在了（被删除或已完成）"，此时回退到自动推荐。
 */
export const resolveManualFocusTarget = (
  choice: string,
  tasks: Task[],
  activeProjects: Project[],
  defaultProjectId: string,
): ManualFocusTarget | null => {
  if (choice.startsWith(TASK_CHOICE_PREFIX)) {
    const taskId = choice.slice(TASK_CHOICE_PREFIX.length)
    const task = tasks.find((item) => item.id === taskId && !item.done)
    if (!task) return null
    return {
      label: task.title,
      source: task.kind === 'top' ? '来自 Top 3' : '来自普通待办',
      // 选中的是任务时没有项目归属，落到默认项目上记账。
      projectId: defaultProjectId,
      taskId: task.id,
    }
  }

  if (choice.startsWith(PROJECT_CHOICE_PREFIX)) {
    const projectId = choice.slice(PROJECT_CHOICE_PREFIX.length)
    const project = activeProjects.find((item) => item.id === projectId)
    if (!project) return null
    return {
      label: project.nextAction || project.name,
      source: `来自项目 · ${project.name}`,
      projectId: project.id,
      taskId: '',
    }
  }

  return null
}

/**
 * 没手动选目标时的自动推荐，优先级：
 * 未完成的 Top 3 > 未完成的普通待办 > 项目的下一步动作 > 兜底提示。
 */
export const resolveAutoFocusTarget = (
  topTasks: Task[],
  todos: Task[],
  suggestedProject?: Project,
): FocusTarget => {
  const priorityTopTask = topTasks.find((task) => !task.done)
  if (priorityTopTask) {
    return { label: priorityTopTask.title, source: '来自 Top 3' }
  }

  const priorityTodo = todos.find((task) => !task.done)
  if (priorityTodo) {
    return { label: priorityTodo.title, source: '来自普通待办' }
  }

  return {
    label: suggestedProject?.nextAction ?? '先写下一个可以立刻开始的动作',
    source: suggestedProject ? '来自项目推进' : '等待设置目标',
  }
}

/**
 * 聚焦页最终显示哪一行，优先级：
 * 正在专注 > 手动选择 > 暂停可继续 > 自动推荐。
 */
export const resolveVisibleFocusTarget = (
  dashboard: DashboardState,
  options: {
    manualTarget: ManualFocusTarget | null
    autoTarget: FocusTarget
    activeProject?: Project
  },
): FocusTarget => {
  const { focus } = dashboard
  const { manualTarget, autoTarget, activeProject } = options

  if (focus.running) {
    return {
      label: dashboard.currentFocus,
      source: activeProject ? `正在记录到 ${activeProject.name}` : '正在专注',
    }
  }
  if (manualTarget) {
    return { label: manualTarget.label, source: manualTarget.source }
  }
  if (isPausedFocusSession(focus)) {
    return { label: focus.taskLabel, source: '已暂停，可继续' }
  }
  return autoTarget
}
