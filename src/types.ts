/**
 * 全应用共享的数据结构。
 *
 * 约定：
 * - 这里只放"跨模块传递"的类型；只在单个组件内部使用的类型就地定义即可。
 * - 所有日期字段有两种形态，命名上刻意区分：
 *   · `date` / `dailyCarryoverDate`：本地日历日，形如 `2026-07-26`（见 utils.formatLocalDate）；
 *   · `createdAt` / `completedAt` / `endsAt` / `startedAt`：完整 ISO 时间戳。
 * - 带 `?` 的字段多半是"历史数据里可能没有"，读取时要走 state/normalize.ts 兜底。
 */
import type { ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/* 基础枚举                                                                    */
/* -------------------------------------------------------------------------- */

export type Theme = 'dark' | 'clean' | 'cyber' | 'paper'
export type DayMode = '工作日' | '周末' | '冲刺' | '摸鱼恢复'
export type TaskKind = 'top' | 'todo'
export type AiProvider = 'openai' | 'deepseek' | 'moonshot' | 'custom'

/** 三个主视图：聚焦（开工）→ 推进（执行）→ 复盘（收工）。 */
export type MainView = 'start' | 'execute' | 'review'

/** 列表内上移 / 下移。 */
export type OrderDirection = 'up' | 'down'

/* -------------------------------------------------------------------------- */
/* 任务与项目                                                                  */
/* -------------------------------------------------------------------------- */

export type Task = {
  id: string
  title: string
  done: boolean
  /** top = 今日 Top 3，todo = 普通待办。 */
  kind: TaskKind
  /** 通过"关联待办"记录到这条任务上的累计专注秒数。 */
  focusSeconds?: number
  /** 0-100，步进 10；勾选完成时会被拉满到 100。 */
  progress?: number
}

export type Project = {
  id: string
  name: string
  nextAction: string
  /** 由 focusSeconds 换算出的展示用分钟数，两者需同步更新。 */
  minutes: number
  focusSeconds: number
  /** false 表示已结项；已结项项目会按保留策略自动清理。 */
  active: boolean
  /** 结项时间（ISO），仅已结项项目有值。 */
  completedAt?: string
  progress?: number
}

/* -------------------------------------------------------------------------- */
/* 快捷入口 / 灵感 / 提醒                                                      */
/* -------------------------------------------------------------------------- */

export type QuickLink = {
  id: string
  label: string
  /** 只接受 http/https，存入前会经过 utils.normalizeHttpUrl。 */
  url: string
  /** 对应 config/options.tsx 中 linkIconRegistry 的键。 */
  icon: string
}

export type InboxItem = {
  id: string
  text: string
  createdAt: string
}

export type Reminder = {
  id: string
  title: string
  /** 本地日历日 `YYYY-MM-DD`。 */
  date: string
  type: string
}

/* -------------------------------------------------------------------------- */
/* 复盘与归档                                                                  */
/* -------------------------------------------------------------------------- */

export type DailyReview = {
  did: string
  stuck: string
  tomorrow: string
}

export type DailyArchive = {
  id: string
  /** 归档所属的本地日历日，同一天重复归档会覆盖。 */
  date: string
  createdAt: string
  completedTasks: Task[]
  openTasks: Task[]
  tomorrowTasks: Task[]
  inbox: InboxItem[]
  review: DailyReview
  summary: string
  totalFocusMinutes: number
}

/* -------------------------------------------------------------------------- */
/* 通用 UI                                                                     */
/* -------------------------------------------------------------------------- */

/** ThemedSelect 的下拉项。 */
export type SelectOption = {
  value: string
  label: string
  icon?: ReactNode
}

/* -------------------------------------------------------------------------- */
/* 天气                                                                        */
/* -------------------------------------------------------------------------- */

export type Weather = {
  /** emoji 兜底图标，找不到对应矢量图标时直接显示它。 */
  icon: string
  temp: string
  label: string
  condition?: string
  humidity?: string
  /** 有经纬度表示用户固定了城市，刷新时不再重新定位。 */
  latitude?: number
  longitude?: number
  updatedAt?: string
}

export type WeatherPosition = {
  latitude: number
  longitude: number
  label?: string
}

export type WeatherIconName =
  | 'sun'
  | 'cloud-sun'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'sun-rain'
  | 'snow'
  | 'storm'

/* -------------------------------------------------------------------------- */
/* 每日名言                                                                    */
/* -------------------------------------------------------------------------- */

export type Quote = {
  id: string
  text: string
  author: string
  /** 停用的名言留在池子里但不会被抽中。 */
  enabled: boolean
}

export type DailyQuote = {
  date: string
  quoteId: string
}

/* -------------------------------------------------------------------------- */
/* 专注会话                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 专注计时器状态。
 *
 * 关键设计：运行中的剩余时间**不靠每秒自减**，而是由 `endsAt` 与当前时间推算，
 * 这样窗口被挂起 / 休眠唤醒后时间依然准确。`secondsLeft` 只是给 UI 读的缓存值。
 * `startedAt` 用来结算"这一段实际专注了多久"。
 */
export type FocusSession = {
  running: boolean
  secondsLeft: number
  durationMinutes: number
  /** 本轮专注计入的项目 id；为空表示还没绑定项目。 */
  projectId: string
  /** 本轮目标的展示文案。 */
  taskLabel: string
  /** 可选：把专注时长同时记到某条今日待办上。 */
  taskId?: string
  endsAt?: string
  startedAt?: string
}

/* -------------------------------------------------------------------------- */
/* 设置                                                                        */
/* -------------------------------------------------------------------------- */

export type AiSettings = {
  enabled: boolean
  provider: AiProvider
  /** 只保存在本机 localStorage，导出备份时会被清空。 */
  apiKey: string
  baseUrl: string
  model: string
}

export type RetentionSettings = {
  /** 0 表示永久保留。 */
  reviewArchiveDays: number
  completedProjectDays: number
}

export type GlobalShortcutSettings = {
  enabled: boolean
  accelerator: string
}

export type GlobalShortcutStatus = GlobalShortcutSettings & {
  registered: boolean
  message: string
}

export type DesktopSettings = {
  closeBehavior: 'ask' | 'tray' | 'quit'
  globalShortcut: GlobalShortcutSettings
}

export type AiSummaryRequest = {
  apiKey: string
  baseUrl: string
  model: string
  prompt: string
}

export type AiSummaryResponse = {
  content: string
}

/* -------------------------------------------------------------------------- */
/* 顶层状态                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 整个仪表盘的状态树，会被整体序列化进 localStorage。
 * 新增字段时务必同步更新 state/normalize.ts，否则老用户读不到默认值。
 */
export type DashboardState = {
  /** 早期版本的单条座右铭，已迁移进名言池，仅保留用于读取旧数据。 */
  motto?: string
  quotePoolVersion: number
  quotePool: Quote[]
  dailyQuote: DailyQuote
  /** 上一次把"明日任务"带入今日的日期，用于跨天只搬一次。 */
  dailyCarryoverDate: string
  theme: Theme
  dayMode: DayMode
  energy: number
  weather: Weather
  currentFocus: string
  tasks: Task[]
  tomorrowTasks: Task[]
  projects: Project[]
  quickLinks: QuickLink[]
  inbox: InboxItem[]
  reminders: Reminder[]
  review: DailyReview
  reviewSummary: string
  ai: AiSettings
  retention: RetentionSettings
  archives: DailyArchive[]
  focus: FocusSession
}

/** 从 localStorage / 备份文件读到的、尚未规范化的状态。 */
export type StoredDashboardState = Partial<DashboardState> & {
  motto?: string
}

export type DashboardBackup = {
  app: 'Personal Command Deck'
  version: 1
  exportedAt: string
  state: DashboardState
}
