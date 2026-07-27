/**
 * 每秒走一次的时钟。
 *
 * 除了顶栏显示时间，它还是"跨天"的触发源：
 * App 把它格式化成本地日期字符串后交给 useDailyCarryover，
 * 日期串没变就不会触发任何重算。
 */
import { useEffect, useState } from 'react'
import { CLOCK_TICK_MS } from '../config/constants'

export const useClock = () => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => window.clearInterval(interval)
  }, [])

  return now
}
