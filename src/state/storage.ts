/**
 * localStorage 读写。
 *
 * 这一层是应用里**唯一**直接碰 localStorage 的地方（调试开关除外），
 * 所有异常都在这里被吞掉并转换成返回值，调用方不需要写 try/catch。
 *
 * 为什么要吞异常：浏览器隐私模式、磁盘配额写满、Electron 沙箱异常都会让
 * localStorage 抛错，但这些都不该让整个面板崩掉——大不了这次不持久化。
 */
import { MAIN_VIEW_STORAGE_KEY, STORAGE_KEY } from '../config/constants'
import { debugLog, debugWarn } from '../debug'
import type { DashboardState, MainView, StoredDashboardState } from '../types'
import { defaultState } from './defaults'
import { normalizeDashboardState } from './normalize'

/* -------------------------------------------------------------------------- */
/* 仪表盘主数据                                                                */
/* -------------------------------------------------------------------------- */

/** 读取并规范化本地数据；任何异常都退回初始状态，保证应用一定能启动。 */
export const loadDashboardState = (): DashboardState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      debugLog('storage', '本地没有数据，使用初始状态')
      return defaultState
    }
    return normalizeDashboardState(JSON.parse(raw) as StoredDashboardState)
  } catch (error) {
    debugWarn('storage', '本地数据读取失败，回退到初始状态', error)
    return defaultState
  }
}

/**
 * 写入本地数据。
 * @returns 是否写入成功；失败时调用方需要提示用户"先导出备份"。
 */
export const saveDashboardState = (state: DashboardState) => {
  try {
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
