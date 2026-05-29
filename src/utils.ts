import type { DailyReview, InboxItem, Task } from './types'

export const uid = () => crypto.randomUUID()

export const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const startOfLocalDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return startOfLocalDay()
  return new Date(year, month - 1, day)
}

export const todayIso = () => formatLocalDate()

export const dateAfter = (days: number) => {
  const date = startOfLocalDay()
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

export const normalizeHttpUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export const downloadTextFile = (
  filename: string,
  text: string,
  type = 'application/json',
) => {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })

export const buildLocalSummary = (
  review: DailyReview,
  completedTasks: Task[],
  openTasks: Task[],
  inbox: InboxItem[],
) => {
  const did =
    review.did.trim() ||
    (completedTasks.length
      ? `完成了 ${completedTasks.slice(0, 3).map((task) => task.title).join('、')}`
      : '今天还没有记录明确完成项')
  const stuck = review.stuck.trim() || '没有记录明显卡点'
  const tomorrow =
    review.tomorrow.trim() ||
    openTasks[0]?.title ||
    inbox[0]?.text ||
    '先写下明天醒来能直接开始的一小步'

  return [
    `今日推进：${did}`,
    `卡点观察：${stuck}`,
    `明天第一步：${tomorrow}`,
  ].join('\n')
}

export const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('zh-Hans-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('zh-Hans-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)

export const formatMinutes = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export const daysUntil = (dateString: string) => {
  const today = startOfLocalDay()
  const target = parseLocalDate(dateString)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}
