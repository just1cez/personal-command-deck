/**
 * 把任意"疑似仪表盘状态"的数据整形成合法的 `DashboardState`。
 *
 * 它是**所有外部数据进入应用的唯一入口**：localStorage 里的历史数据、
 * 用户导入的备份文件，都要先过这一道。因此这里同时承担三件事：
 * 1. 兜底：缺字段补默认值，类型不对就丢弃；
 * 2. 迁移：老版本的数据结构升级到当前结构（名言池、focusSeconds 等）；
 * 3. 清理：按保留策略剔除过期归档与已结项项目。
 *
 * 改动状态结构时请务必回到这里补一条规则，否则老用户升级后会白屏或丢数据。
 */
import {
  ARCHIVE_HISTORY_LIMIT,
  DEFAULT_REMINDER_LEAD_DAYS,
  ENERGY_MAX,
  ENERGY_MIN,
  FOCUS_MINUTES_MAX,
  FOCUS_MINUTES_MIN,
  FOCUS_MINUTES_TOTAL_MAX,
  FOCUS_SECONDS_MAX,
  IDLE_FOCUS_LABEL,
  RETENTION_MAX_DAYS,
} from '../config/constants'
import {
  addFocusSecondsToProject,
  addFocusSecondsToTask,
  recoverOfflineFocus,
} from '../domain/focus'
import {
  aiProviderDefaults,
  selectableLinkIcons,
  validAiProviders,
  validDayModes,
  validThemes,
} from '../config/options'
import { applyRetentionPolicy } from '../domain/retention'
import type {
  AiProvider,
  DailyArchive,
  DashboardState,
  DayMode,
  InboxItem,
  Project,
  QuickLink,
  Reminder,
  StoredDashboardState,
  Task,
  Theme,
} from '../types'
import { clampProgress, dateAfter, normalizeHttpUrl, todayIso, uid } from '../utils'
import { defaultState } from './defaults'
import {
  booleanValue,
  clampedNumber,
  isIsoDateTime,
  isLocalDateString,
  isPlainObject,
  textValue,
  trimmedText,
} from './parsers'
import { normalizeQuotes } from './quotes'

/* -------------------------------------------------------------------------- */
/* 各集合的规范化                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 任务列表。
 * `fallback` 用来区分两种场景：主任务列表为空时回填示例数据，
 * 而归档里的子列表为空就该真的是空数组。
 */
const normalizeTasks = (value: unknown, fallback = defaultState.tasks): Task[] => {
  if (!Array.isArray(value)) return fallback

  const tasks = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const title = trimmedText(item.title)
      if (!title) return null

      const kind = item.kind === 'top' || item.kind === 'todo' ? item.kind : 'todo'
      const done = booleanValue(item.done)

      const task: Task = {
        id: trimmedText(item.id) || uid(),
        title,
        done,
        kind,
        focusSeconds: clampedNumber(item.focusSeconds, 0, FOCUS_SECONDS_MAX, 0),
        // 早期数据没有 progress 字段，用完成状态推导一个合理初值。
        progress:
          typeof item.progress === 'number' && Number.isFinite(item.progress)
            ? clampProgress(item.progress)
            : done
              ? 100
              : 0,
      }
      return task
    })
    .filter((task): task is Task => Boolean(task))

  // 用户可能就是想把列表清空，不能再拿示例数据把它填回去。
  // fallback 只在字段整个缺失（首次使用）时生效。
  return tasks
}

const normalizeProjects = (value: unknown): Project[] => {
  if (!Array.isArray(value)) return defaultState.projects

  const projects = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const name = trimmedText(item.name)
      if (!name) return null

      const active = item.active !== false
      const minutes = clampedNumber(item.minutes, 0, FOCUS_MINUTES_TOTAL_MAX, 0)

      const project: Project = {
        id: trimmedText(item.id) || uid(),
        name,
        nextAction: trimmedText(item.nextAction),
        minutes,
        // 早期数据只有 minutes，按分钟折算出秒数作为初值。
        focusSeconds: clampedNumber(item.focusSeconds, 0, FOCUS_SECONDS_MAX, minutes * 60),
        active,
        progress:
          typeof item.progress === 'number' && Number.isFinite(item.progress)
            ? clampProgress(item.progress)
            : 0,
      }

      // 已结项但没有结项时间的（老数据），补一个"现在"，否则保留策略无从判断。
      if (!active) {
        project.completedAt = isIsoDateTime(item.completedAt)
          ? item.completedAt
          : new Date().toISOString()
      }
      return project
    })
    .filter((project): project is Project => Boolean(project))

  return projects
}

const normalizeQuickLinks = (value: unknown): QuickLink[] => {
  if (!Array.isArray(value)) return defaultState.quickLinks

  const links = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const label = trimmedText(item.label)
      // 非 http/https 的链接会被规范化成空串，这类入口直接丢弃。
      const url = normalizeHttpUrl(textValue(item.url))
      if (!label || !url) return null

      const icon = trimmedText(item.icon, 'link')
      return {
        id: trimmedText(item.id) || uid(),
        label,
        url,
        icon: selectableLinkIcons.has(icon) ? icon : 'link',
      }
    })
    .filter((link): link is QuickLink => Boolean(link))

  return links
}

const normalizeInbox = (value: unknown, fallback = defaultState.inbox): InboxItem[] => {
  if (!Array.isArray(value)) return fallback

  return value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const text = trimmedText(item.text)
      if (!text) return null
      return {
        id: trimmedText(item.id) || uid(),
        text,
        createdAt: textValue(item.createdAt, new Date().toISOString()),
      }
    })
    .filter((item): item is InboxItem => Boolean(item))
}

const normalizeReminders = (value: unknown): Reminder[] => {
  if (!Array.isArray(value)) return defaultState.reminders

  const reminders = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const title = trimmedText(item.title)
      if (!title) return null
      return {
        id: trimmedText(item.id) || uid(),
        title,
        date: isLocalDateString(item.date) ? item.date : dateAfter(DEFAULT_REMINDER_LEAD_DAYS),
        type: trimmedText(item.type, 'Deadline') || 'Deadline',
      }
    })
    .filter((reminder): reminder is Reminder => Boolean(reminder))

  return reminders
}

const normalizeArchives = (value: unknown): DailyArchive[] => {
  if (!Array.isArray(value)) return defaultState.archives

  return value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const review = isPlainObject(item.review) ? item.review : {}

      return {
        id: trimmedText(item.id) || uid(),
        date: isLocalDateString(item.date) ? item.date : todayIso(),
        createdAt: textValue(item.createdAt, new Date().toISOString()),
        // 归档是只读快照，这里再过滤一次完成状态，避免历史脏数据自相矛盾。
        completedTasks: normalizeTasks(item.completedTasks, []).filter((task) => task.done),
        openTasks: normalizeTasks(item.openTasks, []).filter((task) => !task.done),
        tomorrowTasks: normalizeTasks(item.tomorrowTasks, []),
        inbox: normalizeInbox(item.inbox, []),
        review: {
          did: textValue(review.did),
          stuck: textValue(review.stuck),
          tomorrow: textValue(review.tomorrow),
        },
        summary: textValue(item.summary),
        totalFocusMinutes: clampedNumber(item.totalFocusMinutes, 0, FOCUS_MINUTES_TOTAL_MAX, 0),
      }
    })
    .filter((archive): archive is DailyArchive => Boolean(archive))
    .slice(0, ARCHIVE_HISTORY_LIMIT)
}

const normalizeRetention = (value: unknown): DashboardState['retention'] => {
  const parsed = isPlainObject(value) ? value : {}
  return {
    reviewArchiveDays: clampedNumber(
      parsed.reviewArchiveDays,
      0,
      RETENTION_MAX_DAYS,
      defaultState.retention.reviewArchiveDays,
    ),
    completedProjectDays: clampedNumber(
      parsed.completedProjectDays,
      0,
      RETENTION_MAX_DAYS,
      defaultState.retention.completedProjectDays,
    ),
  }
}

const normalizeWeather = (value: unknown): DashboardState['weather'] => {
  if (!isPlainObject(value)) return defaultState.weather

  const numberOrUndefined = (input: unknown) =>
    typeof input === 'number' && Number.isFinite(input) ? input : undefined

  return {
    icon: textValue(value.icon, defaultState.weather.icon),
    temp: textValue(value.temp, defaultState.weather.temp),
    label: textValue(value.label, defaultState.weather.label),
    condition: textValue(value.condition) || undefined,
    humidity: textValue(value.humidity) || undefined,
    latitude: numberOrUndefined(value.latitude),
    longitude: numberOrUndefined(value.longitude),
    updatedAt: textValue(value.updatedAt) || undefined,
  }
}

/* -------------------------------------------------------------------------- */
/* 顶层规范化                                                                  */
/* -------------------------------------------------------------------------- */

export type NormalizeOptions = {
  /** 当前内存中的状态，用于在导入备份时保留本机已有的字段。 */
  currentState?: DashboardState
  /** 导入备份时保留本机 API Key（备份文件里本来就不含 Key）。 */
  preserveAiKey?: boolean
}

export const normalizeDashboardState = (
  input: StoredDashboardState | null | undefined,
  options: NormalizeOptions = {},
): DashboardState => {
  const parsed = isPlainObject(input) ? (input as StoredDashboardState) : {}
  const now = Date.now()

  const quotes = normalizeQuotes(parsed)
  const retention = normalizeRetention(parsed.retention)

  // 归档与已结项项目在读取时就按保留策略清理一次，避免过期数据一直躺在本地。
  const retained = applyRetentionPolicy(
    normalizeArchives(parsed.archives),
    normalizeProjects(parsed.projects),
    retention,
    now,
  )

  const provider = validAiProviders.has(parsed.ai?.provider as AiProvider)
    ? (parsed.ai?.provider as AiProvider)
    : defaultState.ai.provider
  const aiDefaults = aiProviderDefaults[provider]
  const apiKey = options.preserveAiKey
    ? (options.currentState?.ai.apiKey ?? defaultState.ai.apiKey)
    : textValue(parsed.ai?.apiKey)

  const tasks = normalizeTasks(parsed.tasks)
  const restoredFocus = restoreFocusSession(parsed, retained.projects, tasks, now)

  return {
    quotePoolVersion: quotes.quotePoolVersion,
    quotePool: quotes.quotePool,
    dailyQuote: quotes.dailyQuote,
    // 早期版本没有独立的搬运日期，退化到当天名言的日期。
    dailyCarryoverDate: isLocalDateString(parsed.dailyCarryoverDate)
      ? parsed.dailyCarryoverDate
      : isLocalDateString(parsed.dailyQuote?.date)
        ? parsed.dailyQuote.date
        : todayIso(),
    // 旧的单条座右铭已经并入名言池，这里显式丢弃，避免下次启动重复迁移。
    motto: undefined,
    theme: validThemes.has(parsed.theme as Theme)
      ? (parsed.theme as Theme)
      : defaultState.theme,
    dayMode: validDayModes.has(parsed.dayMode as DayMode)
      ? (parsed.dayMode as DayMode)
      : defaultState.dayMode,
    energy: clampedNumber(parsed.energy, ENERGY_MIN, ENERGY_MAX, defaultState.energy),
    weather: normalizeWeather(parsed.weather),
    // 上一轮在离线期间跑完了，就不要再显示那个早已结束的目标。
    currentFocus: restoredFocus.expired
      ? IDLE_FOCUS_LABEL
      : textValue(parsed.currentFocus, defaultState.currentFocus),
    tasks: restoredFocus.tasks,
    tomorrowTasks: normalizeTasks(parsed.tomorrowTasks, []),
    projects: restoredFocus.projects,
    quickLinks: normalizeQuickLinks(parsed.quickLinks),
    inbox: normalizeInbox(parsed.inbox),
    reminders: normalizeReminders(parsed.reminders),
    review: {
      did: textValue(parsed.review?.did),
      stuck: textValue(parsed.review?.stuck),
      tomorrow: textValue(parsed.review?.tomorrow),
    },
    reviewSummary: textValue(parsed.reviewSummary),
    ai: {
      enabled: booleanValue(parsed.ai?.enabled),
      provider,
      apiKey,
      baseUrl: textValue(parsed.ai?.baseUrl, aiDefaults.baseUrl),
      model: textValue(parsed.ai?.model, aiDefaults.model),
    },
    retention,
    archives: retained.archives,
    focus: restoredFocus.focus,
  }
}

/**
 * 恢复专注会话，并补记上次退出时没结算的那一段时间。
 *
 * 两条关键决策：
 * 1. **永远以"未运行"状态恢复**。应用没开着的时候用户显然没在专注，
 *    继续跑会凭空多记时长；running/endsAt/startedAt 一律清空。
 * 2. **但时间确实流逝了**。如果退出时正在计时，`startedAt`→`min(now, endsAt)`
 *    这一段是真实发生过的，要补记到对应项目与任务上，否则关一次应用就丢一次记录。
 *
 * 同时校验项目/任务是否还存在，避免指向已删除的实体。
 */
const restoreFocusSession = (
  parsed: StoredDashboardState,
  projects: Project[],
  tasks: Task[],
  now: number,
) => {
  const durationMinutes = clampedNumber(
    parsed.focus?.durationMinutes,
    FOCUS_MINUTES_MIN,
    FOCUS_MINUTES_MAX,
    defaultState.focus.durationMinutes,
  )

  const projectIds = new Set(projects.map((project) => project.id))
  const taskIds = new Set(tasks.map((task) => task.id))
  const storedProjectId = textValue(parsed.focus?.projectId)
  const storedTaskId = textValue(parsed.focus?.taskId)
  const projectId = projectIds.has(storedProjectId) ? storedProjectId : ''
  const taskId = taskIds.has(storedTaskId) ? storedTaskId : ''

  const recovery = recoverOfflineFocus(
    {
      running: booleanValue(parsed.focus?.running),
      startedAt: textValue(parsed.focus?.startedAt),
      endsAt: textValue(parsed.focus?.endsAt),
    },
    durationMinutes,
    now,
  )

  const shouldSettle = recovery.offlineSeconds > 0
  const focus: DashboardState['focus'] = {
    running: false,
    durationMinutes,
    secondsLeft: recovery.wasRunning
      ? recovery.secondsLeft
      : clampedNumber(parsed.focus?.secondsLeft, 0, durationMinutes * 60, durationMinutes * 60),
    projectId,
    // 这一轮已经结束了，本轮目标和关联待办都该清掉。
    taskLabel: recovery.expired ? '' : textValue(parsed.focus?.taskLabel),
    taskId: recovery.expired ? '' : taskId,
    endsAt: undefined,
    startedAt: undefined,
  }

  return {
    focus,
    expired: recovery.expired,
    projects:
      shouldSettle && projectId
        ? projects.map((project) =>
            project.id === projectId
              ? addFocusSecondsToProject(project, recovery.offlineSeconds)
              : project,
          )
        : projects,
    tasks:
      shouldSettle && taskId
        ? tasks.map((task) =>
            task.id === taskId ? addFocusSecondsToTask(task, recovery.offlineSeconds) : task,
          )
        : tasks,
  }
}
