/**
 * 本机保留策略：自动清理过期的复盘归档与已结项项目。
 *
 * 只影响本机 localStorage 里的记录，已导出的备份文件不受影响。
 * `days <= 0` 一律表示"永久保留"。
 */
import { DAY_MS, RETENTION_MAX_DAYS } from '../config/constants'
import type { DailyArchive, Project, RetentionSettings } from '../types'
import { clamp } from '../utils'

/**
 * 这条记录是否还在保留期内。
 *
 * 两种情况刻意判为"保留"：
 * - `days <= 0`：用户选择了永久保留；
 * - 时间戳缺失或无法解析：宁可留着也不要误删用户数据。
 */
export const isWithinRetentionWindow = (
  isoDateTime: string | undefined,
  days: number,
  now = Date.now(),
) => {
  if (days <= 0) return true
  const time = isoDateTime ? new Date(isoDateTime).getTime() : NaN
  if (!Number.isFinite(time)) return true
  return now - time <= days * DAY_MS
}

/** 规范化用户输入的保留天数。 */
export const clampRetentionDays = (days: number) =>
  Number.isFinite(days) ? clamp(Math.round(days), 0, RETENTION_MAX_DAYS) : 0

export const getRetentionLabel = (days: number) => (days <= 0 ? '永久保留' : `${days} 天`)

/**
 * 按保留策略过滤归档与项目。
 *
 * 三个调用点共用这一份规则：启动时的数据规范化、每小时的定时清理、
 * 以及用户改动保留天数后的立即清理。
 */
export const applyRetentionPolicy = (
  archives: DailyArchive[],
  projects: Project[],
  retention: RetentionSettings,
  now = Date.now(),
) => ({
  archives: archives.filter((archive) =>
    isWithinRetentionWindow(archive.createdAt, retention.reviewArchiveDays, now),
  ),
  // 进行中的项目永远保留，只清理已结项且超期的。
  projects: projects.filter(
    (project) =>
      project.active !== false ||
      isWithinRetentionWindow(project.completedAt, retention.completedProjectDays, now),
  ),
})
