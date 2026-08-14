/** 推进视图：白天真正干活的地方——今日任务、项目推进，以及右侧的随手记。 */
import { DesktopNotesPanel } from './execute/DesktopNotesPanel'
import { InboxPanel } from './execute/InboxPanel'
import { ProjectPanel } from './execute/ProjectPanel'
import { RemindersPanel } from './execute/RemindersPanel'
import { TodayPanel } from './execute/TodayPanel'

export function ExecuteView() {
  return (
    <section className="main-view-panel execute-view" aria-label="推进界面">
      <TodayPanel />
      <ProjectPanel />
      <aside className="execution-side">
        <InboxPanel />
        <DesktopNotesPanel />
        <RemindersPanel />
      </aside>
    </section>
  )
}
