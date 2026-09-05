/**
 * 今日收据：五个数字概括这一天。
 *
 * 刻意只给事实、不给评价——复盘的第一步是看清楚，不是打分。
 */
import { Check } from 'lucide-react'
import { FocusRecordDetails } from '../../components/FocusRecordDetails'
import { ReviewSectionHeading } from '../../components/ui/PanelTitle'
import { TOP_TASK_LIMIT } from '../../config/constants'
import {
  formatFocusActualMinutes,
  selectDailyFocus,
} from '../../domain/focusRecords'
import { useDashboardStore } from '../../state/deckContext'
import { todayIso } from '../../utils'

export function ReviewReceipt({ archivedToday }: { archivedToday: boolean }) {
  const { dashboard, stats } = useDashboardStore()
  const today = todayIso()
  const focusStats = selectDailyFocus(dashboard, today)
  const { records: focusRecords, actualSeconds, plannedMinutes } = focusStats

  const items = [
    {
      label: '今日完成',
      value: `${stats.completedTaskCount}/${dashboard.tasks.length}`,
      detail: `${stats.completionRate}%`,
    },
    {
      label: 'Top 3',
      // 一条 Top 3 都没设时，分母仍显示 3，提醒"今天没定重点"。
      value: `${stats.completedTopCount}/${stats.topTasks.length || TOP_TASK_LIMIT}`,
      detail: '核心推进',
    },
    {
      label: '今日专注',
      value: formatFocusActualMinutes(actualSeconds),
      detail: `${plannedMinutes} 分钟计划 · ${focusStats.segmentCount} 段`,
    },
    { label: '灵感暂存', value: `${dashboard.inbox.length}`, detail: '条' },
    { label: '临近提醒', value: `${stats.urgentReminderCount}`, detail: '个' },
  ]

  return (
    <section className="review-receipt" aria-label="今日收据">
      <ReviewSectionHeading
        icon={<Check size={17} />}
        title="今日收据"
        aside={archivedToday ? '今天已归档' : '准备复盘'}
      />
      <div className="review-receipt-grid">
        {items.map((item) => (
          <div className="review-receipt-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
      {focusRecords.length ? (
        <FocusRecordDetails records={focusRecords} />
      ) : (
        <p className="focus-record-empty">今天还没有已结算的专注记录。</p>
      )}
    </section>
  )
}
