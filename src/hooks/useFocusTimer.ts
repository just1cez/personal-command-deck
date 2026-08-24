/**
 * 专注倒计时的心跳。
 *
 * 每秒做的事只有两件：
 * 1. 用 `endsAt` 重新推算剩余秒数（不是自减，见 domain/focus.ts 的说明）；
 * 2. 到点后结算这一轮并把会话复位。
 *
 * 只有 `running` 为真时才挂定时器，空闲时完全没有开销。
 */
import { useEffect } from 'react'
import { FOCUS_TICK_MS, IDLE_FOCUS_LABEL } from '../config/constants'
import {
  getFocusSecondsLeft,
  getFocusSegmentSeconds,
  resetFocusSession,
  settleFocusSegment,
} from '../domain/focus'
import { notifyFocusComplete } from '../services/notifications'
import { useDashboardStore } from '../state/deckContext'

export const useFocusTimer = () => {
  const { dashboard, setDashboard, queueNotice } = useDashboardStore()
  const running = dashboard.focus.running

  useEffect(() => {
    if (!running) return

    const syncFocusClock = () => {
      // 这是每秒都会跑的心跳，直接用原始 setter：
      // 走 updateDashboard 会让调试日志被"对时"刷屏。
      setDashboard((current) => {
        if (!current.focus.running) return current

        const secondsLeft = getFocusSecondsLeft(current.focus.endsAt)
        if (secondsLeft > 0) {
          // 秒数没变就返回原对象，避免每秒都产生一次无意义的重渲染与写盘。
          return secondsLeft === current.focus.secondsLeft
            ? current
            : { ...current, focus: { ...current.focus, secondsLeft } }
        }

        // 本轮自然结束。至少记 1 秒，保证"跑完一轮"一定留下痕迹。
        const elapsedSeconds = Math.max(
          1,
          getFocusSegmentSeconds(current.focus.startedAt, current.focus.endsAt),
        )
        const { projects, tasks, focusRecords, notice } = settleFocusSegment(
          current,
          elapsedSeconds,
          'completed',
          current.focus.endsAt ?? new Date().toISOString(),
        )
        if (notice) queueNotice(notice)

        // 用户很可能已经切到别的窗口了，界面里的提示看不见，补一条系统通知。
        // 延后一拍发出，避免在计算新状态的过程中触发副作用。
        const finishedLabel = current.focus.taskLabel
        window.setTimeout(() => notifyFocusComplete(finishedLabel, notice), 0)

        return {
          ...current,
          projects,
          tasks,
          focusRecords,
          currentFocus: IDLE_FOCUS_LABEL,
          focus: resetFocusSession(current.focus),
        }
      })
    }

    // 立刻对一次时：从后台切回来时不用等满一秒才刷新。
    syncFocusClock()
    const interval = window.setInterval(syncFocusClock, FOCUS_TICK_MS)
    return () => window.clearInterval(interval)
  }, [queueNotice, running, setDashboard])
}
