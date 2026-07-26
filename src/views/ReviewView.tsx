/**
 * 复盘视图：一天的收尾。
 *
 * 页面顺序即建议的操作顺序：
 * 看收据 → 写三段复盘 → 布置明天 → 生成草稿 → 归档 → 需要时翻旧账。
 *
 * `expandedArchiveId` 由这里持有：归档动作在"归档今天"那一节触发，
 * 展开效果却发生在"最近归档"那一节，两边都需要它。
 */
import { useState } from 'react'
import { Moon } from 'lucide-react'
import { useDashboardStore } from '../state/deckContext'
import { todayIso } from '../utils'
import { ArchiveActions } from './review/ArchiveActions'
import { ArchiveHistory } from './review/ArchiveHistory'
import { ReviewDraft } from './review/ReviewDraft'
import { ReviewFlow } from './review/ReviewFlow'
import { ReviewReceipt } from './review/ReviewReceipt'
import { TomorrowPlan } from './review/TomorrowPlan'

/** 表示"刚归档完的今天"，用于在真实 id 还没被点选前先展开它。 */
const TODAY_ARCHIVE_KEY = 'today'

export function ReviewView() {
  const { dashboard } = useDashboardStore()
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null)

  const todayArchive = dashboard.archives.find((archive) => archive.date === todayIso())
  const latestArchive = dashboard.archives[0]

  return (
    <section className="main-view-panel review-view" aria-label="复盘界面">
      <article className="panel ai-review-panel">
        <div className="panel-title review-title">
          <div>
            <Moon size={20} />
            <h2>每日复盘</h2>
          </div>
          <span>{todayIso()}</span>
        </div>

        <ReviewReceipt archivedToday={Boolean(todayArchive)} />
        <ReviewFlow />
        <TomorrowPlan />
        <ReviewDraft />

        <ArchiveActions
          todayArchive={todayArchive}
          latestArchive={latestArchive}
          onArchived={() => setExpandedArchiveId(TODAY_ARCHIVE_KEY)}
        />
        <ArchiveHistory
          todayArchive={todayArchive}
          expandedArchiveId={expandedArchiveId}
          onExpandArchive={setExpandedArchiveId}
        />
      </article>
    </section>
  )
}
