/** 聚焦视图：一天的起点——确定这一轮做什么，然后开始计时。 */
import { FocusStartPanel } from './start/FocusStartPanel'
import { QuickLinksPanel } from './start/QuickLinksPanel'

export function StartView() {
  return (
    <section className="main-view-panel start-view" aria-label="聚焦界面">
      <FocusStartPanel />
      <QuickLinksPanel />
    </section>
  )
}
