/**
 * 与业务无关的通用工具：日期、数值、URL、文件。
 *
 * 判断一个函数该不该放这里：它是否只依赖入参、不认识 DashboardState？
 * 认识业务模型的逻辑请放 `domain/`，认识存储格式的请放 `state/`。
 */
import { DAY_MS, ERROR_TEXT, PROGRESS_STEP } from './config/constants'

/* -------------------------------------------------------------------------- */
/* 标识符                                                                      */
/* -------------------------------------------------------------------------- */

/** 生成实体 id。Electron 与现代浏览器都支持 crypto.randomUUID。 */
export const uid = () => crypto.randomUUID()

/* -------------------------------------------------------------------------- */
/* 日期                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 格式化为**本地时区**的 `YYYY-MM-DD`。
 * 刻意不用 `toISOString()`：那会转成 UTC，东八区凌晨会得到前一天，导致跨天逻辑出错。
 */
export const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 本地时区当天的 00:00:00，用于按"天"做差值计算。 */
export const startOfLocalDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** 解析 `YYYY-MM-DD` 为本地时区的当天零点；解析失败回落到今天。 */
export const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return startOfLocalDay()
  return new Date(year, month - 1, day)
}

export const todayIso = () => formatLocalDate()

/** 今天往后 n 天的 `YYYY-MM-DD`（n 可以为负）。 */
export const dateAfter = (days: number) => {
  const date = startOfLocalDay()
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

/** 距离目标日期还有几天：0 = 今天，负数 = 已过期。 */
export const daysUntil = (dateString: string) => {
  const today = startOfLocalDay()
  const target = parseLocalDate(dateString)
  // 两端都是本地零点，round 可消化跨夏令时产生的 ±1 小时偏差
  return Math.round((target.getTime() - today.getTime()) / DAY_MS)
}

/* -------------------------------------------------------------------------- */
/* 展示格式化                                                                  */
/* -------------------------------------------------------------------------- */

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

/** 秒 -> `MM:SS`，用于专注倒计时。 */
export const formatMinutes = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/* -------------------------------------------------------------------------- */
/* 数值                                                                        */
/* -------------------------------------------------------------------------- */

/** 把数值夹在 [min, max] 区间内。 */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** 规范化完成度：夹到 0-100 并对齐到 PROGRESS_STEP 的整数倍。 */
export const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return clamp(Math.round(value / PROGRESS_STEP) * PROGRESS_STEP, 0, 100)
}

/* -------------------------------------------------------------------------- */
/* URL                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 规范化用户输入的链接，只放行 http/https。
 * 返回空字符串表示"这个链接不可用"，调用方需要据此提示用户或禁用跳转。
 *
 * 这是一道安全边界：阻止 `javascript:`、`file:` 等协议被写进快捷入口。
 */
export const normalizeHttpUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  // 没写协议时按 https 补全，方便用户直接粘贴 `example.com`。
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

/* -------------------------------------------------------------------------- */
/* 文件                                                                        */
/* -------------------------------------------------------------------------- */

/** 触发浏览器下载一段文本（导出备份用）。 */
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

/** 读取用户选择的文件为文本（导入备份用）。 */
export const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(ERROR_TEXT.fileReadFailed))
    reader.readAsText(file)
  })
