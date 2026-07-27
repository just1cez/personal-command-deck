/**
 * 提醒与倒计时。
 */
import { URGENT_REMINDER_DAYS } from '../config/constants'
import type { Reminder } from '../types'
import { daysUntil, uid } from '../utils'

/** 按剩余天数升序排序（已过期的排最前）。返回新数组，不改动入参。 */
export const sortRemindersByDate = (reminders: Reminder[]) =>
  reminders.slice().sort((a, b) => daysUntil(a.date) - daysUntil(b.date))

/**
 * 这条提醒是否要标红。
 * 注意包含**已过期**（天数为负）的情况——过期的提醒更需要被看见。
 */
export const isUrgentReminder = (days: number) => days <= URGENT_REMINDER_DAYS

/**
 * 首页"临近提醒"信号灯的计数。
 * 与 {@link isUrgentReminder} 不同，这里**不含已过期**：
 * 信号灯回答的是"接下来几天有几件事要做"，过期的事不该继续占用注意力。
 */
export const countUpcomingUrgentReminders = (reminders: Reminder[]) =>
  reminders.filter((reminder) => {
    const days = daysUntil(reminder.date)
    return days >= 0 && days <= URGENT_REMINDER_DAYS
  }).length

/** 倒计时文案。 */
export const formatCountdown = (days: number) => {
  if (days < 0) return '已过'
  if (days === 0) return '今天'
  return `${days} 天`
}

export const createReminder = (title: string, date: string, type: string): Reminder => ({
  id: uid(),
  title,
  date,
  type,
})
