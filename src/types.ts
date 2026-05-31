import type { ReactNode } from 'react'

export type Theme = 'dark' | 'clean' | 'cyber' | 'paper'
export type DayMode = '工作日' | '周末' | '冲刺' | '摸鱼恢复'
export type TaskKind = 'top' | 'todo'
export type AiProvider = 'openai' | 'deepseek' | 'moonshot' | 'custom'

export type Task = {
  id: string
  title: string
  done: boolean
  kind: TaskKind
}

export type Project = {
  id: string
  name: string
  nextAction: string
  minutes: number
  focusSeconds: number
  active: boolean
  completedAt?: string
}

export type QuickLink = {
  id: string
  label: string
  url: string
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
  date: string
  type: string
}

export type DailyReview = {
  did: string
  stuck: string
  tomorrow: string
}

export type DailyArchive = {
  id: string
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

export type SelectOption = {
  value: string
  label: string
  icon?: ReactNode
}

export type Weather = {
  icon: string
  temp: string
  label: string
  condition?: string
  humidity?: string
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

export type Quote = {
  id: string
  text: string
  author: string
  enabled: boolean
}

export type DailyQuote = {
  date: string
  quoteId: string
}

export type FocusSession = {
  running: boolean
  secondsLeft: number
  durationMinutes: number
  projectId: string
  taskLabel: string
  endsAt?: string
  startedAt?: string
}

export type AiSettings = {
  enabled: boolean
  provider: AiProvider
  apiKey: string
  baseUrl: string
  model: string
}

export type RetentionSettings = {
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

export type DashboardState = {
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

export type StoredDashboardState = Partial<DashboardState> & {
  motto?: string
}

export type DashboardBackup = {
  app: 'Personal Command Deck'
  version: 1
  exportedAt: string
  state: DashboardState
}
