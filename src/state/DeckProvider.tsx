/**
 * 把业务数据与界面状态注入组件树。
 *
 * 单独成文件是为了让这里只导出一个组件——热更新（react-refresh）要求
 * 组件文件不要混着导出 hook / 常量，否则改动时会整棵树重挂。
 */
import type { ReactNode } from 'react'
import { DashboardContext, DeckUiContext } from './deckContext'
import { useDashboardState } from './useDashboardState'
import { useDeckUiState } from './useDeckUiState'

export function DeckProvider({ children }: { children: ReactNode }) {
  const dashboardStore = useDashboardState()
  const uiStore = useDeckUiState()

  return (
    <DashboardContext.Provider value={dashboardStore}>
      <DeckUiContext.Provider value={uiStore}>{children}</DeckUiContext.Provider>
    </DashboardContext.Provider>
  )
}
