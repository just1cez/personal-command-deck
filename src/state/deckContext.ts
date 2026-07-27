/**
 * 两个全局 context 的定义与读取入口。
 *
 * 为什么拆成两个而不是一个大对象：
 * - `DashboardContext` 装的是**会被持久化的业务数据**；
 * - `DeckUiContext` 装的是**跨视图共享的界面状态**（当前主视图、命令面板开关、
 *   项目专注弹窗的草稿……）——它们刷新后就该丢掉，不该混进存档。
 *
 * 只在单个面板内部使用的状态（输入框草稿、展开/收起）请直接用组件内的 useState，
 * 不要往这里加，否则 context 会重新变成一个什么都塞的大对象。
 */
import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DeckStats } from '../domain/stats'
import type { DashboardState, MainView, OrderDirection } from '../types'

/* -------------------------------------------------------------------------- */
/* 业务数据                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 更新仪表盘状态。
 *
 * @param updater 纯函数，接收当前状态返回新状态；无需变更时**原样返回入参**，
 *                React 会跳过这次渲染，也不会触发写盘。
 * @param action  调试用的动作名，会出现在 `[deck:store]` 日志里。
 *                加新动作时请务必传，这是排查"状态被谁改了"的主要线索。
 */
export type UpdateDashboard = (
  updater: (current: DashboardState) => DashboardState,
  action?: string,
) => void

export type DashboardStore = {
  dashboard: DashboardState
  /** 由 dashboard 派生、跨视图共享的统计值（见 domain/stats.ts）。 */
  stats: DeckStats
  /** 仅在需要整体替换状态时使用（如导入备份），日常请用 updateDashboard。 */
  setDashboard: Dispatch<SetStateAction<DashboardState>>
  updateDashboard: UpdateDashboard
  /** 底部提示条上的一次性提示文案。 */
  notice: string
  /** 立即显示提示（事件回调里用）。 */
  showNotice: (text: string) => void
  /**
   * 延迟一拍再显示提示。
   * 专供"在 updater 内部才知道要不要提示"的场景（例如专注结算），
   * 避免在计算新状态的过程中同步触发另一个 setState。
   */
  queueNotice: (text: string) => void
}

export const DashboardContext = createContext<DashboardStore | null>(null)

export const useDashboardStore = (): DashboardStore => {
  const store = useContext(DashboardContext)
  if (!store) throw new Error('useDashboardStore 必须在 <DeckProvider> 内部使用')
  return store
}

/** 只要数据本身时的便捷入口。 */
export const useDashboard = () => useDashboardStore().dashboard

/** 只要派生统计值时的便捷入口。 */
export const useDeckStats = () => useDashboardStore().stats

/* -------------------------------------------------------------------------- */
/* 跨视图界面状态                                                              */
/* -------------------------------------------------------------------------- */

/** 上移/下移后的高亮标记，用于播放一次位移动画。 */
export type OrderMoveHighlight = {
  id: string
  direction: OrderDirection
} | null

/** 项目专注弹窗里正在编辑的草稿。 */
export type ProjectFocusDraft = {
  /** null = 弹窗关闭。 */
  projectId: string | null
  minutes: number
  /** 关联的今日待办 id，空串表示不关联。 */
  taskId: string
}

export type DeckUiStore = {
  activeMainView: MainView
  setActiveMainView: (view: MainView) => void

  orderMoveHighlight: OrderMoveHighlight
  /** 标记某条目刚刚移动过，高亮会在动画结束后自动消失。 */
  markOrderMove: (id: string, direction: OrderDirection) => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>

  quoteManagerOpen: boolean
  setQuoteManagerOpen: Dispatch<SetStateAction<boolean>>

  projectFocusDraft: ProjectFocusDraft
  /** 打开项目专注弹窗，`minutes` 一般取当前的默认专注时长。 */
  openProjectFocusDraft: (projectId: string, minutes: number) => void
  closeProjectFocusDraft: () => void
  /** 项目被删除/结项时，如果弹窗正指向它就顺手关掉。 */
  closeProjectFocusDraftIfMatches: (projectId: string) => void
  setProjectFocusMinutes: Dispatch<SetStateAction<number>>
  setProjectFocusTaskId: (taskId: string) => void
}

export const DeckUiContext = createContext<DeckUiStore | null>(null)

export const useDeckUi = (): DeckUiStore => {
  const store = useContext(DeckUiContext)
  if (!store) throw new Error('useDeckUi 必须在 <DeckProvider> 内部使用')
  return store
}
