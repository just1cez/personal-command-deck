/**
 * 最近归档：翻看过去几天的复盘记录，并设置本机保留天数。
 */
import { Archive, Trash2 } from 'lucide-react'
import { useReviewActions } from '../../actions/useReviewActions'
import { FocusRecordDetails } from '../../components/FocusRecordDetails'
import { RetentionControls } from '../../components/RetentionControls'
import { ReviewSectionHeading } from '../../components/ui/PanelTitle'
import { RECENT_ARCHIVE_LIMIT } from '../../config/constants'
import { getRetentionLabel } from '../../domain/retention'
import { formatFocusActualMinutes } from '../../domain/focusRecords'
import { useDashboardStore } from '../../state/deckContext'
import type { DailyArchive } from '../../types'

/** 归档详情里每一栏最多列几条任务标题。 */
const DETAIL_TASK_LIMIT = 4

const joinTaskTitles = (tasks: DailyArchive['completedTasks'], emptyText: string) =>
  tasks
    .map((task) => task.title)
    .slice(0, DETAIL_TASK_LIMIT)
    .join('、') || emptyText

export function ArchiveHistory({
  todayArchive,
  expandedArchiveId,
  onExpandArchive,
}: {
  todayArchive?: DailyArchive
  /** 'today' 是一个特殊值：刚归档完但还没在列表里点选过。 */
  expandedArchiveId: string | null
  onExpandArchive: (id: string | null) => void
}) {
  const { dashboard } = useDashboardStore()
  const { deleteArchive, saveRetention } = useReviewActions()

  const recentArchives = dashboard.archives.slice(0, RECENT_ARCHIVE_LIMIT)

  // 选中项的兜底顺序：点选的 > 刚归档的今天 > 列表里最新的一条。
  const selectedArchive =
    recentArchives.find((archive) => archive.id === expandedArchiveId) ??
    (expandedArchiveId === 'today' ? todayArchive : undefined) ??
    recentArchives[0]

  return (
    <section className="archive-history" aria-label="最近归档">
      <ReviewSectionHeading
        icon={<Archive size={17} />}
        title="最近归档"
        aside={
          recentArchives.length
            ? `保留 ${dashboard.archives.length} 条 · ${getRetentionLabel(
                dashboard.retention.reviewArchiveDays,
              )}`
            : '归档后会出现在这里'
        }
      />

      <div className="retention-settings" aria-label="归档清理设置">
        <div>
          <span>本机清理</span>
          <strong>每日复盘 {getRetentionLabel(dashboard.retention.reviewArchiveDays)}</strong>
          <small>导出文件不受应用管理；这里仅清理本机归档记录。</small>
        </div>
        <RetentionControls
          label="复盘归档"
          value={dashboard.retention.reviewArchiveDays}
          onChange={(value) => saveRetention('reviewArchiveDays', value)}
        />
      </div>

      {recentArchives.length ? (
        <>
          <div className="archive-list">
            {recentArchives.map((archive) => (
              <button
                type="button"
                key={archive.id}
                className={selectedArchive?.id === archive.id ? 'active' : ''}
                onClick={() => onExpandArchive(archive.id)}
              >
                <span>{archive.date}</span>
                <strong>{archive.completedTasks.length} 完成</strong>
                <small>{formatFocusActualMinutes(archive.actualFocusSeconds)} 分钟</small>
              </button>
            ))}
          </div>

          {selectedArchive && (
            <div className="archive-detail">
              <div className="archive-detail-head">
                <div>
                  <span>{selectedArchive.date}</span>
                  <strong>
                    {selectedArchive.completedTasks.length} 项完成 ·{' '}
                    {formatFocusActualMinutes(selectedArchive.actualFocusSeconds)} 分钟专注
                  </strong>
                </div>
                <div className="archive-detail-actions">
                  <small>
                    {new Date(selectedArchive.createdAt).toLocaleTimeString('zh-Hans-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="删除这条复盘归档"
                    aria-label="删除这条复盘归档"
                    onClick={() => {
                      if (deleteArchive(selectedArchive.id) && expandedArchiveId === selectedArchive.id) {
                        onExpandArchive(null)
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="archive-detail-grid">
                <div>
                  <span>专注记录</span>
                  <p>
                    计划 {selectedArchive.plannedFocusMinutes} 分钟 · 实际{' '}
                    {formatFocusActualMinutes(selectedArchive.actualFocusSeconds)} 分钟 ·{' '}
                    {selectedArchive.focusRecords.length} 段
                  </p>
                </div>
                <div>
                  <span>完成项</span>
                  <p>{joinTaskTitles(selectedArchive.completedTasks, '没有完成项')}</p>
                </div>
                <div>
                  <span>遗留项</span>
                  <p>{joinTaskTitles(selectedArchive.openTasks, '没有遗留项')}</p>
                </div>
                <div>
                  <span>明日任务</span>
                  <p>{joinTaskTitles(selectedArchive.tomorrowTasks, '没有布置')}</p>
                </div>
              </div>
              <FocusRecordDetails records={selectedArchive.focusRecords} />
              <pre>{selectedArchive.summary}</pre>
            </div>
          )}
        </>
      ) : (
        <p className="archive-empty">完成一次复盘归档后，可以在这里翻看最近记录。</p>
      )}
    </section>
  )
}
