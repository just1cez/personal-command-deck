/**
 * 仪表盘数据的唯一持有者。
 *
 * 职责：
 * - 首次渲染时从 localStorage 恢复状态；
 * - 每次状态变化后写盘，并把主题/模式同步到 `<html>` 的 data 属性上（CSS 变量靠它切换）；
 * - 提供带动作名的 `updateDashboard`，让每一次改动在调试日志里都有名字；
 * - 挂载 `window.commandDeckDebug` 调试入口。
 *
 * 这里刻意**不放任何业务规则**——业务规则在 domain/，动作编排在 actions/。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NOTICE, NOTICE_AUTO_DISMISS_MS } from '../config/constants'
import {
  computeProjectStats,
  computeReminderStats,
  computeTaskStats,
} from '../domain/stats'
import { debugLog, installDebugBridge } from '../debug'
import { requestStorageFlush } from '../services/desktopBridge'
import type { DashboardState } from '../types'
import type { DashboardStore, UpdateDashboard } from './deckContext'
import { loadDashboardState, saveDashboardState } from './storage'

export const useDashboardState = (): DashboardStore => {
  // 惰性初始化：读盘 + 规范化只在首次渲染时做一次。
  const [dashboard, setDashboard] = useState<DashboardState>(() => loadDashboardState())
  const [notice, setNotice] = useState('')

  // 分三组各自 memo：专注计时每秒只动 focus 字段，
  // 这样项目和提醒的派生结果能保持同一份引用，下游的 useMemo 不会被无谓地打断。
  const { tasks, projects, reminders } = dashboard
  const taskStats = useMemo(() => computeTaskStats(tasks), [tasks])
  const projectStats = useMemo(() => computeProjectStats(projects), [projects])
  const reminderStats = useMemo(() => computeReminderStats(reminders), [reminders])
  const stats = useMemo(
    () => ({ ...taskStats, ...projectStats, ...reminderStats }),
    [projectStats, reminderStats, taskStats],
  )

  const showNotice = useCallback((text: string) => setNotice(text), [])

  // 延后一拍，保证调用方即使身处 setState 的 updater 中也不会触发嵌套更新。
  const queueNotice = useCallback((text: string) => {
    window.setTimeout(() => setNotice(text), 0)
  }, [])

  const updateDashboard = useCallback<UpdateDashboard>((updater, action = 'update') => {
    // 在 setState 之外打日志：updater 在开发模式下会被 React 调用两次，
    // 写在里面会导致每个动作打印两遍。
    debugLog('store', `动作 ${action}`)
    setDashboard(updater)
  }, [])

  // 提示条自动消失：它占着聚焦页和复盘页的一行位置，留太久会盖住常驻说明文案。
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), NOTICE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timeout)
  }, [notice])

  // 持久化 + 主题同步。两件事都只依赖最终状态，放同一个 effect 里最直观。
  useEffect(() => {
    if (!saveDashboardState(dashboard)) {
      queueNotice(NOTICE.storageFailure)
    } else {
      requestStorageFlush()
    }
    document.documentElement.dataset.theme = dashboard.theme
    document.documentElement.dataset.mode = dashboard.dayMode
  }, [dashboard, queueNotice])

  // 调试入口需要读到"最新"状态，用 ref 桥接，避免每次状态变化都重挂一次。
  const dashboardRef = useRef(dashboard)
  useEffect(() => {
    dashboardRef.current = dashboard
  }, [dashboard])

  useEffect(() => installDebugBridge(() => dashboardRef.current), [])

  return {
    dashboard,
    stats,
    setDashboard,
    updateDashboard,
    notice,
    showNotice,
    queueNotice,
  }
}
