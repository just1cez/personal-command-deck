import {
  CalendarClock,
  FileText,
  Flame,
  Gauge,
  Globe2,
  Link,
  Mail,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'
import type {
  AiProvider,
  DailyArchive,
  DailyQuote,
  DashboardState,
  DayMode,
  InboxItem,
  Project,
  QuickLink,
  Quote,
  Reminder,
  StoredDashboardState,
  Task,
  Theme,
} from './types'
import { dateAfter, formatLocalDate, normalizeHttpUrl, todayIso, uid } from './utils'

export const STORAGE_KEY = 'personal-command-dashboard-v1'
export const QUOTE_POOL_VERSION = 4

const retiredDefaultQuoteIds = new Set(['quote-confucius-mountain'])

export const defaultQuotes: Quote[] = [
  {
    id: 'quote-turing-short-road',
    text: '我们只能看见前方很短的一段路，但能看见那里有许多事要做。',
    author: 'Alan Turing',
    enabled: true,
  },
  {
    id: 'quote-drucker-future',
    text: '预测未来最好的方法，就是把它创造出来。',
    author: 'Peter Drucker',
    enabled: true,
  },
  {
    id: 'quote-mlk-staircase',
    text: '你不需要看完整个楼梯，只要踏出第一步。',
    author: 'Martin Luther King Jr.',
    enabled: true,
  },
  {
    id: 'quote-clarke-magic',
    text: '任何足够先进的技术，都与魔法无异。',
    author: 'Arthur C. Clarke',
    enabled: true,
  },
  {
    id: 'quote-einstein-explain',
    text: '如果你不能把它解释清楚，你就还没有真正理解它。',
    author: 'Albert Einstein',
    enabled: true,
  },
  {
    id: 'quote-edison-failure',
    text: '我没有失败。我只是发现了一万种行不通的方法。',
    author: 'Thomas Edison',
    enabled: true,
  },
  {
    id: 'quote-edison-genius',
    text: '天才是百分之一的灵感，加上百分之九十九的汗水。',
    author: 'Thomas Edison',
    enabled: true,
  },
  {
    id: 'quote-luce-simplicity',
    text: '简单是复杂的最终形态。',
    author: 'Clare Boothe Luce',
    enabled: true,
  },
  {
    id: 'quote-kierkegaard-life',
    text: '生活只能向后理解，但必须向前生活。',
    author: 'Søren Kierkegaard',
    enabled: true,
  },
  {
    id: 'quote-einstein-question',
    text: '重要的不是停止提问。',
    author: 'Albert Einstein',
    enabled: true,
  },
  {
    id: 'quote-pasteur-chance',
    text: '机会总是留给有准备的人。',
    author: 'Louis Pasteur',
    enabled: true,
  },
  {
    id: 'quote-socrates-ignorance',
    text: '知道自己无知，才是真正的知识。',
    author: 'Socrates',
    enabled: true,
  },
  {
    id: 'quote-maya-angelou-courage',
    text: '勇气是所有美德中最重要的，因为没有勇气，你无法持续实践其他任何美德。',
    author: 'Maya Angelou',
    enabled: true,
  },
  {
    id: 'quote-deck-small-step',
    text: '先推进能落地的一小步。',
    author: 'Personal Command Deck',
    enabled: true,
  },
]

export const fallbackQuote: Quote = {
  id: 'quote-fallback',
  text: '先做最重要的那一步。',
  author: 'Custom',
  enabled: true,
}

export const pickQuoteId = (quotes: Quote[], excludedId?: string) => {
  const enabledQuotes = quotes.filter((quote) => quote.enabled)
  if (!enabledQuotes.length) return fallbackQuote.id
  const candidates = enabledQuotes.filter((quote) => quote.id !== excludedId)
  const pool = candidates.length ? candidates : enabledQuotes
  return pool[Math.floor(Math.random() * pool.length)].id
}

export const getQuoteById = (quotes: Quote[], quoteId: string) =>
  quotes.find((quote) => quote.id === quoteId && quote.enabled)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const textValue = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const trimmedText = (value: unknown, fallback = '') => textValue(value, fallback).trim()

const booleanValue = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

const isIsoDateTime = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const time = new Date(value).getTime()
  return Number.isFinite(time)
}

const isLocalDateString = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return formatLocalDate(date) === value
}

export const resolveDailyQuote = (
  quotePool: Quote[],
  dailyQuote?: Partial<DailyQuote>,
): DailyQuote => {
  const today = todayIso()
  if (
    dailyQuote?.date === today &&
    dailyQuote.quoteId &&
    getQuoteById(quotePool, dailyQuote.quoteId)
  ) {
    return { date: today, quoteId: dailyQuote.quoteId }
  }

  return { date: today, quoteId: pickQuoteId(quotePool) }
}

export const normalizeQuotes = (parsed: StoredDashboardState) => {
  const quotePool =
    Array.isArray(parsed.quotePool)
      ? parsed.quotePool
          .map((quote) => {
            const item: Record<string, unknown> = isPlainObject(quote) ? quote : {}
            return {
              id: trimmedText(item.id) || uid(),
              text: trimmedText(item.text),
              author: trimmedText(item.author),
              enabled: item.enabled !== false,
            }
          })
          .filter(
            (quote) =>
              quote.text &&
              quote.author &&
              !retiredDefaultQuoteIds.has(quote.id),
          )
      : defaultQuotes

  const existingQuoteIds = new Set(quotePool.map((quote) => quote.id))
  const upgradedQuotePool =
    (parsed.quotePoolVersion ?? 1) < QUOTE_POOL_VERSION
      ? [
          ...quotePool,
          ...defaultQuotes.filter((quote) => !existingQuoteIds.has(quote.id)),
        ]
      : quotePool

  const legacyMotto = parsed.motto?.trim()
  const migratedQuotePool =
    legacyMotto && !upgradedQuotePool.some((quote) => quote.text === legacyMotto)
      ? [
          ...upgradedQuotePool,
          {
            id: uid(),
            text: legacyMotto,
            author: 'Custom',
            enabled: true,
          },
        ]
      : upgradedQuotePool

  return {
    quotePoolVersion: QUOTE_POOL_VERSION,
    quotePool: migratedQuotePool,
    dailyQuote: resolveDailyQuote(migratedQuotePool, parsed.dailyQuote),
  }
}

export const defaultState: DashboardState = {
  quotePoolVersion: QUOTE_POOL_VERSION,
  quotePool: defaultQuotes,
  dailyQuote: { date: todayIso(), quoteId: pickQuoteId(defaultQuotes) },
  theme: 'dark',
  dayMode: '工作日',
  energy: 4,
  weather: {
    icon: '☀',
    temp: '27°',
    label: 'Hong Kong',
    condition: '手动天气',
  },
  currentFocus: '个人指挥台 MVP',
  tasks: [
    { id: uid(), title: '确定今天最重要的一个推进点', done: false, kind: 'top' },
    { id: uid(), title: '完成个人指挥台本地版主界面', done: false, kind: 'top' },
    { id: uid(), title: '睡前写 3 分钟复盘', done: false, kind: 'top' },
    { id: uid(), title: '整理下载文件夹', done: false, kind: 'todo' },
    { id: uid(), title: '回复两封需要处理的邮件', done: true, kind: 'todo' },
  ],
  tomorrowTasks: [
    { id: uid(), title: '打开聚焦页，确认第一轮要推进什么', done: false, kind: 'top' },
  ],
  projects: [
    {
      id: uid(),
      name: '个人指挥台',
      nextAction: '把常用入口和今日面板调顺手',
      minutes: 0,
      focusSeconds: 0,
      active: true,
    },
    {
      id: uid(),
      name: '健身',
      nextAction: '安排下一次 30 分钟力量训练',
      minutes: 0,
      focusSeconds: 0,
      active: true,
    },
    {
      id: uid(),
      name: '写作',
      nextAction: '写一段关于本周状态的短笔记',
      minutes: 0,
      focusSeconds: 0,
      active: true,
    },
  ],
  quickLinks: [
    { id: uid(), label: 'GitHub', url: 'https://github.com', icon: 'github' },
    { id: uid(), label: 'ChatGPT', url: 'https://chat.openai.com', icon: 'sparkles' },
    { id: uid(), label: 'Gemini', url: 'https://gemini.google.com', icon: 'zap' },
    { id: uid(), label: 'Mail', url: 'https://mail.google.com', icon: 'mail' },
    { id: uid(), label: 'Calendar', url: 'https://calendar.google.com', icon: 'calendar' },
    { id: uid(), label: 'Docs', url: 'https://docs.google.com', icon: 'doc' },
  ],
  inbox: [
    {
      id: uid(),
      text: '做个自动整理截图的小工具',
      createdAt: new Date().toISOString(),
    },
  ],
  reminders: [
    { id: uid(), title: '信用卡账单', date: dateAfter(5), type: '账单' },
    { id: uid(), title: '妈妈生日', date: dateAfter(19), type: '生日' },
    { id: uid(), title: 'Side Project 里程碑', date: dateAfter(12), type: 'Deadline' },
  ],
  review: {
    did: '',
    stuck: '',
    tomorrow: '',
  },
  reviewSummary: '',
  ai: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  retention: {
    reviewArchiveDays: 0,
    completedProjectDays: 0,
  },
  archives: [],
  focus: {
    running: false,
    secondsLeft: 25 * 60,
    durationMinutes: 25,
    projectId: '',
    taskLabel: '',
  },
}

export const dayModeOptions = [
  { value: '工作日' as DayMode, label: '工作日', icon: <Gauge size={15} /> },
  { value: '周末' as DayMode, label: '周末', icon: <Sun size={15} /> },
  { value: '冲刺' as DayMode, label: '冲刺', icon: <Flame size={15} /> },
  { value: '摸鱼恢复' as DayMode, label: '恢复', icon: <Moon size={15} /> },
]

export const themeOptions = [
  { value: 'dark', label: '深色', icon: <Moon size={15} /> },
  { value: 'clean', label: '清爽', icon: <Sun size={15} /> },
  { value: 'cyber', label: '赛博朋克', icon: <Zap size={15} /> },
  { value: 'paper', label: '纸质笔记', icon: <Pencil size={15} /> },
]

export const linkIconOptions = [
  { value: 'link', label: 'Link', icon: <Link size={15} /> },
  { value: 'github', label: 'GitHub', icon: <Globe2 size={15} /> },
  { value: 'sparkles', label: 'AI', icon: <Sparkles size={15} /> },
  { value: 'zap', label: 'Zap', icon: <Zap size={15} /> },
  { value: 'mail', label: 'Mail', icon: <Mail size={15} /> },
  { value: 'calendar', label: 'Calendar', icon: <CalendarClock size={15} /> },
  { value: 'doc', label: 'Docs', icon: <FileText size={15} /> },
]

export const aiProviderOptions = [
  { value: 'openai' as AiProvider, label: 'OpenAI', icon: <Sparkles size={15} /> },
  { value: 'deepseek' as AiProvider, label: 'DeepSeek', icon: <Zap size={15} /> },
  { value: 'moonshot' as AiProvider, label: 'Moonshot', icon: <Moon size={15} /> },
  { value: 'custom' as AiProvider, label: '自定义', icon: <Globe2 size={15} /> },
]

export const aiProviderDefaults: Record<AiProvider, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
}

const validThemes = new Set<Theme>(['dark', 'clean', 'cyber', 'paper'])
const validDayModes = new Set<DayMode>(['工作日', '周末', '冲刺', '摸鱼恢复'])
const validProviders = new Set<AiProvider>(['openai', 'deepseek', 'moonshot', 'custom'])
const validLinkIcons = new Set(linkIconOptions.map((option) => option.value))

const normalizeTasks = (value: unknown, fallback = defaultState.tasks): Task[] => {
  if (!Array.isArray(value)) return fallback
  const tasks = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const title = trimmedText(item.title)
      const kind = item.kind === 'top' || item.kind === 'todo' ? item.kind : 'todo'
      if (!title) return null
      return {
        id: trimmedText(item.id) || uid(),
        title,
        done: booleanValue(item.done),
        kind,
      }
    })
    .filter((task): task is Task => Boolean(task))
  return tasks.length ? tasks : fallback
}

const normalizeProjects = (value: unknown): Project[] => {
  if (!Array.isArray(value)) return defaultState.projects
  const projects = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const name = trimmedText(item.name)
      if (!name) return null
      const active = item.active !== false
      const project: Project = {
        id: trimmedText(item.id) || uid(),
        name,
        nextAction: trimmedText(item.nextAction),
        minutes: clampNumber(item.minutes, 0, 100_000, 0),
        focusSeconds: clampNumber(
          item.focusSeconds,
          0,
          100_000 * 60,
          clampNumber(item.minutes, 0, 100_000, 0) * 60,
        ),
        active,
      }
      if (!active) {
        project.completedAt = isIsoDateTime(item.completedAt)
          ? item.completedAt
          : new Date().toISOString()
      }
      return project
    })
    .filter((project): project is Project => Boolean(project))
  return projects.length ? projects : defaultState.projects
}

const normalizeQuickLinks = (value: unknown): QuickLink[] => {
  if (!Array.isArray(value)) return defaultState.quickLinks
  const links = value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const label = trimmedText(item.label)
      const url = normalizeHttpUrl(textValue(item.url))
      const icon = trimmedText(item.icon, 'link')
      if (!label || !url) return null
      return {
        id: trimmedText(item.id) || uid(),
        label,
        url,
        icon: validLinkIcons.has(icon) ? icon : 'link',
      }
    })
    .filter((link): link is QuickLink => Boolean(link))
  return links.length ? links : defaultState.quickLinks
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
        date: isLocalDateString(item.date) ? item.date : dateAfter(7),
        type: trimmedText(item.type, 'Deadline') || 'Deadline',
      }
    })
    .filter((reminder): reminder is Reminder => Boolean(reminder))
  return reminders.length ? reminders : defaultState.reminders
}

const normalizeArchives = (value: unknown): DailyArchive[] => {
  if (!Array.isArray(value)) return defaultState.archives
  return value
    .map((item) => {
      if (!isPlainObject(item)) return null
      const date = isLocalDateString(item.date) ? item.date : todayIso()
      return {
        id: trimmedText(item.id) || uid(),
        date,
        createdAt: textValue(item.createdAt, new Date().toISOString()),
        completedTasks: normalizeTasks(item.completedTasks, []).filter((task) => task.done),
        openTasks: normalizeTasks(item.openTasks, []).filter((task) => !task.done),
        tomorrowTasks: normalizeTasks(item.tomorrowTasks, []),
        inbox: normalizeInbox(item.inbox, []),
        review: {
          did: isPlainObject(item.review) ? textValue(item.review.did) : '',
          stuck: isPlainObject(item.review) ? textValue(item.review.stuck) : '',
          tomorrow: isPlainObject(item.review) ? textValue(item.review.tomorrow) : '',
        },
        summary: textValue(item.summary),
        totalFocusMinutes: clampNumber(item.totalFocusMinutes, 0, 100_000, 0),
      }
    })
    .filter((archive): archive is DailyArchive => Boolean(archive))
    .slice(0, 60)
}

const normalizeRetention = (value: unknown): DashboardState['retention'] => {
  const parsed = isPlainObject(value) ? value : {}
  return {
    reviewArchiveDays: clampNumber(
      parsed.reviewArchiveDays,
      0,
      3650,
      defaultState.retention.reviewArchiveDays,
    ),
    completedProjectDays: clampNumber(
      parsed.completedProjectDays,
      0,
      3650,
      defaultState.retention.completedProjectDays,
    ),
  }
}

const isWithinRetention = (
  isoDateTime: string | undefined,
  days: number,
  now = Date.now(),
) => {
  if (days <= 0) return true
  const time = isoDateTime ? new Date(isoDateTime).getTime() : NaN
  if (!Number.isFinite(time)) return true
  return now - time <= days * 86_400_000
}

const normalizeWeather = (value: unknown): DashboardState['weather'] => {
  if (!isPlainObject(value)) return defaultState.weather
  return {
    icon: textValue(value.icon, defaultState.weather.icon),
    temp: textValue(value.temp, defaultState.weather.temp),
    label: textValue(value.label, defaultState.weather.label),
    condition: textValue(value.condition) || undefined,
    humidity: textValue(value.humidity) || undefined,
    latitude:
      typeof value.latitude === 'number' && Number.isFinite(value.latitude)
        ? value.latitude
        : undefined,
    longitude:
      typeof value.longitude === 'number' && Number.isFinite(value.longitude)
        ? value.longitude
        : undefined,
    updatedAt: textValue(value.updatedAt) || undefined,
  }
}

export const normalizeDashboardState = (
  input: StoredDashboardState | null | undefined,
  options: { currentState?: DashboardState; preserveAiKey?: boolean } = {},
): DashboardState => {
  const parsed = isPlainObject(input) ? (input as StoredDashboardState) : {}
  const quotes = normalizeQuotes(parsed)
  const projects = normalizeProjects(parsed.projects)
  const durationMinutes = clampNumber(
    parsed.focus?.durationMinutes,
    5,
    120,
    defaultState.focus.durationMinutes,
  )
  const provider = validProviders.has(parsed.ai?.provider as AiProvider)
    ? (parsed.ai?.provider as AiProvider)
    : defaultState.ai.provider
  const aiDefaults = aiProviderDefaults[provider]
  const apiKey = options.preserveAiKey
    ? (options.currentState?.ai.apiKey ?? defaultState.ai.apiKey)
    : textValue(parsed.ai?.apiKey)
  const retention = normalizeRetention(parsed.retention)
  const now = Date.now()
  const archives = normalizeArchives(parsed.archives).filter((archive) =>
    isWithinRetention(archive.createdAt, retention.reviewArchiveDays, now),
  )
  const retainedProjects = projects.filter(
    (project) =>
      project.active !== false ||
      isWithinRetention(project.completedAt, retention.completedProjectDays, now),
  )
  const projectIds = new Set(retainedProjects.map((project) => project.id))

  return {
    quotePoolVersion: quotes.quotePoolVersion,
    quotePool: quotes.quotePool,
    dailyQuote: quotes.dailyQuote,
    motto: undefined,
    theme: validThemes.has(parsed.theme as Theme)
      ? (parsed.theme as Theme)
      : defaultState.theme,
    dayMode: validDayModes.has(parsed.dayMode as DayMode)
      ? (parsed.dayMode as DayMode)
      : defaultState.dayMode,
    energy: clampNumber(parsed.energy, 1, 5, defaultState.energy),
    weather: normalizeWeather(parsed.weather),
    currentFocus: textValue(parsed.currentFocus, defaultState.currentFocus),
    tasks: normalizeTasks(parsed.tasks),
    tomorrowTasks: normalizeTasks(parsed.tomorrowTasks, []),
    projects: retainedProjects,
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
    archives,
    focus: {
      running: false,
      durationMinutes,
      secondsLeft: clampNumber(
        parsed.focus?.secondsLeft,
        0,
        durationMinutes * 60,
        durationMinutes * 60,
      ),
      projectId:
        textValue(parsed.focus?.projectId) && projectIds.has(textValue(parsed.focus?.projectId))
          ? textValue(parsed.focus?.projectId)
          : '',
      taskLabel: textValue(parsed.focus?.taskLabel),
      endsAt: undefined,
      startedAt: undefined,
    },
  }
}

export const createBackupState = (dashboard: DashboardState): DashboardState => ({
  ...dashboard,
  focus: { ...dashboard.focus, running: false, endsAt: undefined, startedAt: undefined },
  ai: { ...dashboard.ai, apiKey: '' },
})

export function loadState(): DashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as StoredDashboardState
    return normalizeDashboardState(parsed)
  } catch {
    return defaultState
  }
}
