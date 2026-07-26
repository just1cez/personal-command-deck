/**
 * 跨视图共享的界面状态。
 *
 * 判断一个状态该不该放这里的标准：**是否有第二个组件需要读或写它**。
 * 例如项目专注弹窗——推进页的项目卡片和命令面板都能打开它，弹窗本身却渲染在最外层，
 * 这种"触发点和渲染点不在一起"的状态就适合放这里。
 */
import { useCallback, useEffect, useState } from 'react'
import { ORDER_MOVE_HIGHLIGHT_MS } from '../config/constants'
import type { MainView, OrderDirection } from '../types'
import type { DeckUiStore, OrderMoveHighlight, ProjectFocusDraft } from './deckContext'
import { loadMainView, saveMainView } from './storage'

const CLOSED_PROJECT_FOCUS_DRAFT: ProjectFocusDraft = {
  projectId: null,
  minutes: 0,
  taskId: '',
}

export const useDeckUiState = (): DeckUiStore => {
  const [activeMainView, setActiveMainView] = useState<MainView>(() => loadMainView())
  const [orderMoveHighlight, setOrderMoveHighlight] = useState<OrderMoveHighlight>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quoteManagerOpen, setQuoteManagerOpen] = useState(false)
  const [projectFocusDraft, setProjectFocusDraft] = useState<ProjectFocusDraft>(
    CLOSED_PROJECT_FOCUS_DRAFT,
  )

  // 记住用户停留在哪个主视图，下次打开直接回到那里。
  useEffect(() => {
    saveMainView(activeMainView)
  }, [activeMainView])

  /**
   * 播放一次"刚刚移动过"的高亮。
   * 定时清除时要比对 id：期间用户可能又移动了别的条目，不能把新的高亮误清掉。
   */
  const markOrderMove = useCallback((id: string, direction: OrderDirection) => {
    setOrderMoveHighlight({ id, direction })
    window.setTimeout(() => {
      setOrderMoveHighlight((current) => (current?.id === id ? null : current))
    }, ORDER_MOVE_HIGHLIGHT_MS)
  }, [])

  const openProjectFocusDraft = useCallback((projectId: string, minutes: number) => {
    setProjectFocusDraft({ projectId, minutes, taskId: '' })
  }, [])

  const closeProjectFocusDraft = useCallback(() => {
    setProjectFocusDraft((current) => ({ ...current, projectId: null }))
  }, [])

  const closeProjectFocusDraftIfMatches = useCallback((projectId: string) => {
    setProjectFocusDraft((current) =>
      current.projectId === projectId ? { ...current, projectId: null } : current,
    )
  }, [])

  const setProjectFocusMinutes = useCallback<DeckUiStore['setProjectFocusMinutes']>(
    (value) => {
      setProjectFocusDraft((current) => ({
        ...current,
        minutes: typeof value === 'function' ? value(current.minutes) : value,
      }))
    },
    [],
  )

  const setProjectFocusTaskId = useCallback((taskId: string) => {
    setProjectFocusDraft((current) => ({ ...current, taskId }))
  }, [])

  return {
    activeMainView,
    setActiveMainView,
    orderMoveHighlight,
    markOrderMove,
    commandPaletteOpen,
    setCommandPaletteOpen,
    quoteManagerOpen,
    setQuoteManagerOpen,
    projectFocusDraft,
    openProjectFocusDraft,
    closeProjectFocusDraft,
    closeProjectFocusDraftIfMatches,
    setProjectFocusMinutes,
    setProjectFocusTaskId,
  }
}
