import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BatteryCharging,
  Brain,
  CalendarClock,
  Check,
  Clock3,
  Command,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  Focus,
  Inbox,
  Link,
  MapPin,
  Minus,
  Moon,
  Palette,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  SquareCheckBig,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  FocusControls,
  IconByName,
  OrderControls,
  PanelTitle,
  TaskRow,
  ThemedSelect,
} from './components'
import type {
  AiProvider,
  DailyArchive,
  DailyReview,
  DashboardBackup,
  DashboardState,
  GlobalShortcutStatus,
  Project,
  Quote,
  QuickLink,
  StoredDashboardState,
  TaskKind,
  Theme,
  WeatherPosition,
} from './types'
import {
  aiProviderDefaults,
  aiProviderOptions,
  createBackupState,
  dayModeOptions,
  fallbackQuote,
  getQuoteById,
  linkIconOptions,
  loadState,
  normalizeDashboardState,
  pickQuoteId,
  resolveDailyQuote,
  STORAGE_KEY,
  themeOptions,
} from './dashboardState'
import {
  buildReviewPrompt,
  getAiSettingsIssue,
  requestAiSummary,
} from './ai'
import {
  buildLocalSummary,
  dateAfter,
  daysUntil,
  downloadTextFile,
  formatDate,
  formatTime,
  normalizeHttpUrl,
  readFileAsText,
  todayIso,
  uid,
} from './utils'
import {
  geocodeCity,
  getIpPosition,
  getPosition,
  weatherCodeMap,
} from './weather'
import { WeatherIcon } from './weatherIcon'
import './App.css'

const STORAGE_FAILURE_NOTICE = '本地存储写入失败，请先导出备份后再清理数据'
const INVALID_LINK_NOTICE = '链接无效：只支持 http/https 地址'
const MAIN_VIEW_STORAGE_KEY = 'personal-command-deck-main-view'

type MainView = 'start' | 'execute' | 'review'

const isMainView = (value: string | null): value is MainView =>
  value === 'start' || value === 'execute' || value === 'review'

const loadMainView = (): MainView => {
  try {
    const storedView = window.localStorage.getItem(MAIN_VIEW_STORAGE_KEY)
    return isMainView(storedView) ? storedView : 'start'
  } catch {
    return 'start'
  }
}

const mainViewOptions = [
  { value: 'start', label: '聚焦', hint: '本轮目标', icon: <Focus size={17} /> },
  { value: 'execute', label: '推进', hint: '任务项目', icon: <SquareCheckBig size={17} /> },
  { value: 'review', label: '复盘', hint: '总结归档', icon: <Moon size={17} /> },
] satisfies Array<{
  value: MainView
  label: string
  hint: string
  icon: React.ReactNode
}>

const reminderTypeOptions = [
  { value: 'Deadline', label: 'Deadline', icon: <CalendarClock size={15} /> },
  { value: '账单', label: '账单', icon: <SquareCheckBig size={15} /> },
  { value: '生日', label: '生日', icon: <Sparkles size={15} /> },
  { value: '面试', label: '面试', icon: <Brain size={15} /> },
  { value: '旅行', label: '旅行', icon: <MapPin size={15} /> },
  { value: '其他', label: '其他', icon: <Link size={15} /> },
]

const recognizableStateKeys = new Set([
  'theme',
  'dayMode',
  'energy',
  'weather',
  'currentFocus',
  'tasks',
  'tomorrowTasks',
  'projects',
  'quickLinks',
  'inbox',
  'reminders',
  'review',
  'reviewSummary',
  'ai',
  'retention',
  'archives',
  'focus',
])

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const extractBackupState = (parsed: unknown): StoredDashboardState => {
  if (!isJsonRecord(parsed)) {
    throw new Error('备份文件不是可识别的 JSON 对象')
  }

  if ('state' in parsed) {
    if (parsed.app !== 'Personal Command Deck') {
      throw new Error('这不是 Personal Command Deck 的备份')
    }
    if (!isJsonRecord(parsed.state)) {
      throw new Error('备份里没有可导入的数据')
    }
    return parsed.state as StoredDashboardState
  }

  const looksLikeLegacyState = Object.keys(parsed).some((key) =>
    recognizableStateKeys.has(key),
  )
  if (!looksLikeLegacyState) {
    throw new Error('没有找到 Personal Command Deck 数据')
  }
  return parsed as StoredDashboardState
}

const createFocusEndTime = (secondsLeft: number) =>
  new Date(Date.now() + Math.max(0, secondsLeft) * 1000).toISOString()

const getFocusSecondsLeft = (endsAt?: string) => {
  if (!endsAt) return 0
  const endTime = new Date(endsAt).getTime()
  if (!Number.isFinite(endTime)) return 0
  return Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
}

const getFocusSegmentSeconds = (startedAt?: string, endsAt?: string) => {
  if (!startedAt || !endsAt) return 0
  const startTime = new Date(startedAt).getTime()
  const endTime = new Date(endsAt).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0
  return Math.max(
    0,
    Math.floor((Math.min(Date.now(), endTime) - startTime) / 1000),
  )
}

const secondsToDisplayMinutes = (seconds: number) => Math.floor(seconds / 60)

const retentionOptions = [
  { value: '0', label: '永久保留' },
  { value: '30', label: '30 天' },
  { value: '90', label: '90 天' },
  { value: '180', label: '180 天' },
  { value: '365', label: '1 年' },
]

const retentionSelectOptions = retentionOptions.map((option) => ({
  ...option,
  icon: option.value === '0' ? <Archive size={15} /> : <CalendarClock size={15} />,
}))

const defaultShortcutStatus: GlobalShortcutStatus = {
  enabled: false,
  accelerator: 'CommandOrControl+Shift+Space',
  registered: false,
  message: '桌面版可用',
}

const clampRetentionDays = (days: number) =>
  Number.isFinite(days) ? Math.min(3650, Math.max(0, Math.round(days))) : 0

const getRetentionLabel = (days: number) => (days <= 0 ? '永久保留' : `${days} 天`)

const isWithinRetentionWindow = (
  isoDateTime: string | undefined,
  days: number,
  now = Date.now(),
) => {
  if (days <= 0) return true
  const time = isoDateTime ? new Date(isoDateTime).getTime() : NaN
  if (!Number.isFinite(time)) return true
  return now - time <= days * 86_400_000
}

const getTotalFocusMinutes = (projects: Project[]) =>
  projects.reduce(
    (total, project) =>
      total + secondsToDisplayMinutes(project.focusSeconds ?? project.minutes * 60),
    0,
  )

function RetentionControls({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: string) => void
}) {
  const selectValue = String(value)
  const options = retentionSelectOptions.some((option) => option.value === selectValue)
    ? retentionSelectOptions
    : [
        {
          value: selectValue,
          label: getRetentionLabel(value),
          icon: <CalendarClock size={15} />,
        },
        ...retentionSelectOptions,
      ]

  return (
    <>
      <label className="retention-select-field">
        <span>{label}</span>
        <ThemedSelect
          compact
          value={selectValue}
          aria-label={label}
          options={options}
          onChange={onChange}
        />
      </label>
      <label className="retention-stepper-field">
        <span>自定义天数</span>
        <div className="retention-stepper">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
          <div>
            <button
              type="button"
              title="增加 30 天"
              aria-label="增加 30 天"
              onClick={() => onChange(String(clampRetentionDays(value + 30)))}
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              title="减少 30 天"
              aria-label="减少 30 天"
              disabled={value <= 0}
              onClick={() => onChange(String(clampRetentionDays(value - 30)))}
            >
              <Minus size={13} />
            </button>
          </div>
        </div>
      </label>
    </>
  )
}

const addFocusSecondsToProject = (project: Project, seconds: number): Project => {
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

const formatFocusRecordNotice = (projectName: string, seconds: number) => {
  if (seconds < 60) return `已记录不到 1 分钟到 ${projectName}`
  return `已记录 ${secondsToDisplayMinutes(seconds)} 分钟到 ${projectName}`
}

const settleFocusProject = (
  current: DashboardState,
  projectId: string,
  seconds: number,
) => {
  if (seconds <= 0) return { projects: current.projects, notice: '' }
  const targetProject = current.projects.find((project) => project.id === projectId)
  if (!targetProject) return { projects: current.projects, notice: '' }
  return {
    projects: current.projects.map((project) =>
      project.id === projectId ? addFocusSecondsToProject(project, seconds) : project,
    ),
    notice: formatFocusRecordNotice(targetProject.name, seconds),
  }
}

const buildArchive = (current: DashboardState): DailyArchive => {
  const completed = current.tasks.filter((task) => task.done)
  const open = current.tasks.filter((task) => !task.done)
  const summary =
    current.reviewSummary ||
    buildLocalSummary(current.review, completed, open, current.inbox, current.tomorrowTasks)

  return {
    id: uid(),
    date: todayIso(),
    createdAt: new Date().toISOString(),
    completedTasks: completed,
    openTasks: open,
    tomorrowTasks: current.tomorrowTasks,
    inbox: current.inbox,
    review: current.review,
    summary,
    totalFocusMinutes: getTotalFocusMinutes(current.projects),
  }
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardState>(() => loadState())
  const [activeMainView, setActiveMainView] = useState<MainView>(() => loadMainView())
  const [now, setNow] = useState(() => new Date())
  const [newTopTask, setNewTopTask] = useState('')
  const [newTodo, setNewTodo] = useState('')
  const [newTomorrowTask, setNewTomorrowTask] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectAction, setNewProjectAction] = useState('')
  const [shortcutStatus, setShortcutStatus] =
    useState<GlobalShortcutStatus>(defaultShortcutStatus)
  const [shortcutInput, setShortcutInput] = useState(defaultShortcutStatus.accelerator)
  const [shortcutLoading, setShortcutLoading] = useState(false)
  const [shortcutNotice, setShortcutNotice] = useState('')
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
  const [editingQuickLinkUrl, setEditingQuickLinkUrl] = useState('')
  const [dataNotice, setDataNotice] = useState('')
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [addingTopTask, setAddingTopTask] = useState(false)
  const [addingTodo, setAddingTodo] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  const [addingQuickLink, setAddingQuickLink] = useState(false)
  const [addingReminder, setAddingReminder] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [showCompletedProjects, setShowCompletedProjects] = useState(false)
  const [pendingFocusProjectId, setPendingFocusProjectId] = useState<string | null>(null)
  const [pendingFocusMinutes, setPendingFocusMinutes] = useState(() => dashboard.focus.durationMinutes)
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null)
  const [movedOrderItem, setMovedOrderItem] = useState<{
    id: string
    direction: 'up' | 'down'
  } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(MAIN_VIEW_STORAGE_KEY, activeMainView)
    } catch {
      // UI preference only; dashboard data persistence has its own notice path.
    }
  }, [activeMainView])
  const weatherRequestId = useRef(0)
  const reminderDateInputRef = useRef<HTMLInputElement>(null)

  const updateDashboard = useCallback((updater: (current: DashboardState) => DashboardState) => {
    setDashboard(updater)
  }, [])

  const markOrderMove = useCallback((id: string, direction: 'up' | 'down') => {
    setMovedOrderItem({ id, direction })
    window.setTimeout(() => {
      setMovedOrderItem((current) => (current?.id === id ? null : current))
    }, 280)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboard))
    } catch {
      window.setTimeout(() => setDataNotice(STORAGE_FAILURE_NOTICE), 0)
    }
    document.documentElement.dataset.theme = dashboard.theme
    document.documentElement.dataset.mode = dashboard.dayMode
  }, [dashboard])

  useEffect(() => {
    let cancelled = false
    const loadDesktopSettings = async () => {
      if (!window.commandDeck?.getDesktopSettings) {
        setShortcutNotice('快捷键设置仅在桌面版可用')
        return
      }
      try {
        const response = await window.commandDeck.getDesktopSettings()
        if (cancelled) return
        setShortcutStatus(response.shortcut)
        setShortcutInput(response.shortcut.accelerator)
        setShortcutNotice(response.shortcut.message)
      } catch {
        if (!cancelled) setShortcutNotice('快捷键设置读取失败')
      }
    }

    void loadDesktopSettings()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!dashboard.focus.running) return
    const syncFocusClock = () => {
      setDashboard((current) => {
        if (!current.focus.running) return current
        const secondsLeft = getFocusSecondsLeft(current.focus.endsAt)
        if (secondsLeft <= 0) {
          const elapsedSeconds = Math.max(
            1,
            getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt),
          )
          const { projects, notice } = settleFocusProject(
            current,
            current.focus.projectId,
            elapsedSeconds,
          )
          if (notice) window.setTimeout(() => setDataNotice(notice), 0)
          return {
            ...current,
            projects,
            currentFocus: '等待下一次启动',
            focus: {
              ...current.focus,
              running: false,
              secondsLeft: current.focus.durationMinutes * 60,
              taskLabel: '',
              endsAt: undefined,
              startedAt: undefined,
            },
          }
        }
        if (secondsLeft === current.focus.secondsLeft) return current
        return {
          ...current,
          focus: {
            ...current.focus,
            secondsLeft,
          },
        }
      })
    }
    syncFocusClock()
    const interval = window.setInterval(syncFocusClock, 1000)
    return () => window.clearInterval(interval)
  }, [dashboard.focus.running])

  const pruneExpiredRecords = useCallback(() => {
    updateDashboard((current) => {
      const nowTime = Date.now()
      const archives = current.archives.filter((archive) =>
        isWithinRetentionWindow(
          archive.createdAt,
          current.retention.reviewArchiveDays,
          nowTime,
        ),
      )
      const projects = current.projects.filter(
        (project) =>
          project.active !== false ||
          isWithinRetentionWindow(
            project.completedAt,
            current.retention.completedProjectDays,
            nowTime,
          ),
      )
      if (
        archives.length === current.archives.length &&
        projects.length === current.projects.length
      ) {
        return current
      }
      return { ...current, archives, projects }
    })
  }, [updateDashboard])

  useEffect(() => {
    const interval = window.setInterval(pruneExpiredRecords, 3_600_000)
    return () => window.clearInterval(interval)
  }, [pruneExpiredRecords])

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

  const fetchWeatherForPosition = useCallback(async (
    position: WeatherPosition,
    requestId: number,
  ) => {
    const { latitude, longitude } = position
    const params = new URLSearchParams({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,weather_code',
      timezone: 'auto',
    })
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    if (!response.ok) throw new Error('天气服务暂时不可用')
    if (requestId !== weatherRequestId.current) return

    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number
        relative_humidity_2m?: number
        weather_code?: number
      }
      timezone?: string
    }
    if (requestId !== weatherRequestId.current) return
    const current = data.current
    if (!current || current.temperature_2m == null) {
      throw new Error('天气数据不完整')
    }

    const temperature = current.temperature_2m
    const weatherCode = current.weather_code ?? 0
    const mapped = weatherCodeMap[weatherCode] ?? { icon: '🌡', label: '实时天气' }
    updateDashboard((state) => {
      if (requestId !== weatherRequestId.current) return state
      return {
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
      }
    })
  }, [updateDashboard])

  const refreshWeather = useCallback(async () => {
    const requestId = weatherRequestId.current + 1
    weatherRequestId.current = requestId
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
      if (requestId !== weatherRequestId.current) return
      await fetchWeatherForPosition(position, requestId)
    } catch (error) {
      if (requestId === weatherRequestId.current) {
        setWeatherError(error instanceof Error ? error.message : '天气查询失败')
      }
    } finally {
      if (requestId === weatherRequestId.current) {
        setWeatherLoading(false)
      }
    }
  }, [
    dashboard.weather.label,
    dashboard.weather.latitude,
    dashboard.weather.longitude,
    fetchWeatherForPosition,
  ])

  const openQuickLink = useCallback((url: string) => {
    const safeUrl = normalizeHttpUrl(url)
    if (!safeUrl) {
      setDataNotice(INVALID_LINK_NOTICE)
      return
    }
    window.open(safeUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const openReminderDatePicker = useCallback(() => {
    const input = reminderDateInputRef.current
    if (!input) return
    input.focus()
    input.showPicker?.()
  }, [])

  const setWeatherCity = useCallback(async (city: string) => {
    const trimmed = city.trim()
    if (!trimmed) return

    const requestId = weatherRequestId.current + 1
    weatherRequestId.current = requestId
    setWeatherLoading(true)
    setWeatherError('')
    try {
      const location = await geocodeCity(trimmed)
      if (requestId !== weatherRequestId.current) return
      await fetchWeatherForPosition(location, requestId)
    } catch (error) {
      if (requestId === weatherRequestId.current) {
        setWeatherError(error instanceof Error ? error.message : '城市设置失败')
      }
    } finally {
      if (requestId === weatherRequestId.current) {
        setWeatherLoading(false)
      }
    }
  }, [fetchWeatherForPosition])

  const topTasks = dashboard.tasks.filter((task) => task.kind === 'top')
  const todos = dashboard.tasks.filter((task) => task.kind === 'todo')
  const completedTasks = dashboard.tasks.filter((task) => task.done).length
  const completedTopTasks = topTasks.filter((task) => task.done).length
  const activeProjects = useMemo(
    () => dashboard.projects.filter((project) => project.active !== false),
    [dashboard.projects],
  )
  const completedProjects = useMemo(
    () => dashboard.projects.filter((project) => project.active === false),
    [dashboard.projects],
  )
  const activeProject = activeProjects.find((project) => project.id === dashboard.focus.projectId)
  const completionRate = dashboard.tasks.length
    ? Math.round((completedTasks / dashboard.tasks.length) * 100)
    : 0
  const priorityTopTask = topTasks.find((task) => !task.done)
  const priorityTodo = todos.find((task) => !task.done)
  const suggestedProject =
    activeProject ?? activeProjects.find((project) => project.active) ?? activeProjects[0]
  const defaultFocusProject =
    activeProjects.find((project) => project.name === '个人指挥台') ??
    activeProjects.find((project) => project.active) ??
    activeProjects[0]
  const focusTarget = priorityTopTask
    ? {
        label: priorityTopTask.title,
        source: '来自 Top 3',
      }
    : priorityTodo
      ? {
          label: priorityTodo.title,
          source: '来自普通待办',
        }
      : {
          label: suggestedProject?.nextAction ?? '先写下一个可以立刻开始的动作',
          source: suggestedProject ? '来自项目推进' : '等待设置目标',
        }
  const hasPausedFocus =
    !dashboard.focus.running &&
    Boolean(dashboard.focus.projectId) &&
    Boolean(dashboard.focus.taskLabel) &&
    dashboard.focus.secondsLeft > 0 &&
    dashboard.focus.secondsLeft < dashboard.focus.durationMinutes * 60
  const visibleFocusTarget = {
    label: dashboard.focus.running
      ? dashboard.currentFocus
      : hasPausedFocus
        ? dashboard.focus.taskLabel
        : focusTarget.label,
    source: dashboard.focus.running
      ? activeProject
        ? `正在记录到 ${activeProject.name}`
        : '正在专注'
      : hasPausedFocus
        ? '已暂停，可继续'
        : focusTarget.source,
  }
  const totalFocusMinutes = getTotalFocusMinutes(dashboard.projects)
  const upcomingReminders = dashboard.reminders
    .slice()
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
  const urgentReminderCount = upcomingReminders.filter((item) => {
    const days = daysUntil(item.date)
    return days >= 0 && days <= 3
  }).length
  const todaysQuote =
    getQuoteById(dashboard.quotePool, dashboard.dailyQuote.quoteId) ?? fallbackQuote
  const canAddQuote = newQuoteText.trim().length > 0 && newQuoteAuthor.trim().length > 0
  const editingQuickLink = dashboard.quickLinks.find(
    (item) => item.id === editingQuickLinkId,
  )
  const pendingFocusProject = activeProjects.find(
    (project) => project.id === pendingFocusProjectId,
  )
  const latestArchive = dashboard.archives[0]
  const todayArchive = dashboard.archives.find((archive) => archive.date === todayIso())
  const recentArchives = dashboard.archives.slice(0, 6)
  const selectedArchive =
    recentArchives.find((archive) => archive.id === expandedArchiveId) ??
    (expandedArchiveId === 'today' ? todayArchive : undefined) ??
    recentArchives[0]
  const reviewReceiptItems = [
    {
      label: '今日完成',
      value: `${completedTasks}/${dashboard.tasks.length}`,
      detail: `${completionRate}%`,
    },
    {
      label: 'Top 3',
      value: `${completedTopTasks}/${topTasks.length || 3}`,
      detail: '核心推进',
    },
    {
      label: '专注累计',
      value: `${totalFocusMinutes}`,
      detail: '分钟',
    },
    {
      label: '灵感暂存',
      value: `${dashboard.inbox.length}`,
      detail: '条',
    },
    {
      label: '临近提醒',
      value: `${urgentReminderCount}`,
      detail: '个',
    },
  ]
  const aiSettingsIssue = getAiSettingsIssue(dashboard.ai)
  const summaryModeLabel = dashboard.ai.enabled ? 'AI 总结' : '本地总结'

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
    if (kind === 'top') {
      setNewTopTask('')
      setAddingTopTask(false)
    } else {
      setNewTodo('')
      setAddingTodo(false)
    }
  }

  const cancelTaskAdd = (kind: TaskKind) => {
    if (kind === 'top') {
      setNewTopTask('')
      setAddingTopTask(false)
    } else {
      setNewTodo('')
      setAddingTodo(false)
    }
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

  const addTomorrowTask = () => {
    const title = newTomorrowTask.trim()
    if (!title) return
    updateDashboard((current) => ({
      ...current,
      tomorrowTasks: [
        ...current.tomorrowTasks,
        { id: uid(), title, done: false, kind: 'todo' },
      ],
    }))
    setNewTomorrowTask('')
  }

  const toggleTomorrowTask = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      tomorrowTasks: current.tomorrowTasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }))
  }

  const removeTomorrowTask = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      tomorrowTasks: current.tomorrowTasks.filter((task) => task.id !== id),
    }))
  }

  const moveTomorrowTask = (id: string, direction: 'up' | 'down') => {
    let moved = false
    updateDashboard((current) => {
      const index = current.tomorrowTasks.findIndex((task) => task.id === id)
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || targetIndex < 0 || targetIndex >= current.tomorrowTasks.length) {
        return current
      }
      const tomorrowTasks = [...current.tomorrowTasks]
      ;[tomorrowTasks[index], tomorrowTasks[targetIndex]] = [
        tomorrowTasks[targetIndex],
        tomorrowTasks[index],
      ]
      moved = true
      return { ...current, tomorrowTasks }
    })
    if (moved) markOrderMove(id, direction)
  }

  const promoteTomorrowTasks = () => {
    updateDashboard((current) => {
      const openTopSlots = Math.max(
        0,
        3 - current.tasks.filter((item) => item.kind === 'top').length,
      )
      const carriedTasks = current.tomorrowTasks
        .filter((task) => task.title.trim())
        .map((task, index) => ({
          id: uid(),
          title: task.title.trim(),
          done: false,
          kind: index < openTopSlots ? ('top' as const) : ('todo' as const),
        }))
      if (!carriedTasks.length) return current
      return {
        ...current,
        tasks: [...current.tasks, ...carriedTasks],
        tomorrowTasks: [],
      }
    })
    setDataNotice('已把明日任务带入今日任务')
  }

  const moveTaskWithinKind = (id: string, direction: 'up' | 'down') => {
    let moved = false
    updateDashboard((current) => {
      const task = current.tasks.find((item) => item.id === id)
      if (!task) return current

      const group = current.tasks.filter((item) => item.kind === task.kind)
      const groupIndex = group.findIndex((item) => item.id === id)
      const targetGroupIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1
      if (groupIndex < 0 || targetGroupIndex < 0 || targetGroupIndex >= group.length) {
        return current
      }

      const target = group[targetGroupIndex]
      moved = true
      return {
        ...current,
        tasks: current.tasks.map((item) => {
          if (item.id === id) return target
          if (item.id === target.id) return task
          return item
        }),
      }
    })
    if (moved) markOrderMove(id, direction)
  }

  const addProject = () => {
    const name = newProjectName.trim()
    const nextAction = newProjectAction.trim()
    if (!name || !nextAction) return
    updateDashboard((current) => ({
      ...current,
      projects: [
        ...current.projects,
        { id: uid(), name, nextAction, minutes: 0, focusSeconds: 0, active: true },
      ],
    }))
    setNewProjectName('')
    setNewProjectAction('')
    setAddingProject(false)
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
    updateDashboard((current) => {
      const elapsedSeconds =
        current.focus.running && current.focus.projectId === id
          ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
          : 0
      return {
        ...current,
        projects: current.projects
          .map((project) =>
            project.id === id && elapsedSeconds > 0
              ? addFocusSecondsToProject(project, elapsedSeconds)
              : project,
          )
          .filter((project) => project.id !== id),
        focus:
          current.focus.projectId === id
            ? {
                ...current.focus,
                projectId: '',
                running: false,
                endsAt: undefined,
                startedAt: undefined,
              }
            : current.focus,
      }
    })
    setPendingFocusProjectId((current) => (current === id ? null : current))
  }

  const completeProject = (id: string) => {
    updateDashboard((current) => {
      const elapsedSeconds =
        current.focus.running && current.focus.projectId === id
          ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
          : 0
      return {
        ...current,
        projects: current.projects.map((project) =>
          project.id === id
            ? {
                ...addFocusSecondsToProject(project, elapsedSeconds),
                active: false,
                completedAt: new Date().toISOString(),
              }
            : project,
        ),
        currentFocus:
          current.focus.projectId === id ? '等待下一次启动' : current.currentFocus,
        focus:
          current.focus.projectId === id
            ? {
                ...current.focus,
                projectId: '',
                running: false,
                taskLabel: '',
                secondsLeft: current.focus.durationMinutes * 60,
                endsAt: undefined,
                startedAt: undefined,
              }
            : current.focus,
      }
    })
    setEditingProjectId((current) => (current === id ? null : current))
    setShowCompletedProjects(true)
    setPendingFocusProjectId((current) => (current === id ? null : current))
  }

  const restoreProject = (id: string) => {
    updateDashboard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id ? { ...project, active: true, completedAt: undefined } : project,
      ),
    }))
  }

  const moveProject = (id: string, direction: 'up' | 'down') => {
    let moved = false
    updateDashboard((current) => {
      const activeIds = current.projects
        .filter((project) => project.active !== false)
        .map((project) => project.id)
      const activeIndex = activeIds.indexOf(id)
      const targetActiveIndex = direction === 'up' ? activeIndex - 1 : activeIndex + 1
      const targetId = activeIds[targetActiveIndex]
      if (activeIndex < 0 || !targetId) {
        return current
      }

      const projects = [...current.projects]
      const index = projects.findIndex((project) => project.id === id)
      const targetIndex = projects.findIndex((project) => project.id === targetId)
      if (index < 0 || targetIndex < 0) return current

      ;[projects[index], projects[targetIndex]] = [projects[targetIndex], projects[index]]
      moved = true
      return { ...current, projects }
    })
    if (moved) markOrderMove(id, direction)
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
    const url = normalizeHttpUrl(newLinkUrl)
    if (!label || !url) return
    updateDashboard((current) => ({
      ...current,
      quickLinks: [
        ...current.quickLinks,
        { id: uid(), label, url, icon: newLinkIcon },
      ],
    }))
    setNewLinkLabel('')
    setNewLinkUrl('')
    setNewLinkIcon('link')
    setAddingQuickLink(false)
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
        item.id === id
          ? {
              ...item,
              ...patch,
              label: patch.label ?? item.label,
              icon: patch.icon ?? item.icon,
            }
          : item,
      ),
    }))
  }

  const commitQuickLinkUrl = (id: string, value: string) => {
    const normalized = normalizeHttpUrl(value)
    if (!normalized) return
    updateQuickLink(id, { url: normalized })
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
    setAddingReminder(false)
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

    updateDashboard((current) => {
      const nextLabel = taskLabel || project.nextAction
      const isSwitchingRunningFocus =
        current.focus.running &&
        (current.focus.projectId !== project.id || current.focus.taskLabel !== nextLabel)
      const elapsedSeconds = isSwitchingRunningFocus
        ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
        : 0
      const isSamePausedFocus =
        !current.focus.running &&
        current.focus.projectId === project.id &&
        current.focus.taskLabel === nextLabel &&
        current.focus.secondsLeft > 0 &&
        current.focus.secondsLeft < current.focus.durationMinutes * 60
      const secondsLeft = isSamePausedFocus
        ? current.focus.secondsLeft
        : current.focus.durationMinutes * 60
      const { projects, notice } = settleFocusProject(
        current,
        current.focus.projectId,
        elapsedSeconds,
      )
      if (notice) window.setTimeout(() => setDataNotice(notice), 0)

      return {
        ...current,
        projects,
        currentFocus: nextLabel,
        focus: {
          ...current.focus,
          running: true,
          projectId: project.id,
          taskLabel: nextLabel,
          secondsLeft,
          endsAt: createFocusEndTime(secondsLeft),
          startedAt: new Date().toISOString(),
        },
      }
    })
  }, [dashboard.focus.projectId, dashboard.projects, updateDashboard])

  const openProjectFocusDialog = useCallback((project: Project) => {
    setPendingFocusProjectId(project.id)
    setPendingFocusMinutes(dashboard.focus.durationMinutes)
  }, [dashboard.focus.durationMinutes])

  const startPendingProjectFocus = useCallback(() => {
    if (!pendingFocusProject) return
    const durationMinutes = Math.min(120, Math.max(5, pendingFocusMinutes))
    updateDashboard((current) => {
      const project = current.projects.find((item) => item.id === pendingFocusProject.id)
      if (!project) return current

      const elapsedSeconds = current.focus.running
        ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
        : 0
      const { projects, notice } = settleFocusProject(
        current,
        current.focus.projectId,
        elapsedSeconds,
      )
      const secondsLeft = durationMinutes * 60
      if (notice) window.setTimeout(() => setDataNotice(notice), 0)

      return {
        ...current,
        projects,
        currentFocus: project.nextAction,
        focus: {
          ...current.focus,
          durationMinutes,
          running: true,
          projectId: project.id,
          taskLabel: project.nextAction,
          secondsLeft,
          endsAt: createFocusEndTime(secondsLeft),
          startedAt: new Date().toISOString(),
        },
      }
    })
    setPendingFocusProjectId(null)
    setActiveMainView('start')
  }, [pendingFocusMinutes, pendingFocusProject, updateDashboard])

  useEffect(() => {
    if (!pendingFocusProjectId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingFocusProjectId(null)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        startPendingProjectFocus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingFocusProjectId, startPendingProjectFocus])

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    const rows = [
      ...dashboard.quickLinks.map((item) => ({
        id: `link-${item.id}`,
        title: item.label,
        meta: item.url,
        type: '快速入口',
        action: () => openQuickLink(item.url),
      })),
      ...dashboard.tasks.map((item) => ({
        id: `task-${item.id}`,
        title: item.title,
        meta: item.kind === 'top' ? '今日 Top 3' : '普通待办',
        type: '任务',
        action: () => toggleTask(item.id),
      })),
      ...activeProjects.map((item) => ({
        id: `project-${item.id}`,
        title: item.name,
        meta: item.nextAction,
        type: '项目',
        action: () => openProjectFocusDialog(item),
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
    dashboard.inbox,
    activeProjects,
    openQuickLink,
    openProjectFocusDialog,
    toggleTask,
  ])

  const pauseFocus = () => {
    updateDashboard((current) => {
      const elapsedSeconds = current.focus.running
        ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
        : 0
      const secondsLeft = current.focus.running
        ? getFocusSecondsLeft(current.focus.endsAt)
        : current.focus.secondsLeft
      const { projects, notice } = settleFocusProject(
        current,
        current.focus.projectId,
        elapsedSeconds,
      )
      if (notice) window.setTimeout(() => setDataNotice(notice), 0)
      return {
        ...current,
        projects,
        focus: {
          ...current.focus,
          running: false,
          secondsLeft,
          endsAt: undefined,
          startedAt: undefined,
        },
      }
    })
  }

  const resetFocus = () => {
    updateDashboard((current) => {
      const elapsedSeconds = current.focus.running
        ? getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt)
        : 0
      const { projects, notice } = settleFocusProject(
        current,
        current.focus.projectId,
        elapsedSeconds,
      )
      if (notice) window.setTimeout(() => setDataNotice(notice), 0)
      return {
        ...current,
        projects,
        currentFocus: '等待下一次启动',
        focus: {
          ...current.focus,
          running: false,
          secondsLeft: current.focus.durationMinutes * 60,
          taskLabel: '',
          endsAt: undefined,
          startedAt: undefined,
        },
      }
    })
  }

  const setFocusDuration = (durationMinutes: number) => {
    updateDashboard((current) => ({
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
    }))
  }

  const updateReview = (patch: Partial<DailyReview>) => {
    updateDashboard((current) => ({
      ...current,
      review: { ...current.review, ...patch },
    }))
  }

  const updateAiSettings = (patch: Partial<DashboardState['ai']>) => {
    updateDashboard((current) => ({
      ...current,
      ai: { ...current.ai, ...patch },
    }))
    setAiError('')
  }

  const saveRetentionInput = (
    key: keyof DashboardState['retention'],
    value: string,
  ) => {
    const days = clampRetentionDays(Number(value))
    updateDashboard((current) => {
      const retention = { ...current.retention, [key]: days }
      const nowTime = Date.now()
      return {
        ...current,
        retention,
        archives: current.archives.filter((archive) =>
          isWithinRetentionWindow(archive.createdAt, retention.reviewArchiveDays, nowTime),
        ),
        projects: current.projects.filter(
          (project) =>
            project.active !== false ||
            isWithinRetentionWindow(
              project.completedAt,
              retention.completedProjectDays,
              nowTime,
            ),
        ),
      }
    })
    setDataNotice(
      days <= 0
        ? '已设置为永久保留'
        : `已设置为保留 ${days} 天，超出时间的本机记录会自动清理`,
    )
  }

  const deleteArchive = (id: string) => {
    const archive = dashboard.archives.find((item) => item.id === id)
    if (!archive) return
    const confirmed = window.confirm(`删除 ${archive.date} 的每日复盘归档？此操作只影响本机数据。`)
    if (!confirmed) return
    updateDashboard((current) => ({
      ...current,
      archives: current.archives.filter((item) => item.id !== id),
    }))
    setExpandedArchiveId((current) => (current === id ? null : current))
    setDataNotice('已删除这条复盘归档')
  }

  const saveGlobalShortcut = async (enabled = shortcutStatus.enabled) => {
    if (!window.commandDeck?.updateGlobalShortcut) {
      setShortcutNotice('快捷键设置仅在桌面版可用')
      return
    }
    setShortcutLoading(true)
    try {
      const response = await window.commandDeck.updateGlobalShortcut({
        enabled,
        accelerator: shortcutInput.trim(),
      })
      setShortcutStatus(response.shortcut)
      setShortcutInput(response.shortcut.accelerator)
      setShortcutNotice(response.shortcut.message)
    } catch (error) {
      setShortcutNotice(error instanceof Error ? error.message : '快捷键保存失败')
    } finally {
      setShortcutLoading(false)
    }
  }

  const setAiProvider = (provider: AiProvider) => {
    updateDashboard((current) => {
      const preset = aiProviderDefaults[provider]
      return {
        ...current,
        ai: {
          ...current.ai,
          provider,
          baseUrl: preset.baseUrl || current.ai.baseUrl,
          model: preset.model || current.ai.model,
        },
      }
    })
    setAiError('')
  }

  const generateReviewSummary = async () => {
    if (!dashboard.ai.enabled) {
      updateDashboard((current) => {
        const completed = current.tasks.filter((task) => task.done)
        const open = current.tasks.filter((task) => !task.done)
        return {
          ...current,
          reviewSummary: buildLocalSummary(
            current.review,
            completed,
            open,
            current.inbox,
            current.tomorrowTasks,
          ),
        }
      })
      setAiError('')
      setDataNotice('已生成本地总结')
      return
    }

    const issue = getAiSettingsIssue(dashboard.ai)
    if (issue) {
      setAiError(issue)
      setAiSettingsOpen(true)
      return
    }

    setAiLoading(true)
    setAiError('')
    try {
      const summary = await requestAiSummary(dashboard.ai, buildReviewPrompt(dashboard))
      updateDashboard((current) => ({
        ...current,
        reviewSummary: summary,
      }))
      setDataNotice('AI 总结已生成')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 总结生成失败')
    } finally {
      setAiLoading(false)
    }
  }

  const archiveToday = () => {
    updateDashboard((current) => {
      const archive = buildArchive(current)

      return {
        ...current,
        archives: [
          archive,
          ...current.archives.filter((item) => item.date !== archive.date),
        ].slice(0, 60),
        reviewSummary: archive.summary,
      }
    })
    setExpandedArchiveId('today')
    setDataNotice('已归档今天，可在最近归档里查看')
  }

  const exportBackup = () => {
    const backup: DashboardBackup = {
      app: 'Personal Command Deck',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: createBackupState(dashboard),
    }
    downloadTextFile(
      `personal-command-deck-${todayIso()}.json`,
      JSON.stringify(backup, null, 2),
    )
    setDataNotice('已导出备份（不包含 API Key）')
  }

  const importBackup = async (file: File) => {
    try {
      const text = await readFileAsText(file)
      const incoming = extractBackupState(JSON.parse(text))
      const confirmed = window.confirm(
        '导入会覆盖当前本地数据，但会保留本机已填写的 API Key。确认继续？',
      )
      if (!confirmed) {
        setDataNotice('已取消导入')
        return
      }
      setDashboard((current) =>
        normalizeDashboardState(incoming, {
          currentState: current,
          preserveAiKey: true,
        }),
      )
      setDataNotice('已导入备份（保留本机 API Key）')
    } catch (error) {
      setDataNotice(
        `导入失败：${error instanceof Error ? error.message : '文件格式不对'}`,
      )
    }
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
                <span className="weather-icon">
                  <WeatherIcon
                    condition={dashboard.weather.condition}
                    fallback={dashboard.weather.icon}
                  />
                </span>
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

        <div className="shortcut-settings" aria-label="托盘呼出快捷键">
          <label className="shortcut-toggle">
            <input
              type="checkbox"
              checked={shortcutStatus.enabled}
              disabled={!window.commandDeck?.updateGlobalShortcut || shortcutLoading}
              onChange={(event) => {
                const enabled = event.target.checked
                setShortcutStatus((current) => ({ ...current, enabled }))
                void saveGlobalShortcut(enabled)
              }}
            />
            <span>呼出</span>
          </label>
          <input
            value={shortcutInput}
            aria-label="全局呼出快捷键"
            placeholder="CommandOrControl+Shift+Space"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={!window.commandDeck?.updateGlobalShortcut || shortcutLoading}
            onChange={(event) => setShortcutInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void saveGlobalShortcut()
              }
            }}
          />
          <button
            type="button"
            disabled={!window.commandDeck?.updateGlobalShortcut || shortcutLoading}
            title="保存托盘呼出快捷键"
            onClick={() => void saveGlobalShortcut()}
          >
            <Command size={15} />
            保存
          </button>
          <small className={shortcutStatus.registered ? 'ok' : ''}>
            {shortcutNotice || (shortcutStatus.registered ? '已启用' : '未启用')}
          </small>
        </div>

        <div className="data-actions" aria-label="本地数据">
          <span>本地备份</span>
          <button type="button" title="导出本地备份，不包含 API Key" onClick={exportBackup}>
            <Download size={15} />
            导出
          </button>
          <label title="导入会覆盖当前本地数据，但保留本机 API Key">
            <Upload size={15} />
            导入
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importBackup(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>

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

      <nav className="main-view-tabs" aria-label="主界面">
        {mainViewOptions.map((view) => (
          <button
            key={view.value}
            type="button"
            className={activeMainView === view.value ? 'active' : ''}
            aria-current={activeMainView === view.value ? 'page' : undefined}
            onClick={() => setActiveMainView(view.value)}
          >
            {view.icon}
            <span>{view.label}</span>
            <small>{view.hint}</small>
          </button>
        ))}
      </nav>

      {activeMainView === 'start' && (
      <section className="main-view-panel start-view" aria-label="聚焦界面">
        <article className="panel focus-start-panel">
          <PanelTitle icon={<Focus size={20} />} title="今日专注" aside={`${completionRate}%`} />
          <div className="focus-priority">
            <span>本轮目标</span>
            <strong>{visibleFocusTarget.label}</strong>
            <small className="focus-source">{visibleFocusTarget.source}</small>
          </div>
          <FocusControls
            dashboard={dashboard}
            focusLabel={visibleFocusTarget.label}
            onDurationChange={setFocusDuration}
            onStart={() =>
              startFocus(
                hasPausedFocus ? dashboard.focus.projectId : defaultFocusProject?.id,
                visibleFocusTarget.label,
              )
            }
            onPause={pauseFocus}
            onReset={resetFocus}
          />
          <div className="focus-signals">
            <div className="focus-signal">
              <span>今日完成</span>
              <strong>{completedTasks}/{dashboard.tasks.length}</strong>
            </div>
            <div className="focus-signal">
              <span>专注累计</span>
              <strong>{totalFocusMinutes} 分钟</strong>
            </div>
            <div className="focus-signal">
              <span>临近提醒</span>
              <strong>{urgentReminderCount} 个</strong>
            </div>
          </div>
          <div className="focus-record-hint">
            <Check size={15} />
            <span>{dataNotice || '专注暂停、重置或自然结束时，会把已过去的分钟记录到当前项目。'}</span>
          </div>
        </article>

        <article className="panel links-panel">
          <div className="panel-title panel-title-action">
            <div>
              <Link size={20} />
              <h2>快捷入口</h2>
            </div>
            <button
              type="button"
              className="ghost-action"
              onClick={() => setAddingQuickLink((current) => !current)}
            >
              <Plus size={15} />
              新入口
            </button>
          </div>
          <div className="quick-grid">
            {dashboard.quickLinks.map((item) => {
              const safeUrl = normalizeHttpUrl(item.url)
              return (
                <div
                  className={
                    editingQuickLinkId === item.id
                      ? 'quick-link-shell editing'
                      : 'quick-link-shell'
                  }
                  key={item.id}
                >
                  <div className="quick-link-main">
                    <a
                      href={safeUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      title={item.url}
                      aria-disabled={!safeUrl}
                      onClick={(event) => {
                        event.preventDefault()
                        openQuickLink(item.url)
                      }}
                    >
                    <IconByName name={item.icon} />
                    <span>{item.label}</span>
                    <ExternalLink size={13} />
                  </a>
                  <button
                    type="button"
                    title="编辑入口"
                    onClick={() => {
                      setEditingQuickLinkId((current) => {
                        const nextId = current === item.id ? null : item.id
                        setEditingQuickLinkUrl(nextId ? item.url : '')
                        return nextId
                      })
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              )
            })}
          </div>
          {editingQuickLink && (
            <div className="quick-link-editor">
              <div className="quick-link-editor-title">
                <span>编辑入口</span>
                <strong>{editingQuickLink.label}</strong>
              </div>
              <div className="quick-link-editor-main">
                <label className="quick-link-editor-field">
                  <span>名称</span>
                  <input
                    value={editingQuickLink.label}
                    aria-label={`${editingQuickLink.label} 名称`}
                    onChange={(event) =>
                      updateQuickLink(editingQuickLink.id, {
                        label: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="quick-link-editor-field quick-link-icon-field">
                  <span>图标</span>
                  <ThemedSelect
                    compact
                    className="quick-link-icon-select"
                    value={editingQuickLink.icon}
                    aria-label={`${editingQuickLink.label} 图标`}
                    options={linkIconOptions}
                    onChange={(icon) => updateQuickLink(editingQuickLink.id, { icon })}
                  />
                </label>
              </div>
              <label className="quick-link-editor-field">
                <span>链接</span>
                <input
                  value={editingQuickLinkUrl}
                  aria-label={`${editingQuickLink.label} URL`}
                  onChange={(event) => setEditingQuickLinkUrl(event.target.value)}
                  onBlur={(event) => {
                    commitQuickLinkUrl(editingQuickLink.id, event.target.value)
                    setEditingQuickLinkUrl(
                      normalizeHttpUrl(event.target.value) || editingQuickLink.url,
                    )
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitQuickLinkUrl(editingQuickLink.id, event.currentTarget.value)
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <div className="quick-link-editor-actions">
                <button
                  type="button"
                  className="danger-action"
                  title="删除入口"
                onClick={() => {
                  removeQuickLink(editingQuickLink.id)
                  setEditingQuickLinkId(null)
                  setEditingQuickLinkUrl('')
                }}
                >
                  <Trash2 size={15} />
                </button>
                <button
                type="button"
                className="done-action"
                onClick={() => {
                  setEditingQuickLinkId(null)
                  setEditingQuickLinkUrl('')
                }}
              >
                  <Check size={15} />
                  完成
                </button>
              </div>
            </div>
          )}
          {addingQuickLink && (
            <div className="quick-link-editor link-form">
              <div className="quick-link-editor-title">
                <span>新增入口</span>
                <strong>{newLinkLabel || '常用网站或文档'}</strong>
              </div>
              <div className="quick-link-editor-main">
                <label className="quick-link-editor-field">
                  <span>名称</span>
                  <input
                    value={newLinkLabel}
                    placeholder="例如 Mail"
                    onChange={(event) => setNewLinkLabel(event.target.value)}
                  />
                </label>
                <label className="quick-link-editor-field quick-link-icon-field">
                  <span>图标</span>
                  <ThemedSelect
                    compact
                    className="quick-link-icon-select"
                    value={newLinkIcon}
                    aria-label="入口图标"
                    options={linkIconOptions}
                    onChange={setNewLinkIcon}
                  />
                </label>
              </div>
              <label className="quick-link-editor-field">
                <span>链接</span>
                <input
                  value={newLinkUrl}
                  placeholder="https://example.com"
                  onChange={(event) => setNewLinkUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addQuickLink()
                  }}
                />
              </label>
              <div className="quick-link-editor-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setAddingQuickLink(false)}
                >
                  取消
                </button>
                <button type="button" className="done-action" onClick={addQuickLink}>
                  <Plus size={16} />
                  添加
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
      )}

      {activeMainView === 'execute' && (
      <section className="main-view-panel execute-view" aria-label="推进界面">
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
            {topTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                orderMoveDirection={
                  movedOrderItem?.id === task.id ? movedOrderItem.direction : undefined
                }
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onMoveUp={() => moveTaskWithinKind(task.id, 'up')}
                onMoveDown={() => moveTaskWithinKind(task.id, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < topTasks.length - 1}
              />
            ))}
          </ul>
          {addingTopTask ? (
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
                className="inline-cancel"
                title="取消添加"
                onClick={() => cancelTaskAdd('top')}
              >
                <X size={16} />
              </button>
              <button
                type="button"
                disabled={topTasks.length >= 3}
                title="添加 Top 3"
                onClick={() => addTask('top')}
              >
                <Plus size={17} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="add-row-button"
              disabled={topTasks.length >= 3}
              onClick={() => setAddingTopTask(true)}
            >
              <Plus size={15} />
              {topTasks.length >= 3 ? 'Top 3 已满' : '添加最重要的事'}
            </button>
          )}

          <div className="section-heading">
            <span>普通待办</span>
            <small>{todos.filter((todo) => todo.done).length}/{todos.length}</small>
          </div>
          <ul className="task-list">
            {todos.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                orderMoveDirection={
                  movedOrderItem?.id === task.id ? movedOrderItem.direction : undefined
                }
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onMoveUp={() => moveTaskWithinKind(task.id, 'up')}
                onMoveDown={() => moveTaskWithinKind(task.id, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < todos.length - 1}
              />
            ))}
          </ul>
          {addingTodo ? (
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
              <button
                type="button"
                className="inline-cancel"
                title="取消添加"
                onClick={() => cancelTaskAdd('todo')}
              >
                <X size={16} />
              </button>
              <button type="button" title="添加待办" onClick={() => addTask('todo')}>
                <Plus size={17} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="add-row-button subtle"
              onClick={() => setAddingTodo(true)}
            >
              <Plus size={15} />
              添加普通待办
            </button>
          )}
        </article>

        <article className="panel project-panel">
          <div className="panel-title panel-title-action">
            <div>
              <Flame size={20} />
              <h2>项目推进</h2>
            </div>
            <button
              type="button"
              className="ghost-action"
              onClick={() => setAddingProject((current) => !current)}
            >
              <Plus size={15} />
              新项目
            </button>
          </div>
          <div className="project-stack">
            {activeProjects.map((project, index) => {
              const isEditing = editingProjectId === project.id
              const canMoveUp = index > 0
              const canMoveDown = index < activeProjects.length - 1
              const orderMoveDirection =
                movedOrderItem?.id === project.id ? movedOrderItem.direction : undefined
              return (
                <div
                  className={[
                    'project-card',
                    isEditing ? 'editing' : '',
                    orderMoveDirection ? `order-moved move-${orderMoveDirection}` : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={project.id}
                >
                  {isEditing ? (
                    <>
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
                        <div className="project-actions project-actions-editing">
                          <OrderControls
                            canMoveUp={canMoveUp}
                            canMoveDown={canMoveDown}
                            onMoveUp={() => moveProject(project.id, 'up')}
                            onMoveDown={() => moveProject(project.id, 'down')}
                          />
                          <button
                            type="button"
                            className="secondary-action project-complete-action"
                            onClick={() => completeProject(project.id)}
                          >
                            <Archive size={14} />
                            结项
                          </button>
                          <button type="button" onClick={() => setEditingProjectId(null)}>
                            <Check size={14} />
                            完成
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="project-readout">
                        <span>下一步</span>
                        <h3>{project.name}</h3>
                        <p>{project.nextAction}</p>
                      </div>
                      <div className="project-meta">
                        <span>{project.minutes} 分钟已记录</span>
                        <div className="project-actions">
                          <div className="quiet-actions" aria-label="项目管理">
                            <OrderControls
                              canMoveUp={canMoveUp}
                              canMoveDown={canMoveDown}
                              onMoveUp={() => moveProject(project.id, 'up')}
                              onMoveDown={() => moveProject(project.id, 'down')}
                            />
                            <button
                              type="button"
                              className="secondary-action compact-action"
                              title="编辑项目"
                              aria-label={`编辑 ${project.name}`}
                              onClick={() => setEditingProjectId(project.id)}
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="secondary-action project-complete-action"
                            title="结项"
                            onClick={() => completeProject(project.id)}
                          >
                            <Archive size={14} />
                            结项
                          </button>
                          <button
                            type="button"
                            className="primary-action project-focus-action"
                            onClick={() => openProjectFocusDialog(project)}
                          >
                            <Play size={14} />
                            专注
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            {!activeProjects.length && (
              <div className="project-empty">没有进行中的项目，新增一个下一步动作开始推进。</div>
            )}
          </div>
          {completedProjects.length > 0 && (
            <div className="completed-projects">
              <button
                type="button"
                className="completed-projects-toggle"
                onClick={() => setShowCompletedProjects((current) => !current)}
              >
                <Archive size={14} />
                <span>已结项 {completedProjects.length}</span>
                <small>{showCompletedProjects ? '收起' : '展开'}</small>
              </button>
              <div className="retention-settings compact" aria-label="已结项项目清理设置">
                <div>
                  <span>本机清理</span>
                  <strong>已结项项目 {getRetentionLabel(dashboard.retention.completedProjectDays)}</strong>
                </div>
                <RetentionControls
                  label="保留"
                  value={dashboard.retention.completedProjectDays}
                  onChange={(value) => saveRetentionInput('completedProjectDays', value)}
                />
              </div>
              {showCompletedProjects && (
                <div className="completed-project-list">
                  {completedProjects.map((project) => (
                    <div className="completed-project-row" key={project.id}>
                      <div>
                        <strong>{project.name}</strong>
                        <span>{project.nextAction || '没有记录下一步动作'}</span>
                        <small>
                          {project.minutes} 分钟已记录
                          {project.completedAt
                            ? ` · ${new Date(project.completedAt).toLocaleDateString('zh-Hans-CN')} 结项`
                            : ''}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => restoreProject(project.id)}
                      >
                        <RefreshCw size={13} />
                        恢复
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="删除已结项项目"
                        onClick={() => removeProject(project.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {addingProject && (
            <div className="field-form project-form">
              <div className="quick-link-editor-title">
                <span>新增项目</span>
                <strong>{newProjectName || '把长期目标变成下一步动作'}</strong>
              </div>
              <label className="quick-link-editor-field">
                <span>项目名称</span>
                <input
                  value={newProjectName}
                  placeholder="例如 个人网站"
                  onChange={(event) => setNewProjectName(event.target.value)}
                />
              </label>
              <label className="quick-link-editor-field">
                <span>下一步动作</span>
                <input
                  value={newProjectAction}
                  placeholder="例如 写 About 页面初稿"
                  onChange={(event) => setNewProjectAction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addProject()
                  }}
                />
              </label>
              <div className="quick-link-editor-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setAddingProject(false)}
                >
                  取消
                </button>
                <button type="button" className="done-action" onClick={addProject}>
                  <Plus size={16} />
                  添加
                </button>
              </div>
            </div>
          )}
        </article>

        <aside className="execution-side">
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
            <div className="panel-title panel-title-action">
              <div>
                <CalendarClock size={20} />
                <h2>提醒与倒计时</h2>
              </div>
              <button
                type="button"
                className="ghost-action"
                onClick={() => setAddingReminder((current) => !current)}
              >
                <Plus size={15} />
                新提醒
              </button>
            </div>
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
            {addingReminder && (
              <div className="field-form reminder-form">
                <div className="quick-link-editor-title">
                  <span>新增提醒</span>
                  <strong>{newReminderTitle || '重要日期和倒计时'}</strong>
                </div>
                <label className="quick-link-editor-field reminder-title-field">
                  <span>提醒名称</span>
                  <input
                    value={newReminderTitle}
                    placeholder="例如 信用卡账单"
                    onChange={(event) => setNewReminderTitle(event.target.value)}
                  />
                </label>
                <div className="reminder-form-row">
                  <label className="quick-link-editor-field reminder-date-field">
                    <span>日期</span>
                    <div className="date-input-shell">
                      <input
                        ref={reminderDateInputRef}
                        type="date"
                        value={newReminderDate}
                        onChange={(event) => setNewReminderDate(event.target.value)}
                      />
                      <button
                        type="button"
                        className="reminder-date-picker-button"
                        aria-label="打开日期选择"
                        title="打开日期选择"
                        onClick={openReminderDatePicker}
                      >
                        <CalendarClock size={18} />
                      </button>
                    </div>
                  </label>
                  <label className="quick-link-editor-field reminder-type-field">
                    <span>类型</span>
                    <ThemedSelect
                      compact
                      className="reminder-type-select"
                      value={newReminderType}
                      aria-label="提醒类型"
                      options={reminderTypeOptions}
                      onChange={setNewReminderType}
                    />
                  </label>
                </div>
                <div className="quick-link-editor-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setAddingReminder(false)}
                  >
                    取消
                  </button>
                  <button type="button" className="done-action" onClick={addReminder}>
                    <Plus size={16} />
                    添加
                  </button>
                </div>
              </div>
            )}
          </article>
        </aside>
      </section>
      )}

      {activeMainView === 'review' && (
      <section className="main-view-panel review-view" aria-label="复盘界面">
        <article className="panel ai-review-panel">
          <div className="panel-title review-title">
            <div>
              <Moon size={20} />
              <h2>每日复盘</h2>
            </div>
            <span>{todayIso()}</span>
          </div>

          <section className="review-receipt" aria-label="今日收据">
            <div className="review-section-heading">
              <div>
                <Check size={17} />
                <span>今日收据</span>
              </div>
              <small>{todayArchive ? '今天已归档' : '准备复盘'}</small>
            </div>
            <div className="review-receipt-grid">
              {reviewReceiptItems.map((item) => (
                <div className="review-receipt-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="review-flow" aria-label="三分钟复盘">
            <div className="review-section-heading">
              <div>
                <Pencil size={17} />
                <span>3 分钟复盘</span>
              </div>
              <small>轻一点，写事实就够</small>
            </div>
            <div className="review-grid">
              <label className="review-step">
                <span>1</span>
                <strong>今天推进</strong>
                <textarea
                  value={dashboard.review.did}
                  onChange={(event) => updateReview({ did: event.target.value })}
                  placeholder="三两句就够"
                />
              </label>
              <label className="review-step">
                <span>2</span>
                <strong>卡在哪里</strong>
                <textarea
                  value={dashboard.review.stuck}
                  onChange={(event) => updateReview({ stuck: event.target.value })}
                  placeholder="只记录事实，不审判自己"
                />
              </label>
              <label className="review-step">
                <span>3</span>
                <strong>明天第一步</strong>
                <textarea
                  value={dashboard.review.tomorrow}
                  onChange={(event) => updateReview({ tomorrow: event.target.value })}
                  placeholder="醒来直接做的那一小步"
                />
              </label>
            </div>
          </section>

          <section className="tomorrow-plan" aria-label="布置第二天任务">
            <div className="review-section-heading">
              <div>
                <CalendarClock size={17} />
                <span>布置第二天任务</span>
              </div>
              <small>
                {dashboard.tomorrowTasks.length
                  ? `${dashboard.tomorrowTasks.length} 项`
                  : '归档时会一起保存'}
              </small>
            </div>
            <form
              className="tomorrow-task-form"
              onSubmit={(event) => {
                event.preventDefault()
                addTomorrowTask()
              }}
            >
              <input
                value={newTomorrowTask}
                placeholder="写下明天打开后先处理的任务"
                onChange={(event) => setNewTomorrowTask(event.target.value)}
              />
              <button type="submit" disabled={!newTomorrowTask.trim()}>
                <Plus size={15} />
                添加
              </button>
            </form>
            {dashboard.tomorrowTasks.length ? (
              <>
                <ul className="tomorrow-task-list">
                  {dashboard.tomorrowTasks.map((task, index) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      orderMoveDirection={
                        movedOrderItem?.id === task.id ? movedOrderItem.direction : undefined
                      }
                      onToggle={() => toggleTomorrowTask(task.id)}
                      onRemove={() => removeTomorrowTask(task.id)}
                      onMoveUp={() => moveTomorrowTask(task.id, 'up')}
                      onMoveDown={() => moveTomorrowTask(task.id, 'down')}
                      canMoveUp={index > 0}
                      canMoveDown={index < dashboard.tomorrowTasks.length - 1}
                    />
                  ))}
                </ul>
                <div className="tomorrow-plan-actions">
                  <span>明天打开时，也可以一键带入今日任务。</span>
                  <button type="button" className="secondary-action" onClick={promoteTomorrowTasks}>
                    <SquareCheckBig size={15} />
                    带入今日任务
                  </button>
                </div>
              </>
            ) : (
              <p className="archive-empty">不需要排满，留一两件醒来就能开始的事。</p>
            )}
          </section>

          <section className="review-draft" aria-label="AI 复盘草稿">
            <div className="review-section-heading">
              <div>
                <Sparkles size={17} />
                <span>复盘草稿</span>
              </div>
              <div className="review-actions">
                <button
                  type="button"
                  className={dashboard.ai.enabled ? 'api-active' : ''}
                  onClick={() => setAiSettingsOpen((current) => !current)}
                >
                  <Cpu size={15} />
                  {dashboard.ai.enabled ? 'API 已接入' : '接入 API'}
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void generateReviewSummary()}
                >
                  <Sparkles size={15} />
                  {aiLoading ? '生成中...' : '生成复盘草稿'}
                </button>
              </div>
            </div>
            {aiSettingsOpen && (
              <div className="ai-settings-panel">
                <div className="ai-settings-head">
                  <div>
                    <span>AI API</span>
                    <strong>
                      {dashboard.ai.enabled
                        ? `${dashboard.ai.provider} · ${dashboard.ai.model || '未选模型'}`
                        : '默认使用本地总结'}
                    </strong>
                  </div>
                  <label className="ai-toggle">
                    <input
                      type="checkbox"
                      checked={dashboard.ai.enabled}
                      onChange={(event) =>
                        updateAiSettings({ enabled: event.target.checked })
                      }
                    />
                    <span>{dashboard.ai.enabled ? '已启用' : '未启用'}</span>
                  </label>
                </div>
                <div className="ai-settings-grid">
                  <label className="quick-link-editor-field">
                    <span>提供商</span>
                    <ThemedSelect
                      compact
                      value={dashboard.ai.provider}
                      aria-label="AI 提供商"
                      options={aiProviderOptions}
                      onChange={(provider) => setAiProvider(provider as AiProvider)}
                    />
                  </label>
                  <label className="quick-link-editor-field">
                    <span>API Key</span>
                    <input
                      type="password"
                      value={dashboard.ai.apiKey}
                      placeholder="只保存在本机 localStorage"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(event) =>
                        updateAiSettings({ apiKey: event.target.value })
                      }
                    />
                  </label>
                  <label className="quick-link-editor-field ai-base-field">
                    <span>API 地址</span>
                    <input
                      value={dashboard.ai.baseUrl}
                      placeholder="https://api.openai.com/v1"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(event) =>
                        updateAiSettings({ baseUrl: event.target.value })
                      }
                    />
                  </label>
                  <label className="quick-link-editor-field">
                    <span>模型</span>
                    <input
                      value={dashboard.ai.model}
                      placeholder="gpt-4.1-mini"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(event) =>
                        updateAiSettings({ model: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="ai-settings-note">
                  <span>提示词会自动读取今日任务、项目、暂存、提醒和复盘输入。</span>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setAiSettingsOpen(false)}
                  >
                    完成
                  </button>
                </div>
                {dashboard.ai.enabled && aiSettingsIssue && (
                  <p className="ai-error">{aiSettingsIssue}</p>
                )}
                {aiError && <p className="ai-error">{aiError}</p>}
              </div>
            )}
            <div className="review-summary">
              <div>
                <Sparkles size={17} />
                <span>{summaryModeLabel}</span>
              </div>
              <pre>
                {dashboard.reviewSummary ||
                  '点“生成复盘草稿”后，会根据今天完成项、项目、暂存、提醒和复盘输入生成一段轻量复盘。'}
              </pre>
            </div>
          </section>

          <section className="review-archive-panel" aria-label="归档今天">
            <div>
              <span>{todayArchive ? '今天已归档' : '最后一步'}</span>
              <strong>
                {todayArchive
                  ? `${todayArchive.date} · ${todayArchive.completedTasks.length} 项完成`
                  : '确认无误后归档今天'}
              </strong>
              <small>
                {latestArchive
                  ? `最近归档：${latestArchive.date} · ${latestArchive.completedTasks.length} 项完成`
                  : '还没有归档记录'}
              </small>
            </div>
            <button type="button" onClick={archiveToday}>
              <Archive size={16} />
              {todayArchive ? '更新今天归档' : '归档今天'}
            </button>
            {dataNotice && <em>{dataNotice}</em>}
          </section>

          <section className="archive-history" aria-label="最近归档">
            <div className="review-section-heading">
              <div>
                <Archive size={17} />
                <span>最近归档</span>
              </div>
              <small>
                {recentArchives.length
                  ? `保留 ${dashboard.archives.length} 条 · ${getRetentionLabel(dashboard.retention.reviewArchiveDays)}`
                  : '归档后会出现在这里'}
              </small>
            </div>
            <div className="retention-settings" aria-label="归档清理设置">
              <div>
                <span>本机清理</span>
                <strong>每日复盘 {getRetentionLabel(dashboard.retention.reviewArchiveDays)}</strong>
                <small>导出文件不受应用管理；这里仅清理本机归档记录。</small>
              </div>
              <RetentionControls
                label="复盘归档"
                value={dashboard.retention.reviewArchiveDays}
                onChange={(value) => saveRetentionInput('reviewArchiveDays', value)}
              />
            </div>
            {recentArchives.length ? (
              <>
                <div className="archive-list">
                  {recentArchives.map((archive) => (
                    <button
                      type="button"
                      key={archive.id}
                      className={selectedArchive?.id === archive.id ? 'active' : ''}
                      onClick={() => setExpandedArchiveId(archive.id)}
                    >
                      <span>{archive.date}</span>
                      <strong>{archive.completedTasks.length} 完成</strong>
                      <small>{archive.totalFocusMinutes} 分钟</small>
                    </button>
                  ))}
                </div>
                {selectedArchive && (
                    <div className="archive-detail">
                      <div className="archive-detail-head">
                        <div>
                          <span>{selectedArchive.date}</span>
                          <strong>
                            {selectedArchive.completedTasks.length} 项完成 · {selectedArchive.totalFocusMinutes} 分钟专注
                          </strong>
                        </div>
                        <div className="archive-detail-actions">
                          <small>{new Date(selectedArchive.createdAt).toLocaleTimeString('zh-Hans-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</small>
                          <button
                            type="button"
                            className="icon-button danger"
                            title="删除这条复盘归档"
                            aria-label="删除这条复盘归档"
                            onClick={() => deleteArchive(selectedArchive.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    <div className="archive-detail-grid">
                      <div>
                        <span>完成项</span>
                        <p>
                          {selectedArchive.completedTasks.map((task) => task.title).slice(0, 4).join('、') ||
                            '没有完成项'}
                        </p>
                      </div>
                      <div>
                        <span>遗留项</span>
                        <p>
                          {selectedArchive.openTasks.map((task) => task.title).slice(0, 4).join('、') ||
                            '没有遗留项'}
                        </p>
                      </div>
                      <div>
                        <span>明日任务</span>
                        <p>
                          {selectedArchive.tomorrowTasks.map((task) => task.title).slice(0, 4).join('、') ||
                            '没有布置'}
                        </p>
                      </div>
                    </div>
                    <pre>{selectedArchive.summary}</pre>
                  </div>
                )}
              </>
            ) : (
              <p className="archive-empty">完成一次复盘归档后，可以在这里翻看最近记录。</p>
            )}
          </section>
        </article>
      </section>
      )}

      {commandOpen && (
        <div
          className="command-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setCommandOpen(false)}
        >
          <div className="command-panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="command-search">
              <Search size={19} />
              <input
                autoFocus
                aria-label="搜索命令"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={commandQuery}
                placeholder="搜索链接、任务、项目、灵感..."
                onChange={(event) => setCommandQuery(event.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                aria-label="关闭命令面板"
                title="关闭命令面板"
                onClick={() => setCommandOpen(false)}
              >
                <X size={18} />
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

      {pendingFocusProject && (
        <div
          className="command-overlay focus-dialog-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setPendingFocusProjectId(null)}
        >
          <div className="focus-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="focus-dialog-head">
              <div>
                <span>项目专注</span>
                <strong>{pendingFocusProject.name}</strong>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭专注设置"
                title="关闭"
                onClick={() => setPendingFocusProjectId(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="focus-dialog-target">
              <span>本轮目标</span>
              <strong>{pendingFocusProject.nextAction}</strong>
            </div>
            <div className="focus-duration-presets" aria-label="选择专注时长">
              {[15, 25, 30, 45, 60].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={pendingFocusMinutes === minutes ? 'active' : ''}
                  onClick={() => setPendingFocusMinutes(minutes)}
                >
                  {minutes}
                  <small>分钟</small>
                </button>
              ))}
            </div>
            <div className="focus-dialog-stepper">
              <button
                type="button"
                title="减少 5 分钟"
                onClick={() => setPendingFocusMinutes((minutes) => Math.max(5, minutes - 5))}
              >
                <Minus size={16} />
              </button>
              <div>
                <strong>{pendingFocusMinutes}</strong>
                <span>分钟</span>
              </div>
              <button
                type="button"
                title="增加 5 分钟"
                onClick={() => setPendingFocusMinutes((minutes) => Math.min(120, minutes + 5))}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="focus-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setPendingFocusProjectId(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={startPendingProjectFocus}
              >
                <Play size={16} />
                开始并切到聚焦
              </button>
            </div>
          </div>
        </div>
      )}

      {quoteManagerOpen && (
        <div
          className="command-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setQuoteManagerOpen(false)}
        >
          <div className="quote-panel" onMouseDown={(event) => event.stopPropagation()}>
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

export default App
