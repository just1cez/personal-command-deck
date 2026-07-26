/**
 * 归档今天：复盘流程的最后一步。
 *
 * 同一天可以反复归档，后一次覆盖前一次（按钮文案会相应变成"更新今天归档"）。
 */
import { Archive } from 'lucide-react'
import { useReviewActions } from '../../actions/useReviewActions'
import { useDashboardStore } from '../../state/deckContext'
import type { DailyArchive } from '../../types'

export function ArchiveActions({
  todayArchive,
  latestArchive,
  onArchived,
}: {
  todayArchive?: DailyArchive
  latestArchive?: DailyArchive
  /** 归档完成后通知父组件展开今天这条记录。 */
  onArchived: () => void
}) {
  const { notice } = useDashboardStore()
  const { archiveToday } = useReviewActions()

  return (
    <section className="review-archive-panel" aria-label="归档今天">
      <div>
        <span>{todayArchive ? '今天已归档' : '最后一步'}</span>
        <strong>
          {todayArchive
            ? `${todayArchive.date} · ${todayArchive.completedTasks.length} 项完成`
            : '确认无误后归档今天'}
        </strong>
        <small>
          {latestArchive
            ? `最近归档：${latestArchive.date} · ${latestArchive.completedTasks.length} 项完成`
            : '还没有归档记录'}
        </small>
      </div>
      <button
        type="button"
        onClick={() => {
          archiveToday()
          onArchived()
        }}
      >
        <Archive size={16} />
        {todayArchive ? '更新今天归档' : '归档今天'}
      </button>
      {notice && <em>{notice}</em>}
    </section>
  )
}
