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
import { getDesktopBridge, requestStorageFlush } from '../services/desktopBridge'
import { applyNoteCommand } from '../domain/desktopNoteCommands'
import type { NoteCommand, NoteResult } from '../domain/desktopNoteCommands'
import type { Dispatch, SetStateAction } from 'react'
import type { DashboardState } from '../types'
import type { DashboardStore, UpdateDashboard } from './deckContext'
import { prepareNoteEditors, releaseNoteEditors } from '../services/noteEditor'
import { loadDashboardWithStatus, saveDashboardState } from './storage'

export const useDashboardState = (): DashboardStore => {
  // 惰性初始化：读盘 + 规范化只在首次渲染时做一次。
  const [loaded] = useState(loadDashboardWithStatus)
  const [committed, setCommitted] = useState<{
    dashboard: DashboardState; version: number; receipts: Map<string, string | undefined>; receipt?: NoteResult
  }>(() => ({ dashboard: loaded.dashboard, version: 0, receipts: new Map() }))
  const { dashboard } = committed
  const setDashboard = useCallback<Dispatch<SetStateAction<DashboardState>>>((updater) => {
    setCommitted(current => {
      const next = typeof updater === 'function' ? updater(current.dashboard) : updater
      return next === current.dashboard ? current : { ...current, dashboard: next, version: current.version + 1 }
    })
  }, [])
  // 命令收据和业务状态在同一次提交中生成；重试仅触发重新保存，不重做业务动作。
  useEffect(() => getDesktopBridge()?.onDesktopNoteCommand?.((command: NoteCommand) => {
    debugLog('store', `动作 桌面便笺 ${command.type}`)
    setCommitted(current => {
      const result = current.receipts.has(command.requestId)
        ? { dashboard: current.dashboard, error: current.receipts.get(command.requestId) }
        : applyNoteCommand(current.dashboard, command)
      const receipts = new Map(current.receipts)
      receipts.set(command.requestId, result.error)
      const version = current.version + 1
      return { dashboard: result.dashboard, receipts, version,
        receipt: { requestId: command.requestId, version, accepted: !result.error, error: result.error } }
    })
  }), [])
  const [notice, setNotice] = useState(loaded.notice)

  useEffect(() => {
    const bridge = getDesktopBridge()
    const unprepare = bridge?.onNotePrepare?.(prepareNoteEditors)
    const unrelease = bridge?.onNoteRelease?.(releaseNoteEditors)
    return () => { unprepare?.(); unrelease?.() }
  }, [])

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
  }, [setDashboard])

  // 提示条自动消失：它占着聚焦页和复盘页的一行位置，留太久会盖住常驻说明文案。
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), NOTICE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timeout)
  }, [notice])

  // 持久化 + 主题同步。两件事都只依赖最终状态，放同一个 effect 里最直观。
  useEffect(() => {
    const saved = saveDashboardState(dashboard)
    const bridge = getDesktopBridge()
    if (!saved) {
      queueNotice(NOTICE.storageFailure)
    } else {
      requestStorageFlush()
      void bridge?.syncDesktopNotes?.(dashboard.desktopNotes, committed.version).catch(() => undefined)
    }
    if (committed.receipt) bridge?.acknowledgeNoteCommand?.({ ...committed.receipt,
      version: committed.version,
      accepted: saved && committed.receipt.accepted,
      error: saved ? committed.receipt.error : NOTICE.storageFailure,
    })
    document.documentElement.dataset.theme = dashboard.theme
    document.documentElement.dataset.mode = dashboard.dayMode
  }, [committed, dashboard, queueNotice])

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
