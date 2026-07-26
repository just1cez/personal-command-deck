/**
 * "随手记"三件套：灵感暂存箱、快捷入口、提醒。
 *
 * 它们共同的特点是结构简单、都由一个小表单驱动，所以放在同一个文件里，
 * 通过三个独立的 hook 暴露，组件按需取用。
 */
import { useCallback } from 'react'
import { NOTICE } from '../config/constants'
import { createReminder, sortRemindersByDate } from '../domain/reminders'
import { useDashboardStore } from '../state/deckContext'
import type { QuickLink } from '../types'
import { normalizeHttpUrl, uid } from '../utils'

/* -------------------------------------------------------------------------- */
/* 灵感暂存箱                                                                  */
/* -------------------------------------------------------------------------- */

export const useInboxActions = () => {
  const { updateDashboard } = useDashboardStore()

  const addInboxItem = useCallback(
    (rawText: string) => {
      const text = rawText.trim()
      if (!text) return false

      updateDashboard(
        (current) => ({
          ...current,
          // 新灵感放最前面：刚记下的东西通常也最需要马上被处理。
          inbox: [{ id: uid(), text, createdAt: new Date().toISOString() }, ...current.inbox],
        }),
        '收纳灵感',
      )
      return true
    },
    [updateDashboard],
  )

  const removeInboxItem = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({ ...current, inbox: current.inbox.filter((item) => item.id !== id) }),
        '删除灵感',
      )
    },
    [updateDashboard],
  )

  return { addInboxItem, removeInboxItem }
}

/* -------------------------------------------------------------------------- */
/* 快捷入口                                                                    */
/* -------------------------------------------------------------------------- */

export const useQuickLinkActions = () => {
  const { updateDashboard, showNotice } = useDashboardStore()

  const addQuickLink = useCallback(
    (rawLabel: string, rawUrl: string, icon: string) => {
      const label = rawLabel.trim()
      const url = normalizeHttpUrl(rawUrl)
      // url 为空说明协议不合法或格式不对，这类入口不允许创建。
      if (!label || !url) return false

      updateDashboard(
        (current) => ({
          ...current,
          quickLinks: [...current.quickLinks, { id: uid(), label, url, icon }],
        }),
        '添加快捷入口',
      )
      return true
    },
    [updateDashboard],
  )

  const updateQuickLink = useCallback(
    (id: string, patch: Partial<QuickLink>) => {
      updateDashboard(
        (current) => ({
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
        }),
        '编辑快捷入口',
      )
    },
    [updateDashboard],
  )

  /** 提交链接编辑：非法链接直接忽略，保留原来的地址。 */
  const commitQuickLinkUrl = useCallback(
    (id: string, value: string) => {
      const normalized = normalizeHttpUrl(value)
      if (!normalized) return
      updateQuickLink(id, { url: normalized })
    },
    [updateQuickLink],
  )

  const removeQuickLink = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          quickLinks: current.quickLinks.filter((item) => item.id !== id),
        }),
        '删除快捷入口',
      )
    },
    [updateDashboard],
  )

  /**
   * 打开外部链接。
   * 每次点击都重新校验一遍协议——历史数据可能是在校验规则更严之前存进去的。
   * `noopener,noreferrer` 用于切断新窗口对本页的引用。
   */
  const openQuickLink = useCallback(
    (url: string) => {
      const safeUrl = normalizeHttpUrl(url)
      if (!safeUrl) {
        showNotice(NOTICE.invalidLink)
        return
      }
      window.open(safeUrl, '_blank', 'noopener,noreferrer')
    },
    [showNotice],
  )

  return {
    addQuickLink,
    updateQuickLink,
    commitQuickLinkUrl,
    removeQuickLink,
    openQuickLink,
  }
}

/* -------------------------------------------------------------------------- */
/* 提醒                                                                        */
/* -------------------------------------------------------------------------- */

export const useReminderActions = () => {
  const { updateDashboard } = useDashboardStore()

  /** 新增提醒后立刻按日期排序，保证列表里"最近的排最前"这一约定始终成立。 */
  const addReminder = useCallback(
    (rawTitle: string, date: string, type: string) => {
      const title = rawTitle.trim()
      if (!title || !date) return false

      updateDashboard(
        (current) => ({
          ...current,
          reminders: sortRemindersByDate([
            ...current.reminders,
            createReminder(title, date, type),
          ]),
        }),
        '添加提醒',
      )
      return true
    },
    [updateDashboard],
  )

  const removeReminder = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          reminders: current.reminders.filter((item) => item.id !== id),
        }),
        '删除提醒',
      )
    },
    [updateDashboard],
  )

  return { addReminder, removeReminder }
}
