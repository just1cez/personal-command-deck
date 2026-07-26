/**
 * 读取"不可信数据"的取值助手。
 *
 * localStorage 和导入的备份文件都可能是任意 JSON：字段缺失、类型不对、被手改过。
 * 这里的函数统一遵守一个原则——**永不抛异常，永远返回可用的值**，
 * 让上层的规范化逻辑可以线性书写，不用到处套 try/catch 或类型判断。
 */
import { formatLocalDate } from '../utils'

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const textValue = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

export const trimmedText = (value: unknown, fallback = '') =>
  textValue(value, fallback).trim()

export const booleanValue = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

/** 取数值并夹到 [min, max]；非数字（含 NaN/Infinity）回落到 fallback。 */
export const clampedNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/** 是否是可被 Date 解析的 ISO 时间戳。 */
export const isIsoDateTime = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  return Number.isFinite(new Date(value).getTime())
}

/**
 * 是否是合法的本地日历日 `YYYY-MM-DD`。
 * 除了格式，还要求"回写后与原串相同"，这样 `2026-02-31` 这类不存在的日期会被拒绝。
 */
export const isLocalDateString = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return formatLocalDate(new Date(year, month - 1, day)) === value
}
