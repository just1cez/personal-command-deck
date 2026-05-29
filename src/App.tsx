import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BatteryCharging,
  Brain,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Command,
  ExternalLink,
  Flame,
  Focus,
  Gauge,
  Globe2,
  Inbox,
  Link,
  Mail,
  MapPin,
  Moon,
  MoreHorizontal,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  SquareCheckBig,
  Star,
  Sun,
  TimerReset,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import './App.css'

type Theme = 'dark' | 'clean' | 'cyber' | 'paper'
type DayMode = '工作日' | '周末' | '冲刺' | '摸鱼恢复'
type TaskKind = 'top' | 'todo'

type Task = {
  id: string
  title: string
  done: boolean
  kind: TaskKind
}

type Project = {
  id: string
  name: string
  nextAction: string
  minutes: number
  active: boolean
}

type QuickLink = {
  id: string
  label: string
  url: string
  icon: string
}

type InboxItem = {
  id: string
  text: string
  createdAt: string
}

type Reminder = {
  id: string
  title: string
  date: string
  type: string
}

type DailyReview = {
  did: string
  stuck: string
  tomorrow: string
}

type SelectOption = {
  value: string
  label: string
  icon?: React.ReactNode
}

type Weather = {
  icon: string
  temp: string
  label: string
  condition?: string
  humidity?: string
  latitude?: number
  longitude?: number
  updatedAt?: string
}

type WeatherPosition = {
  latitude: number
  longitude: number
  label?: string
}

type Quote = {
  id: string
  text: string
  author: string
  enabled: boolean
}

type DailyQuote = {
  date: string
  quoteId: string
}

type FocusSession = {
  running: boolean
  secondsLeft: number
  durationMinutes: number
  projectId: string
  taskLabel: string
}

type DashboardState = {
  motto?: string
  quotePoolVersion: number
  quotePool: Quote[]
  dailyQuote: DailyQuote
  theme: Theme
  dayMode: DayMode
  energy: number
  weather: Weather
  currentFocus: string
  tasks: Task[]
  projects: Project[]
  quickLinks: QuickLink[]
  inbox: InboxItem[]
  reminders: Reminder[]
  review: DailyReview
  focus: FocusSession
}

type StoredDashboardState = Partial<DashboardState> & {
  motto?: string
}

const STORAGE_KEY = 'personal-command-dashboard-v1'
const QUOTE_POOL_VERSION = 2

const uid = () => crypto.randomUUID()

const todayIso = () => new Date().toISOString().slice(0, 10)

const dateAfter = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const defaultQuotes: Quote[] = [
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

const fallbackQuote: Quote = {
  id: 'quote-fallback',
  text: '先做最重要的那一步。',
  author: 'Custom',
  enabled: true,
}

const pickQuoteId = (quotes: Quote[], excludedId?: string) => {
  const enabledQuotes = quotes.filter((quote) => quote.enabled)
  if (!enabledQuotes.length) return fallbackQuote.id
  const candidates = enabledQuotes.filter((quote) => quote.id !== excludedId)
  const pool = candidates.length ? candidates : enabledQuotes
  return pool[Math.floor(Math.random() * pool.length)].id
}

const getQuoteById = (quotes: Quote[], quoteId: string) =>
  quotes.find((quote) => quote.id === quoteId && quote.enabled)

const resolveDailyQuote = (
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

const normalizeQuotes = (parsed: StoredDashboardState) => {
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

const defaultState: DashboardState = {
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
  focus: {
    running: false,
    secondsLeft: 25 * 60,
    durationMinutes: 25,
    projectId: '',
    taskLabel: '',
  },
}

const dayModeOptions = [
  { value: '工作日' as DayMode, label: '工作日', icon: <Gauge size={15} /> },
  { value: '周末' as DayMode, label: '周末', icon: <Sun size={15} /> },
  { value: '冲刺' as DayMode, label: '冲刺', icon: <Flame size={15} /> },
  { value: '摸鱼恢复' as DayMode, label: '恢复', icon: <Moon size={15} /> },
]

const themeOptions = [
  { value: 'dark', label: '深色', icon: <Moon size={15} /> },
  { value: 'clean', label: '清爽', icon: <Sun size={15} /> },
  { value: 'cyber', label: '赛博朋克', icon: <Zap size={15} /> },
  { value: 'paper', label: '纸质笔记', icon: <Pencil size={15} /> },
]

const linkIconOptions = [
  { value: 'link', label: 'Link', icon: <Link size={15} /> },
  { value: 'github', label: 'GitHub', icon: <Globe2 size={15} /> },
  { value: 'sparkles', label: 'AI', icon: <Sparkles size={15} /> },
  { value: 'zap', label: 'Zap', icon: <Zap size={15} /> },
  { value: 'mail', label: 'Mail', icon: <Mail size={15} /> },
  { value: 'calendar', label: 'Calendar', icon: <CalendarClock size={15} /> },
  { value: 'doc', label: 'Docs', icon: <Pencil size={15} /> },
]

function loadState(): DashboardState {
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
      tasks: parsed.tasks?.length ? parsed.tasks : defaultState.tasks,
      projects: parsed.projects?.length ? parsed.projects : defaultState.projects,
      quickLinks: parsed.quickLinks?.length
        ? parsed.quickLinks
        : defaultState.quickLinks,
      reminders: parsed.reminders?.length ? parsed.reminders : defaultState.reminders,
      inbox: parsed.inbox ?? defaultState.inbox,
    }
  } catch {
    return defaultState
  }
}

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('zh-Hans-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('zh-Hans-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)

const formatMinutes = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const daysUntil = (dateString: string) => {
  const today = new Date(todayIso())
  const target = new Date(dateString)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

const weatherCodeMap: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀', label: '晴' },
  1: { icon: '🌤', label: '大致晴朗' },
  2: { icon: '⛅', label: '局部多云' },
  3: { icon: '☁', label: '阴' },
  45: { icon: '🌫', label: '雾' },
  48: { icon: '🌫', label: '雾凇' },
  51: { icon: '🌦', label: '小毛毛雨' },
  53: { icon: '🌦', label: '毛毛雨' },
  55: { icon: '🌧', label: '大毛毛雨' },
  61: { icon: '🌧', label: '小雨' },
  63: { icon: '🌧', label: '中雨' },
  65: { icon: '🌧', label: '大雨' },
  71: { icon: '🌨', label: '小雪' },
  73: { icon: '🌨', label: '中雪' },
  75: { icon: '❄', label: '大雪' },
  80: { icon: '🌦', label: '阵雨' },
  81: { icon: '🌧', label: '强阵雨' },
  82: { icon: '⛈', label: '暴雨' },
  95: { icon: '⛈', label: '雷暴' },
  96: { icon: '⛈', label: '雷暴冰雹' },
  99: { icon: '⛈', label: '强雷暴冰雹' },
}

const getPosition = () =>
  new Promise<WeatherPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器没有开放定位能力'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      reject,
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 10_000,
      },
    )
  })

const getIpPosition = async () => {
  const response = await fetch('https://ipapi.co/json/')
  if (!response.ok) throw new Error('无法获取当前位置')
  const data = (await response.json()) as {
    latitude?: number
    longitude?: number
    city?: string
    region?: string
  }
  if (data.latitude == null || data.longitude == null) {
    throw new Error('定位数据不完整')
  }
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    label: data.city || data.region,
  }
}

const geocodeCity = async (city: string) => {
  const params = new URLSearchParams({
    name: city,
    count: '1',
    language: 'zh',
    format: 'json',
  })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) throw new Error('城市查询失败')
  const data = (await response.json()) as {
    results?: Array<{
      name: string
      latitude: number
      longitude: number
      country?: string
      admin1?: string
    }>
  }
  const result = data.results?.[0]
  if (!result) throw new Error('没找到这个城市')

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    label: [result.name, result.admin1, result.country].filter(Boolean).slice(0, 2).join(' · '),
  }
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardState>(() => loadState())
  const [now, setNow] = useState(() => new Date())
  const [newTopTask, setNewTopTask] = useState('')
  const [newTodo, setNewTodo] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectAction, setNewProjectAction] = useState('')
  const [newInboxText, setNewInboxText] = useState('')
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkIcon, setNewLinkIcon] = useState('link')
  const [newReminderTitle, setNewReminderTitle] = useState('')
  const [newReminderDate, setNewReminderDate] = useState(dateAfter(7))
  const [newReminderType, setNewReminderType] = useState('Deadline')
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [quoteManagerOpen, setQuoteManagerOpen] = useState(false)
  const [newQuoteText, setNewQuoteText] = useState('')
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('')
  const [editingWeather, setEditingWeather] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState('')
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null)

  const updateDashboard = useCallback((updater: (current: DashboardState) => DashboardState) => {
    setDashboard(updater)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboard))
    document.documentElement.dataset.theme = dashboard.theme
    document.documentElement.dataset.mode = dashboard.dayMode
  }, [dashboard])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!dashboard.focus.running) return
    const interval = window.setInterval(() => {
      setDashboard((current) => {
        if (!current.focus.running) return current
        if (current.focus.secondsLeft <= 1) {
          const minutes = current.focus.durationMinutes
          const projects = current.projects.map((project) =>
            project.id === current.focus.projectId
              ? { ...project, minutes: project.minutes + minutes }
              : project,
          )
          return {
            ...current,
            projects,
            currentFocus: '等待下一次启动',
            focus: {
              ...current.focus,
              running: false,
              secondsLeft: current.focus.durationMinutes * 60,
              taskLabel: '',
            },
          }
        }
        return {
          ...current,
          focus: {
            ...current.focus,
            secondsLeft: current.focus.secondsLeft - 1,
          },
        }
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [dashboard.focus.running])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
      if (event.key === 'Escape') {
        setCommandOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const fetchWeatherForPosition = useCallback(async (position: WeatherPosition) => {
    const { latitude, longitude } = position
    const params = new URLSearchParams({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,weather_code',
      timezone: 'auto',
    })
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    if (!response.ok) throw new Error('天气服务暂时不可用')

    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number
        relative_humidity_2m?: number
        weather_code?: number
      }
      timezone?: string
    }
    const current = data.current
    if (!current || current.temperature_2m == null) {
      throw new Error('天气数据不完整')
    }

    const temperature = current.temperature_2m
    const weatherCode = current.weather_code ?? 0
    const mapped = weatherCodeMap[weatherCode] ?? { icon: '🌡', label: '实时天气' }
    updateDashboard((state) => ({
      ...state,
      weather: {
        icon: mapped.icon,
        temp: `${Math.round(temperature)}°`,
        label:
          position.label ??
          data.timezone?.split('/').pop()?.replaceAll('_', ' ') ??
          '当前位置',
        condition: mapped.label,
        humidity:
          current.relative_humidity_2m == null
            ? undefined
            : `${Math.round(current.relative_humidity_2m)}%`,
        updatedAt: new Date().toISOString(),
        latitude,
        longitude,
      },
    }))
  }, [updateDashboard])

  const refreshWeather = useCallback(async () => {
    setWeatherLoading(true)
    setWeatherError('')

    try {
      const position =
        dashboard.weather.latitude != null && dashboard.weather.longitude != null
          ? {
              latitude: dashboard.weather.latitude,
              longitude: dashboard.weather.longitude,
              label: dashboard.weather.label,
            }
          : await getPosition().catch(() => getIpPosition())
      await fetchWeatherForPosition(position)
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : '天气查询失败')
    } finally {
      setWeatherLoading(false)
    }
  }, [
    dashboard.weather.label,
    dashboard.weather.latitude,
    dashboard.weather.longitude,
    fetchWeatherForPosition,
  ])

  const setWeatherCity = useCallback(async (city: string) => {
    const trimmed = city.trim()
    if (!trimmed) return

    setWeatherLoading(true)
    setWeatherError('')
    try {
      const location = await geocodeCity(trimmed)
      await fetchWeatherForPosition(location)
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : '城市设置失败')
    } finally {
      setWeatherLoading(false)
    }
  }, [fetchWeatherForPosition])

  const topTasks = dashboard.tasks.filter((task) => task.kind === 'top')
  const todos = dashboard.tasks.filter((task) => task.kind === 'todo')
  const completedTasks = dashboard.tasks.filter((task) => task.done).length
  const activeProject = dashboard.projects.find(
    (project) => project.id === dashboard.focus.projectId,
  )
  const completionRate = dashboard.tasks.length
    ? Math.round((completedTasks / dashboard.tasks.length) * 100)
    : 0
  const priorityTask = topTasks.find((task) => !task.done) ?? todos.find((task) => !task.done)
  const suggestedProject =
    activeProject ?? dashboard.projects.find((project) => project.active) ?? dashboard.projects[0]
  const suggestedAction =
    priorityTask?.title ?? suggestedProject?.nextAction ?? '先写下一个可以立刻开始的动作'
  const totalFocusMinutes = dashboard.projects.reduce(
    (total, project) => total + project.minutes,
    0,
  )
  const upcomingReminders = dashboard.reminders
    .slice()
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
  const nextReminder = upcomingReminders[0]
  const urgentReminderCount = upcomingReminders.filter((item) => {
    const days = daysUntil(item.date)
    return days >= 0 && days <= 3
  }).length
  const todaysQuote =
    getQuoteById(dashboard.quotePool, dashboard.dailyQuote.quoteId) ?? fallbackQuote
  const canAddQuote = newQuoteText.trim().length > 0 && newQuoteAuthor.trim().length > 0

  useEffect(() => {
    const interval = window.setInterval(() => {
      updateDashboard((current) => {
        const resolved = resolveDailyQuote(current.quotePool, current.dailyQuote)
        if (
          resolved.date === current.dailyQuote.date &&
          resolved.quoteId === current.dailyQuote.quoteId
        ) {
          return current
        }

        return { ...current, dailyQuote: resolved }
      })
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [updateDashboard])

  const rerollDailyQuote = useCallback(() => {
    updateDashboard((current) => ({
      ...current,
      dailyQuote: {
        date: todayIso(),
        quoteId: pickQuoteId(current.quotePool, current.dailyQuote.quoteId),
      },
    }))
  }, [updateDashboard])

  const addQuote = () => {
    const text = newQuoteText.trim()
    const author = newQuoteAuthor.trim()
    if (!text || !author) return

    const quote: Quote = { id: uid(), text, author, enabled: true }
    updateDashboard((current) => ({
      ...current,
      quotePool: [quote, ...current.quotePool],
      dailyQuote:
        current.dailyQuote.quoteId === fallbackQuote.id
          ? { date: todayIso(), quoteId: quote.id }
          : current.dailyQuote,
    }))
    setNewQuoteText('')
    setNewQuoteAuthor('')
  }

  const updateQuote = (id: string, patch: Partial<Quote>) => {
    const text = patch.text?.trim()
    const author = patch.author?.trim()
    if (patch.text !== undefined && !text) return
    if (patch.author !== undefined && !author) return

    updateDashboard((current) => ({
      ...current,
      quotePool: current.quotePool.map((quote) =>
        quote.id === id
          ? {
              ...quote,
              ...patch,
              text: text ?? quote.text,
              author: author ?? quote.author,
            }
          : quote,
      ),
    }))
  }

  const toggleQuote = (id: string) => {
    updateDashboard((current) => {
      const quotePool = current.quotePool.map((quote) =>
        quote.id === id ? { ...quote, enabled: !quote.enabled } : quote,
      )
      const selectedStillEnabled = getQuoteById(quotePool, current.dailyQuote.quoteId)

      return {
        ...current,
        quotePool,
        dailyQuote: selectedStillEnabled
          ? current.dailyQuote
          : { date: todayIso(), quoteId: pickQuoteId(quotePool, id) },
      }
    })
  }

  const removeQuote = (id: string) => {
    updateDashboard((current) => {
      const quotePool = current.quotePool.filter((quote) => quote.id !== id)
      const selectedStillEnabled = getQuoteById(quotePool, current.dailyQuote.quoteId)

      return {
        ...current,
        quotePool,
        dailyQuote: selectedStillEnabled
          ? current.dailyQuote
          : { date: todayIso(), quoteId: pickQuoteId(quotePool, id) },
      }
    })
  }

  const addTask = (kind: TaskKind) => {
    const title = (kind === 'top' ? newTopTask : newTodo).trim()
    if (!title) return
    if (kind === 'top' && topTasks.length >= 3) return
    updateDashboard((current) => ({
      ...current,
      tasks: [...current.tasks, { id: uid(), title, done: false, kind }],
    }))
    if (kind === 'top') setNewTopTask('')
    else setNewTodo('')
  }

  const toggleTask = useCallback((id: string) => {
    updateDashboard((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }))
  }, [updateDashboard])

  const removeTask = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }))
  }

  const addProject = () => {
    const name = newProjectName.trim()
    const nextAction = newProjectAction.trim()
    if (!name || !nextAction) return
    updateDashboard((current) => ({
      ...current,
      projects: [
        ...current.projects,
        { id: uid(), name, nextAction, minutes: 0, active: true },
      ],
    }))
    setNewProjectName('')
    setNewProjectAction('')
  }

  const updateProject = (id: string, patch: Partial<Project>) => {
    updateDashboard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id ? { ...project, ...patch } : project,
      ),
    }))
  }

  const removeProject = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      focus:
        current.focus.projectId === id
          ? { ...current.focus, projectId: '', running: false }
          : current.focus,
    }))
  }

  const addInboxItem = () => {
    const text = newInboxText.trim()
    if (!text) return
    updateDashboard((current) => ({
      ...current,
      inbox: [{ id: uid(), text, createdAt: new Date().toISOString() }, ...current.inbox],
    }))
    setNewInboxText('')
  }

  const removeInboxItem = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      inbox: current.inbox.filter((item) => item.id !== id),
    }))
  }

  const addQuickLink = () => {
    const label = newLinkLabel.trim()
    const url = newLinkUrl.trim()
    if (!label || !url) return
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`
    updateDashboard((current) => ({
      ...current,
      quickLinks: [
        ...current.quickLinks,
        { id: uid(), label, url: withProtocol, icon: newLinkIcon },
      ],
    }))
    setNewLinkLabel('')
    setNewLinkUrl('')
    setNewLinkIcon('link')
  }

  const removeQuickLink = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      quickLinks: current.quickLinks.filter((item) => item.id !== id),
    }))
  }

  const updateQuickLink = (id: string, patch: Partial<QuickLink>) => {
    updateDashboard((current) => ({
      ...current,
      quickLinks: current.quickLinks.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }))
  }

  const addReminder = () => {
    const title = newReminderTitle.trim()
    if (!title || !newReminderDate) return
    updateDashboard((current) => ({
      ...current,
      reminders: [
        ...current.reminders,
        { id: uid(), title, date: newReminderDate, type: newReminderType },
      ].sort((a, b) => daysUntil(a.date) - daysUntil(b.date)),
    }))
    setNewReminderTitle('')
    setNewReminderDate(dateAfter(7))
    setNewReminderType('Deadline')
  }

  const removeReminder = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      reminders: current.reminders.filter((item) => item.id !== id),
    }))
  }

  const startFocus = useCallback((projectId = dashboard.focus.projectId, taskLabel = '') => {
    const project =
      dashboard.projects.find((item) => item.id === projectId) ?? dashboard.projects[0]
    if (!project) return
    updateDashboard((current) => ({
      ...current,
      currentFocus: taskLabel || project.nextAction,
      focus: {
        ...current.focus,
        running: true,
        projectId: project.id,
        taskLabel: taskLabel || project.nextAction,
        secondsLeft:
          current.focus.secondsLeft === current.focus.durationMinutes * 60
            ? current.focus.secondsLeft
            : current.focus.secondsLeft,
      },
    }))
  }, [dashboard.focus.projectId, dashboard.projects, updateDashboard])

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    const rows = [
      ...dashboard.quickLinks.map((item) => ({
        id: `link-${item.id}`,
        title: item.label,
        meta: item.url,
        type: '快速入口',
        action: () => window.open(item.url, '_blank', 'noopener,noreferrer'),
      })),
      ...dashboard.tasks.map((item) => ({
        id: `task-${item.id}`,
        title: item.title,
        meta: item.kind === 'top' ? '今日 Top 3' : '普通待办',
        type: '任务',
        action: () => toggleTask(item.id),
      })),
      ...dashboard.projects.map((item) => ({
        id: `project-${item.id}`,
        title: item.name,
        meta: item.nextAction,
        type: '项目',
        action: () => startFocus(item.id, item.nextAction),
      })),
      ...dashboard.inbox.map((item) => ({
        id: `inbox-${item.id}`,
        title: item.text,
        meta: '灵感暂存箱',
        type: '灵感',
        action: () => setCommandOpen(false),
      })),
    ]

    if (!query) return rows.slice(0, 8)
    return rows
      .filter(
        (row) =>
          row.title.toLowerCase().includes(query) ||
          row.meta.toLowerCase().includes(query) ||
          row.type.toLowerCase().includes(query),
      )
      .slice(0, 10)
  }, [
    commandQuery,
    dashboard.quickLinks,
    dashboard.tasks,
    dashboard.projects,
    dashboard.inbox,
    startFocus,
    toggleTask,
  ])

  const pauseFocus = () => {
    updateDashboard((current) => ({
      ...current,
      focus: { ...current.focus, running: false },
    }))
  }

  const resetFocus = () => {
    updateDashboard((current) => ({
      ...current,
      currentFocus: '等待下一次启动',
      focus: {
        ...current.focus,
        running: false,
        secondsLeft: current.focus.durationMinutes * 60,
        taskLabel: '',
      },
    }))
  }

  const setFocusDuration = (durationMinutes: number) => {
    updateDashboard((current) => ({
      ...current,
      focus: {
        ...current.focus,
        durationMinutes,
        secondsLeft: durationMinutes * 60,
      },
    }))
  }

  const updateReview = (patch: Partial<DailyReview>) => {
    updateDashboard((current) => ({
      ...current,
      review: { ...current.review, ...patch },
    }))
  }

  return (
    <main className="app-shell">
      <header className="top-status">
        <section className="status-block time-block" aria-label="日期与时间">
          <Clock3 size={18} />
          <div>
            <strong>{formatTime(now)}</strong>
            <span>{formatDate(now)}</span>
          </div>
        </section>

        <section className="status-block weather-block" aria-label="天气">
          {editingWeather ? (
            <div className="compact-edit">
              <input
                aria-label="天气城市"
                value={dashboard.weather.label}
                placeholder="城市，如 Hong Kong"
                onChange={(event) =>
                  updateDashboard((current) => ({
                    ...current,
                    weather: {
                      ...current.weather,
                      label: event.target.value,
                      latitude: undefined,
                      longitude: undefined,
                    },
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void setWeatherCity(dashboard.weather.label)
                  }
                }}
              />
              <button
                className="icon-button"
                type="button"
                title="固定这个城市"
                disabled={weatherLoading}
                onClick={() => {
                  void setWeatherCity(dashboard.weather.label)
                }}
              >
                <MapPin size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                title="完成天气编辑"
                onClick={() => setEditingWeather(false)}
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="weather-card">
              <button
                className="weather-button"
                type="button"
                title="设置天气城市"
                onClick={() => setEditingWeather(true)}
              >
                <span className="weather-icon">{dashboard.weather.icon}</span>
                <span className="weather-main">
                  <strong>{dashboard.weather.temp}</strong>
                  {dashboard.weather.condition && <em>{dashboard.weather.condition}</em>}
                </span>
                <small>
                  <MapPin size={12} />
                  {dashboard.weather.label}
                </small>
              </button>
              <button
                className="weather-refresh"
                type="button"
                title="联网查询当前位置天气"
                disabled={weatherLoading}
                onClick={refreshWeather}
              >
                <RefreshCw size={15} />
              </button>
              {weatherError && <p>{weatherError}</p>}
            </div>
          )}
        </section>

        <section className="status-block quote-block" aria-label="今日箴言">
          <Sparkles size={18} />
          <button
            className="quote-button"
            type="button"
            title="管理名言池"
            onClick={() => setQuoteManagerOpen(true)}
          >
            <span className="quote-text">{todaysQuote.text}</span>
            <small className="quote-author">-- {todaysQuote.author}</small>
          </button>
        </section>

        <section className="status-block focus-block" aria-label="当前专注">
          <Focus size={18} />
          <div>
            <span>当前专注</span>
            <strong>{dashboard.currentFocus}</strong>
          </div>
        </section>
      </header>

      <section className="control-strip" aria-label="个人状态控制">
        <div
          className="energy-control"
          data-energy={dashboard.energy}
          style={{ '--energy-level': dashboard.energy } as React.CSSProperties}
        >
          <BatteryCharging size={18} />
          <span>能量</span>
          <div className="energy-dots" aria-label={`当前能量 ${dashboard.energy} 分`}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className={[
                  score <= dashboard.energy ? 'active' : '',
                  score === dashboard.energy ? 'current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-score={score}
                title={`能量 ${score}`}
                onClick={() =>
                  updateDashboard((current) => ({ ...current, energy: score }))
                }
              />
            ))}
          </div>
        </div>

        <div className="mode-control" data-day-mode={dashboard.dayMode}>
          <span>今日模式</span>
          <div className="mode-options" role="group" aria-label="今日模式">
            {dayModeOptions.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={dashboard.dayMode === mode.value ? 'active' : ''}
                data-mode-option={mode.value}
                title={mode.value}
                aria-pressed={dashboard.dayMode === mode.value}
                onClick={() =>
                  updateDashboard((current) => ({
                    ...current,
                    dayMode: mode.value,
                  }))
                }
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        <ThemedSelect
          className="theme-select"
          icon={<Palette size={18} />}
          label="主题"
          value={dashboard.theme}
          options={themeOptions}
          onChange={(theme) =>
            updateDashboard((current) => ({
              ...current,
              theme: theme as Theme,
            }))
          }
        />

        <button
          className="command-trigger"
          type="button"
          onClick={() => setCommandOpen(true)}
        >
          <Command size={17} />
          <span>命令面板</span>
          <kbd>Ctrl K</kbd>
        </button>
      </section>

      <section className="routine-start" aria-label="启动工作区">
        <article className="panel links-panel">
          <PanelTitle icon={<Link size={20} />} title="快捷入口" aside="Launchpad" />
          <div className="quick-grid">
            {dashboard.quickLinks.map((item) => (
              <div
                className={
                  editingQuickLinkId === item.id
                    ? 'quick-link-shell editing'
                    : 'quick-link-shell'
                }
                key={item.id}
              >
                <div className="quick-link-main">
                  <a href={item.url} target="_blank" rel="noreferrer" title={item.url}>
                    <IconByName name={item.icon} />
                    <span>{item.label}</span>
                    <ExternalLink size={13} />
                  </a>
                  <button
                    type="button"
                    title="编辑入口"
                    onClick={() =>
                      setEditingQuickLinkId((current) =>
                        current === item.id ? null : item.id,
                      )
                    }
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                {editingQuickLinkId === item.id && (
                  <div className="quick-link-edit">
                    <input
                      value={item.label}
                      aria-label={`${item.label} 名称`}
                      onChange={(event) =>
                        updateQuickLink(item.id, { label: event.target.value })
                      }
                    />
                    <input
                      value={item.url}
                      aria-label={`${item.label} URL`}
                      onChange={(event) =>
                        updateQuickLink(item.id, { url: event.target.value })
                      }
                    />
                    <ThemedSelect
                      compact
                      value={item.icon}
                      aria-label={`${item.label} 图标`}
                      options={linkIconOptions}
                      onChange={(icon) => updateQuickLink(item.id, { icon })}
                    />
                    <button
                      type="button"
                      title="删除入口"
                      onClick={() => removeQuickLink(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="link-form">
            <input
              value={newLinkLabel}
              placeholder="名称"
              onChange={(event) => setNewLinkLabel(event.target.value)}
            />
            <input
              value={newLinkUrl}
              placeholder="URL"
              onChange={(event) => setNewLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addQuickLink()
              }}
            />
            <ThemedSelect
              compact
              value={newLinkIcon}
              aria-label="入口图标"
              options={linkIconOptions}
              onChange={setNewLinkIcon}
            />
            <button type="button" onClick={addQuickLink}>
              <Plus size={16} />
            </button>
          </div>
        </article>

        <article className="panel focus-start-panel">
          <PanelTitle icon={<Focus size={20} />} title="今日专注" aside={`${completionRate}%`} />
          <div className="focus-priority">
            <span>现在先做</span>
            <strong>{suggestedAction}</strong>
          </div>
          <FocusControls
            dashboard={dashboard}
            activeProject={activeProject}
            projectOptions={[
              { value: '', label: '默认第一个项目', icon: <Focus size={15} /> },
              ...dashboard.projects.map((project) => ({
                value: project.id,
                label: project.name,
                icon: <Flame size={15} />,
              })),
            ]}
            onProjectChange={(projectId) =>
              updateDashboard((current) => ({
                ...current,
                focus: { ...current.focus, projectId },
              }))
            }
            onDurationChange={setFocusDuration}
            onStart={() => startFocus()}
            onPause={pauseFocus}
            onReset={resetFocus}
          />
          <div className="focus-signals">
            <span>{completedTasks}/{dashboard.tasks.length} 完成</span>
            <span>{totalFocusMinutes} 分钟</span>
            <span>{urgentReminderCount} 个临近提醒</span>
            <span>{suggestedProject?.name ?? '未设置项目'}</span>
          </div>
        </article>
      </section>

      <section className="routine-grid" aria-label="个人作战桌面">
        <article className="panel today-panel">
          <PanelTitle
            icon={<SquareCheckBig size={20} />}
            title="今日面板"
            aside={`${completedTasks}/${dashboard.tasks.length} 完成`}
          />

          <div className="progress-track">
            <span
              style={{
                width: `${dashboard.tasks.length ? (completedTasks / dashboard.tasks.length) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="section-heading">
            <span>Top 3</span>
            <small>{topTasks.length}/3</small>
          </div>
          <ul className="task-list top-task-list">
            {topTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </ul>
          <div className="inline-form">
            <input
              value={newTopTask}
              maxLength={60}
              disabled={topTasks.length >= 3}
              placeholder={topTasks.length >= 3 ? 'Top 3 已满' : '添加今天最重要的事'}
              onChange={(event) => setNewTopTask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTask('top')
              }}
            />
            <button
              type="button"
              disabled={topTasks.length >= 3}
              title="添加 Top 3"
              onClick={() => addTask('top')}
            >
              <Plus size={17} />
            </button>
          </div>

          <div className="section-heading">
            <span>普通待办</span>
            <small>{todos.filter((todo) => todo.done).length}/{todos.length}</small>
          </div>
          <ul className="task-list">
            {todos.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </ul>
          <div className="inline-form">
            <input
              value={newTodo}
              maxLength={80}
              placeholder="添加一个次要任务"
              onChange={(event) => setNewTodo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTask('todo')
              }}
            />
            <button type="button" title="添加待办" onClick={() => addTask('todo')}>
              <Plus size={17} />
            </button>
          </div>
        </article>

        <article className="panel project-panel">
          <PanelTitle icon={<Flame size={20} />} title="项目推进" aside="Next Action" />
          <div className="project-stack">
            {dashboard.projects.map((project) => (
              <div className="project-card" key={project.id}>
                <div className="project-card-header">
                  <input
                    value={project.name}
                    aria-label="项目名称"
                    onChange={(event) =>
                      updateProject(project.id, { name: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button danger"
                    title="删除项目"
                    onClick={() => removeProject(project.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea
                  value={project.nextAction}
                  aria-label={`${project.name} 的下一步动作`}
                  onChange={(event) =>
                    updateProject(project.id, { nextAction: event.target.value })
                  }
                />
                <div className="project-meta">
                  <span>{project.minutes} 分钟已记录</span>
                  <button
                    type="button"
                    onClick={() => startFocus(project.id, project.nextAction)}
                  >
                    <Play size={14} />
                    专注
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="project-form">
            <input
              value={newProjectName}
              placeholder="新项目"
              onChange={(event) => setNewProjectName(event.target.value)}
            />
            <input
              value={newProjectAction}
              placeholder="下一步动作"
              onChange={(event) => setNewProjectAction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addProject()
              }}
            />
            <button type="button" onClick={addProject}>
              <Plus size={16} />
              添加
            </button>
          </div>
        </article>

        <aside className="routine-side">
          <article className="panel inbox-panel">
            <PanelTitle icon={<Inbox size={20} />} title="灵感暂存箱" aside={`${dashboard.inbox.length} 条`} />
            <div className="brain-dump">
              <textarea
                value={newInboxText}
                placeholder="想到什么先丢进来，回车收纳"
                onChange={(event) => setNewInboxText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    addInboxItem()
                  }
                }}
              />
              <button type="button" onClick={addInboxItem}>
                <Brain size={17} />
                收纳
              </button>
            </div>
            <ul className="inbox-list">
              {dashboard.inbox.map((item) => (
                <li key={item.id}>
                  <span>{item.text}</span>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="删除灵感"
                    onClick={() => removeInboxItem(item.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel reminders-panel">
            <PanelTitle
              icon={<CalendarClock size={20} />}
              title="提醒与倒计时"
              aside={nextReminder ? `${daysUntil(nextReminder.date)} 天` : '别忘'}
            />
            <div className="reminder-stack">
              {dashboard.reminders
                .slice()
                .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
                .map((item) => {
                  const days = daysUntil(item.date)
                  return (
                    <div className="reminder-card" key={item.id}>
                      <div>
                        <span>{item.type}</span>
                        <strong>{item.title}</strong>
                        <small>{item.date}</small>
                      </div>
                      <div className={days <= 3 ? 'countdown urgent' : 'countdown'}>
                        {days < 0 ? '已过' : days === 0 ? '今天' : `${days} 天`}
                      </div>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="删除提醒"
                        onClick={() => removeReminder(item.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
            </div>
            <div className="reminder-form">
              <input
                value={newReminderTitle}
                placeholder="提醒名称"
                onChange={(event) => setNewReminderTitle(event.target.value)}
              />
              <input
                type="date"
                value={newReminderDate}
                onChange={(event) => setNewReminderDate(event.target.value)}
              />
              <input
                value={newReminderType}
                placeholder="类型"
                onChange={(event) => setNewReminderType(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addReminder()
                }}
              />
              <button type="button" onClick={addReminder}>
                <Plus size={16} />
              </button>
            </div>
          </article>
        </aside>
      </section>

      <section className="routine-review" aria-label="AI 每日总结">
        <article className="panel ai-review-panel">
          <PanelTitle icon={<Moon size={20} />} title="轻量每日复盘" aside={todayIso()} />
          <div className="review-grid">
            <label>
              今天做了什么？
              <textarea
                value={dashboard.review.did}
                onChange={(event) => updateReview({ did: event.target.value })}
                placeholder="三两句就够"
              />
            </label>
            <label>
              卡在了哪里？
              <textarea
                value={dashboard.review.stuck}
                onChange={(event) => updateReview({ stuck: event.target.value })}
                placeholder="只记录事实，不审判自己"
              />
            </label>
            <label>
              明天第一件事是什么？
              <textarea
                value={dashboard.review.tomorrow}
                onChange={(event) => updateReview({ tomorrow: event.target.value })}
                placeholder="醒来直接做的那一小步"
              />
            </label>
          </div>
          <div className="ai-placeholder">
            <Sparkles size={17} />
            <span>AI 晚间总结接口已预留：未来可用今日任务、暂存箱和复盘生成作战报告。</span>
          </div>
        </article>
      </section>

      {commandOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true">
          <div className="command-panel">
            <div className="command-search">
              <Search size={19} />
              <input
                autoFocus
                value={commandQuery}
                placeholder="搜索链接、任务、项目、灵感..."
                onChange={(event) => setCommandQuery(event.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                title="关闭命令面板"
                onClick={() => setCommandOpen(false)}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="command-results">
              {commandResults.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => {
                    row.action()
                    setCommandOpen(false)
                  }}
                >
                  <span>{row.type}</span>
                  <strong>{row.title}</strong>
                  <small>{row.meta}</small>
                </button>
              ))}
              {!commandResults.length && <p>没有找到匹配项</p>}
            </div>
          </div>
        </div>
      )}

      {quoteManagerOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true">
          <div className="quote-panel">
            <div className="quote-manager-header">
              <div>
                <Sparkles size={20} />
                <div>
                  <h2>名言池</h2>
                  <span>{dashboard.quotePool.filter((quote) => quote.enabled).length} 条启用</span>
                </div>
              </div>
              <div className="quote-manager-actions">
                <button
                  className="quote-reroll-button"
                  type="button"
                  onClick={rerollDailyQuote}
                >
                  <RefreshCw size={15} />
                  今天换一句
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="关闭名言池"
                  onClick={() => setQuoteManagerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="quote-current">
              <span>今日显示</span>
              <strong>{todaysQuote.text}</strong>
              <small>-- {todaysQuote.author}</small>
            </div>

            <div className="quote-form">
              <textarea
                value={newQuoteText}
                maxLength={140}
                placeholder="新增一句有明确作者的名言"
                aria-label="新增名言正文"
                onChange={(event) => setNewQuoteText(event.target.value)}
              />
              <input
                value={newQuoteAuthor}
                maxLength={48}
                placeholder="作者"
                aria-label="新增名言作者"
                onChange={(event) => setNewQuoteAuthor(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addQuote()
                }}
              />
              <button type="button" disabled={!canAddQuote} onClick={addQuote}>
                <Plus size={16} />
                添加
              </button>
            </div>

            <div className="quote-list">
              {dashboard.quotePool.map((quote) => (
                <div
                  className={[
                    'quote-row',
                    quote.enabled ? '' : 'disabled',
                    quote.id === dashboard.dailyQuote.quoteId ? 'selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={quote.id}
                >
                  <label className="quote-toggle">
                    <input
                      type="checkbox"
                      checked={quote.enabled}
                      onChange={() => toggleQuote(quote.id)}
                    />
                    <span>{quote.enabled ? '启用' : '停用'}</span>
                  </label>
                  <textarea
                    value={quote.text}
                    maxLength={140}
                    aria-label={`${quote.author} 名言正文`}
                    onChange={(event) =>
                      updateQuote(quote.id, { text: event.target.value })
                    }
                  />
                  <input
                    value={quote.author}
                    maxLength={48}
                    aria-label={`${quote.text} 作者`}
                    onChange={(event) =>
                      updateQuote(quote.id, { author: event.target.value })
                    }
                  />
                  <button
                    className="icon-button danger"
                    type="button"
                    title="删除名言"
                    onClick={() => removeQuote(quote.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!dashboard.quotePool.length && (
                <p className="quote-empty">名言池已清空，会显示兜底文案。</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function PanelTitle({
  icon,
  title,
  aside,
}: {
  icon: React.ReactNode
  title: string
  aside?: string
}) {
  return (
    <div className="panel-title">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      {aside && <span>{aside}</span>}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: Task
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <li className={task.done ? 'task-row done' : 'task-row'}>
      <button type="button" className="check-button" onClick={onToggle}>
        {task.done ? <Check size={15} /> : <Circle size={15} />}
      </button>
      <span>{task.title}</span>
      <button
        type="button"
        className="icon-button danger"
        title="删除任务"
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </li>
  )
}

function FocusControls({
  dashboard,
  activeProject,
  projectOptions,
  onProjectChange,
  onDurationChange,
  onStart,
  onPause,
  onReset,
}: {
  dashboard: DashboardState
  activeProject?: Project
  projectOptions: SelectOption[]
  onProjectChange: (projectId: string) => void
  onDurationChange: (durationMinutes: number) => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  return (
    <div className="focus-console">
      <div className="timer-readout">
        <TimerReset size={18} />
        <strong>{formatMinutes(dashboard.focus.secondsLeft)}</strong>
        <span>{activeProject?.name ?? '选择项目'}</span>
      </div>
      <div className="focus-controls">
        <ThemedSelect
          value={dashboard.focus.projectId}
          aria-label="选择专注项目"
          options={projectOptions}
          onChange={onProjectChange}
        />
        <input
          type="number"
          min={5}
          max={120}
          value={dashboard.focus.durationMinutes}
          aria-label="专注分钟数"
          onChange={(event) => onDurationChange(Number(event.target.value) || 25)}
        />
        {dashboard.focus.running ? (
          <button type="button" className="primary-action" onClick={onPause}>
            <Pause size={16} />
            暂停
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={onStart}>
            <Play size={16} />
            开始专注
          </button>
        )}
        <button type="button" className="secondary-action" onClick={onReset}>
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  )
}

function ThemedSelect({
  value,
  options,
  onChange,
  label,
  icon,
  className = '',
  compact = false,
  'aria-label': ariaLabel,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label?: string
  icon?: React.ReactNode
  className?: string
  compact?: boolean
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const handleClick = () => setOpen(false)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      className={[
        'themed-select',
        compact ? 'compact' : '',
        open ? 'open' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => event.stopPropagation()}
    >
      {label && (
        <span className="themed-select-label">
          {icon}
          {label}
        </span>
      )}
      <button
        type="button"
        className="themed-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => setOpen((current) => !current)}
      >
        {selected?.icon}
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="themed-select-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={option.value === value ? 'selected' : ''}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.icon}
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function IconByName({ name }: { name: string }) {
  const props = { size: 20 }
  if (name === 'github') return <Globe2 {...props} />
  if (name === 'sparkles') return <Sparkles {...props} />
  if (name === 'zap') return <Zap {...props} />
  if (name === 'mail') return <Mail {...props} />
  if (name === 'calendar') return <CalendarClock {...props} />
  if (name === 'doc') return <Pencil {...props} />
  if (name === 'sun') return <Sun {...props} />
  if (name === 'star') return <Star {...props} />
  if (name === 'globe') return <Globe2 {...props} />
  return <Link {...props} />
}

export default App
