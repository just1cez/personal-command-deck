/**
 * 主视图切换：聚焦 → 推进 → 复盘。
 *
 * 顺序对应一天的使用节奏（开工定目标 / 白天推进 / 收工复盘），
 * 想调整顺序或增加视图，改 config/options.tsx 里的 mainViewOptions 即可。
 */
import { mainViewOptions } from '../config/options'
import { useDeckUi } from '../state/deckContext'

export function MainViewTabs() {
  const { activeMainView, setActiveMainView } = useDeckUi()

  return (
    <nav className="main-view-tabs" aria-label="主界面">
      {mainViewOptions.map((view) => (
        <button
          key={view.value}
          type="button"
          className={activeMainView === view.value ? 'active' : ''}
          aria-current={activeMainView === view.value ? 'page' : undefined}
          onClick={() => setActiveMainView(view.value)}
        >
          {view.icon}
          <span>{view.label}</span>
          <small>{view.hint}</small>
        </button>
      ))}
    </nav>
  )
}
