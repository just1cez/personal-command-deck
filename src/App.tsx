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
  defaultState,
  dayModeOptions,
  fallbackQuote,
  getQuoteById,
  linkIconOptions,
  loadState,
  normalizeQuotes,
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
  const [movedOrderItem, setMovedOrderItem] = useState<{
    id: string
    direction: 'up' | 'down'
  } | null>(null)
  const weatherRequestId = useRef(0)

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
  const activeProject = dashboard.projects.find(
    (project) => project.id === dashboard.focus.projectId,
  )
  const completionRate = dashboard.tasks.length
    ? Math.round((completedTasks / dashboard.tasks.length) * 100)
    : 0
  const priorityTopTask = topTasks.find((task) => !task.done)
  const priorityTodo = todos.find((task) => !task.done)
  const suggestedProject =
    activeProject ?? dashboard.projects.find((project) => project.active) ?? dashboard.projects[0]
  const defaultFocusProject =
    dashboard.projects.find((project) => project.name === '个人指挥台') ??
    dashboard.projects.find((project) => project.active) ??
    dashboard.projects[0]
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
  const totalFocusMinutes = dashboard.projects.reduce(
    (total, project) => total + project.minutes,
    0,
  )
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
  const latestArchive = dashboard.archives[0]
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
        { id: uid(), name, nextAction, minutes: 0, active: true },
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
    updateDashboard((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      focus:
        current.focus.projectId === id
          ? { ...current.focus, projectId: '', running: false }
          : current.focus,
    }))
  }

  const moveProject = (id: string, direction: 'up' | 'down') => {
    let moved = false
    updateDashboard((current) => {
      const index = current.projects.findIndex((project) => project.id === id)
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || targetIndex < 0 || targetIndex >= current.projects.length) {
        return current
      }

      const projects = [...current.projects]
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
      const isSamePausedFocus =
        !current.focus.running &&
        current.focus.projectId === project.id &&
        current.focus.taskLabel === nextLabel &&
        current.focus.secondsLeft > 0 &&
        current.focus.secondsLeft < current.focus.durationMinutes * 60

      return {
        ...current,
        currentFocus: nextLabel,
        focus: {
          ...current.focus,
          running: true,
          projectId: project.id,
          taskLabel: nextLabel,
          secondsLeft: isSamePausedFocus
            ? current.focus.secondsLeft
            : current.focus.durationMinutes * 60,
        },
      }
    })
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
        secondsLeft: current.focus.running
          ? current.focus.secondsLeft
          : durationMinutes * 60,
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
          reviewSummary: buildLocalSummary(current.review, completed, open, current.inbox),
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
      const completed = current.tasks.filter((task) => task.done)
      const open = current.tasks.filter((task) => !task.done)
      const summary =
        current.reviewSummary ||
        buildLocalSummary(current.review, completed, open, current.inbox)
      const archive: DailyArchive = {
        id: uid(),
        date: todayIso(),
        createdAt: new Date().toISOString(),
        completedTasks: completed,
        openTasks: open,
        inbox: current.inbox,
        review: current.review,
        summary,
        totalFocusMinutes: current.projects.reduce(
          (total, project) => total + project.minutes,
          0,
        ),
      }

      return {
        ...current,
        archives: [
          archive,
          ...current.archives.filter((item) => item.date !== archive.date),
        ].slice(0, 60),
        reviewSummary: summary,
      }
    })
    setDataNotice('已归档今天')
  }

  const exportBackup = () => {
    const backup: DashboardBackup = {
      app: 'Personal Command Deck',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: dashboard,
    }
    downloadTextFile(
      `personal-command-deck-${todayIso()}.json`,
      JSON.stringify(backup, null, 2),
    )
    setDataNotice('已导出备份')
  }

  const importBackup = async (file: File) => {
    try {
      const text = await readFileAsText(file)
      const parsed = JSON.parse(text) as Partial<DashboardBackup> | StoredDashboardState
      const incoming =
        'state' in parsed && parsed.state
          ? (parsed.state as StoredDashboardState)
          : (parsed as StoredDashboardState)
      const quotes = normalizeQuotes(incoming)
      setDashboard({
        ...defaultState,
        ...incoming,
        motto: undefined,
        ...quotes,
        weather: { ...defaultState.weather, ...incoming.weather },
        focus: { ...defaultState.focus, ...incoming.focus, running: false },
        review: { ...defaultState.review, ...incoming.review },
        ai: { ...defaultState.ai, ...incoming.ai },
        tasks: incoming.tasks?.length ? incoming.tasks : defaultState.tasks,
        projects: incoming.projects?.length ? incoming.projects : defaultState.projects,
        quickLinks: incoming.quickLinks?.length
          ? incoming.quickLinks
          : defaultState.quickLinks,
        reminders: incoming.reminders?.length
          ? incoming.reminders
          : defaultState.reminders,
        inbox: incoming.inbox ?? defaultState.inbox,
        archives: incoming.archives ?? defaultState.archives,
        reviewSummary: incoming.reviewSummary ?? defaultState.reviewSummary,
      })
      setDataNotice('已导入备份')
    } catch {
      setDataNotice('导入失败：文件格式不对')
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

        <div className="data-actions" aria-label="本地数据">
          <button type="button" title="导出本地备份" onClick={exportBackup}>
            <Download size={15} />
            导出
          </button>
          <label title="导入本地备份">
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

      <section className="execution-hero" aria-label="执行启动区">
        <article className="panel focus-start-panel">
          <PanelTitle icon={<Focus size={20} />} title="今日专注" aside={`${completionRate}%`} />
          <div className="focus-priority">
            <span>本轮目标</span>
            <strong>{focusTarget.label}</strong>
            <small className="focus-source">{focusTarget.source}</small>
          </div>
          <FocusControls
            dashboard={dashboard}
            focusLabel={dashboard.focus.running ? dashboard.currentFocus : focusTarget.label}
            onDurationChange={setFocusDuration}
            onStart={() => startFocus(defaultFocusProject?.id, focusTarget.label)}
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
            ))}
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

      <section className="execution-grid" aria-label="个人作战桌面">
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
            {dashboard.projects.map((project, index) => {
              const isEditing = editingProjectId === project.id
              const canMoveUp = index > 0
              const canMoveDown = index < dashboard.projects.length - 1
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
                            className="primary-action project-focus-action"
                            onClick={() => startFocus(project.id, project.nextAction)}
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
          </div>
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
                  <label className="quick-link-editor-field">
                    <span>日期</span>
                    <input
                      type="date"
                      value={newReminderDate}
                      onChange={(event) => setNewReminderDate(event.target.value)}
                    />
                  </label>
                  <label className="quick-link-editor-field">
                    <span>类型</span>
                    <input
                      value={newReminderType}
                      placeholder="Deadline"
                      onChange={(event) => setNewReminderType(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') addReminder()
                      }}
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

      <section className="execution-review" aria-label="AI 每日总结">
        <article className="panel ai-review-panel">
          <div className="panel-title panel-title-action">
            <div>
              <Moon size={20} />
              <h2>收工复盘</h2>
            </div>
            <div className="review-actions">
              <span>{todayIso()}</span>
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
                {aiLoading ? '生成中...' : '生成总结'}
              </button>
              <button type="button" onClick={archiveToday}>
                <Archive size={15} />
                归档今天
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
          <div className="review-summary">
            <div>
              <Sparkles size={17} />
              <span>{summaryModeLabel}</span>
            </div>
            <pre>
              {dashboard.reviewSummary ||
                '点“生成总结”后，会根据今天完成项、项目、暂存、提醒和复盘输入生成一段轻量复盘。'}
            </pre>
          </div>
          <div className="archive-strip">
            <span>
              {latestArchive
                ? `最近归档：${latestArchive.date} · ${latestArchive.completedTasks.length} 项完成`
                : '还没有归档记录'}
            </span>
            {dataNotice && <strong>{dataNotice}</strong>}
          </div>
        </article>
      </section>

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
