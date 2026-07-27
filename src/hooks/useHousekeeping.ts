/**
 * 三个"后台自动维护"的定时任务。
 *
 * 它们的共同点：周期性触发、绝大多数时候什么都不做、用户不需要感知。
 * 因此都直接用 `setDashboard` 而不是 `updateDashboard`——
 * 后者会往调试日志里写动作名，被每分钟/每小时的空跑刷屏就没法用了。
 *
 * 三个 updater 都遵守"没有变化就原样返回 current"，这样 React 会跳过重渲染，
 * 也不会触发无谓的写盘。
 */
import { useEffect } from 'react'
import {
  DAILY_QUOTE_TICK_MS,
  NOTICE,
  RETENTION_SWEEP_MS,
} from '../config/constants'
import { applyRetentionPolicy } from '../domain/retention'
import { carryTomorrowTasksIntoToday, countCarryableTomorrowTasks } from '../domain/tasks'
import { useDashboardStore } from '../state/deckContext'
import { resolveDailyQuote } from '../state/quotes'

/**
 * 每日名言的跨天检查。
 * 应用可能连开好几天，靠定时检查而不是启动时检查才能真正"每天一句"。
 */
export const useDailyQuoteSync = () => {
  const { setDashboard } = useDashboardStore()

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDashboard((current) => {
        const resolved = resolveDailyQuote(current.quotePool, current.dailyQuote)
        const unchanged =
          resolved.date === current.dailyQuote.date &&
          resolved.quoteId === current.dailyQuote.quoteId
        return unchanged ? current : { ...current, dailyQuote: resolved }
      })
    }, DAILY_QUOTE_TICK_MS)

    return () => window.clearInterval(interval)
  }, [setDashboard])
}

/**
 * 跨天把"明日任务"搬进今日。
 *
 * @param currentLocalDate 由时钟派生的本地日期串；只有它变了才会重新检查。
 *
 * 用 setTimeout(0) 而不是直接执行：避免在 effect 里同步触发一次状态更新，
 * 让首帧先把界面画出来。
 */
export const useDailyCarryover = (currentLocalDate: string) => {
  const { updateDashboard, queueNotice } = useDashboardStore()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      updateDashboard((current) => {
        // 今天已经搬过了（或数据来自未来），什么都不做。
        if (current.dailyCarryoverDate >= currentLocalDate) return current

        const carriedCount = countCarryableTomorrowTasks(current.tomorrowTasks)
        if (carriedCount) queueNotice(NOTICE.tomorrowTasksCarried(carriedCount))
        return carryTomorrowTasksIntoToday(current, currentLocalDate)
      }, '跨天搬运明日任务')
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [currentLocalDate, queueNotice, updateDashboard])
}

/** 每小时按保留策略清理一次过期归档与已结项项目。 */
export const useRetentionSweep = () => {
  const { setDashboard } = useDashboardStore()

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDashboard((current) => {
        const retained = applyRetentionPolicy(
          current.archives,
          current.projects,
          current.retention,
        )
        const unchanged =
          retained.archives.length === current.archives.length &&
          retained.projects.length === current.projects.length
        return unchanged ? current : { ...current, ...retained }
      })
    }, RETENTION_SWEEP_MS)

    return () => window.clearInterval(interval)
  }, [setDashboard])
}
