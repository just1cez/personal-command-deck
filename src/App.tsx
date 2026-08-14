/**
 * 应用外壳。
 *
 * 这里只做三件事：注入全局状态、挂载后台定时任务、按当前主视图渲染对应区块。
 * 具体的业务逻辑分布在：
 *
 *   config/    可枚举选项与常量（加主题/提供商/图标改这里）
 *   domain/    纯业务规则（专注计时、任务搬运、保留策略…）
 *   state/     状态存储、持久化、数据规范化
 *   actions/   把 domain 规则接到状态上的写操作
 *   hooks/     副作用（定时器、网络请求、快捷键）
 *   views/     三个主视图及其面板
 *   overlays/  命令面板与两个弹窗
 *
 * 想加一个新面板，只需要写一个组件并挂到对应的 view 里；
 * 想加一种新数据，从 types.ts + state/normalize.ts 开始。
 */
import { ControlStrip } from './layout/ControlStrip'
import { MainViewTabs } from './layout/MainViewTabs'
import { TopStatusBar } from './layout/TopStatusBar'
import { CommandPalette } from './overlays/CommandPalette'
import { ProjectFocusDialog } from './overlays/ProjectFocusDialog'
import { QuoteManagerDialog } from './overlays/QuoteManagerDialog'
import { useClock } from './hooks/useClock'
import { useFocusTimer } from './hooks/useFocusTimer'
import { useDesktopNoteWindows } from './hooks/useDesktopNoteWindows'
import {
  useDailyCarryover,
  useDailyQuoteSync,
  useRetentionSweep,
} from './hooks/useHousekeeping'
import { DeckProvider } from './state/DeckProvider'
import { useDashboardStore, useDeckUi } from './state/deckContext'
import { formatLocalDate } from './utils'
import { StartView } from './views/StartView'
import { ExecuteView } from './views/ExecuteView'
import { ReviewView } from './views/ReviewView'
import './App.css'

function ExecuteNoticeToast() {
  const { notice } = useDashboardStore()
  if (!notice) return null
  return (
    <div className="execute-notice-toast" role="status" aria-live="polite">
      {notice}
    </div>
  )
}

function AppShell() {
  const { activeMainView } = useDeckUi()

  // 每秒一次的时钟，同时驱动顶栏显示和跨天检查。
  const now = useClock()

  useFocusTimer()
  useDesktopNoteWindows()
  useDailyQuoteSync()
  useDailyCarryover(formatLocalDate(now))
  useRetentionSweep()

  return (
    <main className="app-shell">
      <TopStatusBar now={now} />
      <ControlStrip />
      <MainViewTabs />

      {/* 三个主视图互斥显示；未激活的视图整体卸载，其内部草稿状态也随之清空。 */}
      {activeMainView === 'start' && <StartView />}
      {activeMainView === 'execute' && <ExecuteView />}
      {activeMainView === 'review' && <ReviewView />}
      {activeMainView === 'execute' && <ExecuteNoticeToast />}

      {/* 浮层统一挂在最外层：触发点可能在任意视图，渲染位置必须固定。 */}
      <CommandPalette />
      <ProjectFocusDialog />
      <QuoteManagerDialog />
    </main>
  )
}

export default function App() {
  return (
    <DeckProvider>
      <AppShell />
    </DeckProvider>
  )
}
