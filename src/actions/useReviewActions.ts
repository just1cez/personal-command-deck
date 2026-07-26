/**
 * 复盘输入、归档与本机保留策略。
 */
import { useCallback } from 'react'
import { CONFIRM, NOTICE } from '../config/constants'
import { buildArchive, upsertArchive } from '../domain/archive'
import { applyRetentionPolicy, clampRetentionDays } from '../domain/retention'
import { useDashboardStore } from '../state/deckContext'
import type { DailyReview, DashboardState } from '../types'

export const useReviewActions = () => {
  const { dashboard, updateDashboard, showNotice } = useDashboardStore()

  /** 更新三段式复盘中的某一段。 */
  const updateReview = useCallback(
    (patch: Partial<DailyReview>) => {
      updateDashboard(
        (current) => ({ ...current, review: { ...current.review, ...patch } }),
        '编辑复盘',
      )
    },
    [updateDashboard],
  )

  /** 归档今天；同一天重复归档会覆盖上一次的记录。 */
  const archiveToday = useCallback(() => {
    updateDashboard((current) => {
      const archive = buildArchive(current)
      return {
        ...current,
        archives: upsertArchive(current.archives, archive),
        // 归档时如果是现算的本地总结，也回写到界面上，保持两边一致。
        reviewSummary: archive.summary,
      }
    }, '归档今天')
    showNotice(NOTICE.archived)
  }, [showNotice, updateDashboard])

  /**
   * 删除一条归档。
   * @returns 是否真的删除了（用户可能在确认框里取消）。
   */
  const deleteArchive = useCallback(
    (id: string) => {
      const archive = dashboard.archives.find((item) => item.id === id)
      if (!archive) return false
      if (!window.confirm(CONFIRM.deleteArchive(archive.date))) return false

      updateDashboard(
        (current) => ({
          ...current,
          archives: current.archives.filter((item) => item.id !== id),
        }),
        '删除归档',
      )
      showNotice(NOTICE.archiveDeleted)
      return true
    },
    [dashboard.archives, showNotice, updateDashboard],
  )

  /**
   * 修改保留天数，并立即按新策略清理一次。
   * 输入来自文本框，可能是空串或乱码，统一交给 clampRetentionDays 收敛。
   *
   * 这是应用里少数会**不可逆删除数据**的操作，所以先算清楚要删多少条再问一次。
   * 天数没变则直接返回，避免每次失焦都弹确认框。
   */
  const saveRetention = useCallback(
    (key: keyof DashboardState['retention'], value: string) => {
      const days = clampRetentionDays(Number(value))
      if (days === dashboard.retention[key]) return

      const nowTime = Date.now()
      const nextRetention = { ...dashboard.retention, [key]: days }
      const kept = applyRetentionPolicy(
        dashboard.archives,
        dashboard.projects,
        nextRetention,
        nowTime,
      )
      const prunedArchives = dashboard.archives.length - kept.archives.length
      const prunedProjects = dashboard.projects.length - kept.projects.length
      const prunedTotal = prunedArchives + prunedProjects

      if (prunedTotal > 0) {
        const confirmed = window.confirm(
          CONFIRM.pruneByRetention(prunedTotal, prunedArchives, prunedProjects),
        )
        if (!confirmed) {
          showNotice(NOTICE.retentionCancelled)
          return
        }
      }

      updateDashboard((current) => {
        const retention = { ...current.retention, [key]: days }
        const retained = applyRetentionPolicy(
          current.archives,
          current.projects,
          retention,
          Date.now(),
        )
        return { ...current, retention, ...retained }
      }, '设置保留天数')

      showNotice(days <= 0 ? NOTICE.retentionForever : NOTICE.retentionDays(days))
    },
    [
      dashboard.archives,
      dashboard.projects,
      dashboard.retention,
      showNotice,
      updateDashboard,
    ],
  )

  return { updateReview, archiveToday, deleteArchive, saveRetention }
}
