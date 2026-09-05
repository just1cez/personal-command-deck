/**
 * localStorage 读写。
 *
 * 这一层是应用里**唯一**直接碰 localStorage 的地方（调试开关除外），
 * 所有异常都在这里被吞掉并转换成返回值，调用方不需要写 try/catch。
 *
 * 为什么要吞异常：浏览器隐私模式、磁盘配额写满、Electron 沙箱异常都会让
 * localStorage 抛错，但这些都不该让整个面板崩掉——大不了这次不持久化。
 */
import { MAIN_VIEW_STORAGE_KEY, NOTICE, STORAGE_CORRUPT_KEY, STORAGE_KEY, STORAGE_RECOVERY_KEY } from '../config/constants'
import { debugLog, debugWarn } from '../debug'
import type { DashboardState, MainView, StoredDashboardState } from '../types'
import { defaultState } from './defaults'
import { normalizeDashboardState } from './normalize'
import { isPlainObject } from './parsers'

/* -------------------------------------------------------------------------- */
/* 仪表盘主数据                                                                */
/* -------------------------------------------------------------------------- */

/** 读取并规范化本地数据；任何异常都退回初始状态，保证应用一定能启动。 */
const parseStoredState = (raw: string): StoredDashboardState => {
  const parsed: unknown = JSON.parse(raw)
  if (!isPlainObject(parsed)) throw new Error('本地数据不是有效对象')
  return parsed as StoredDashboardState
}

export const loadDashboardWithStatus = (): { dashboard: DashboardState; notice: string } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      debugLog('storage', '本地没有数据，使用初始状态')
      return { dashboard: defaultState, notice: '' }
    }
    return { dashboard: normalizeDashboardState(parseStoredState(raw)), notice: '' }
  } catch (error) {
    debugWarn('storage', '本地数据读取失败，回退到初始状态', error)
    try {
      const recovery = localStorage.getItem(STORAGE_RECOVERY_KEY)
      if (recovery) {
        return { dashboard: normalizeDashboardState(parseStoredState(recovery)), notice: NOTICE.storageRecovered }
      }
    } catch {
      // 恢复副本也不可用时保持可启动；保存时仍必须先保护损坏原文。
    }
    return { dashboard: defaultState, notice: NOTICE.storageCorrupt }
  }
}

export const loadDashboardState = (): DashboardState => loadDashboardWithStatus().dashboard

/**
 * 写入本地数据。
 * @returns 是否写入成功；失败时调用方需要提示用户"先导出备份"。
 */
export const saveDashboardState = (state: DashboardState) => {
  try {
    const previous = localStorage.getItem(STORAGE_KEY)
    let canRefreshRecovery = !previous
    if (previous) {
      try {
        parseStoredState(previous)
        canRefreshRecovery = true
      } catch {
        // 如果保护副本写入失败，异常直接中止本次保存，不能覆盖原文。
        localStorage.setItem(STORAGE_CORRUPT_KEY, previous)
      }
    }
    if (canRefreshRecovery) {
      // 先写一份本次的完整状态，再覆盖主副本；异常中断时仍有最新可用数据。
      const snapshot = { ...state, ai: { ...state.ai, apiKey: '' } }
      localStorage.setItem(STORAGE_RECOVERY_KEY, JSON.stringify(snapshot))
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (error) {
    debugWarn('storage', '本地数据写入失败', error)
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* 界面偏好                                                                    */
/* -------------------------------------------------------------------------- */

const isMainView = (value: string | null): value is MainView =>
  value === 'start' || value === 'execute' || value === 'review'

/** 恢复上次停留的主视图，读不到就从"聚焦"开始。 */
export const loadMainView = (): MainView => {
  try {
    const storedView = window.localStorage.getItem(MAIN_VIEW_STORAGE_KEY)
    return isMainView(storedView) ? storedView : 'start'
  } catch {
    return 'start'
  }
}

/** 记住当前主视图。这只是界面偏好，写失败不需要打扰用户。 */
export const saveMainView = (view: MainView) => {
  try {
    window.localStorage.setItem(MAIN_VIEW_STORAGE_KEY, view)
  } catch {
    // 界面偏好丢了无所谓，仪表盘数据有独立的失败提示路径。
  }
}
