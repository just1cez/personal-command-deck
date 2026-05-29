import {
  CalendarClock,
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
  DailyQuote,
  AiProvider,
  DashboardState,
  DayMode,
  Quote,
  StoredDashboardState,
} from './types'
import { dateAfter, todayIso, uid } from './utils'

export const STORAGE_KEY = 'personal-command-dashboard-v1'
export const QUOTE_POOL_VERSION = 2

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
    id: 'quote-confucius-mountain',
    text: '移山的人，是从搬走小石头开始的。',
    author: 'Confucius',
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
          .map((quote) => ({
            ...quote,
            id: quote.id || uid(),
            text: quote.text?.trim() ?? '',
            author: quote.author?.trim() ?? '',
            enabled: quote.enabled !== false,
          }))
          .filter((quote) => quote.text && quote.author)
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
  projects: [
    {
      id: uid(),
      name: '个人指挥台',
      nextAction: '把常用入口和今日面板调顺手',
      minutes: 0,
      active: true,
    },
    {
      id: uid(),
      name: '健身',
      nextAction: '安排下一次 30 分钟力量训练',
      minutes: 0,
      active: true,
    },
    {
      id: uid(),
      name: '写作',
      nextAction: '写一段关于本周状态的短笔记',
      minutes: 0,
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
  { value: 'doc', label: 'Docs', icon: <Pencil size={15} /> },
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

export function loadState(): DashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as StoredDashboardState
    const quotes = normalizeQuotes(parsed)
    return {
      ...defaultState,
      ...parsed,
      motto: undefined,
      ...quotes,
      weather: { ...defaultState.weather, ...parsed.weather },
      focus: { ...defaultState.focus, ...parsed.focus, running: false },
      review: { ...defaultState.review, ...parsed.review },
      ai: { ...defaultState.ai, ...parsed.ai },
      tasks: parsed.tasks?.length ? parsed.tasks : defaultState.tasks,
      projects: parsed.projects?.length ? parsed.projects : defaultState.projects,
      quickLinks: parsed.quickLinks?.length
        ? parsed.quickLinks
        : defaultState.quickLinks,
      reminders: parsed.reminders?.length ? parsed.reminders : defaultState.reminders,
      inbox: parsed.inbox ?? defaultState.inbox,
      archives: parsed.archives ?? defaultState.archives,
      reviewSummary: parsed.reviewSummary ?? defaultState.reviewSummary,
    }
  } catch {
    return defaultState
  }
}
