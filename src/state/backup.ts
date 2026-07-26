/**
 * 本地备份的导出与导入。
 *
 * 安全约定（见 AGENTS.md）：**导出的文件里绝不包含 API Key**。
 * 导入时反过来保留本机已填写的 Key，这样换机迁移不会把密钥写进文件，
 * 同机恢复也不需要重新填一遍。
 */
import { BACKUP_APP_NAME, BACKUP_VERSION } from '../config/constants'
import type { DashboardBackup, DashboardState, StoredDashboardState } from '../types'
import { isPlainObject } from './parsers'

/**
 * 备份专用的状态快照：
 * - 清空 API Key；
 * - 把专注计时停下（endsAt/startedAt 换台机器后没有意义）。
 */
export const createBackupState = (dashboard: DashboardState): DashboardState => ({
  ...dashboard,
  focus: { ...dashboard.focus, running: false, endsAt: undefined, startedAt: undefined },
  ai: { ...dashboard.ai, apiKey: '' },
})

/** 组装导出的 JSON 结构。 */
export const buildBackupFile = (dashboard: DashboardState): DashboardBackup => ({
  app: BACKUP_APP_NAME,
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  state: createBackupState(dashboard),
})

/**
 * 老版本导出的是"裸状态"（没有 app/version 外壳）。
 * 通过这些标志字段判断一个裸 JSON 是不是本应用的数据。
 */
const recognizableStateKeys = new Set([
  'theme',
  'dayMode',
  'energy',
  'weather',
  'currentFocus',
  'tasks',
  'tomorrowTasks',
  'dailyCarryoverDate',
  'projects',
  'quickLinks',
  'inbox',
  'reminders',
  'review',
  'reviewSummary',
  'ai',
  'retention',
  'archives',
  'focus',
])

/**
 * 从导入的 JSON 中取出待规范化的状态。
 *
 * 兼容两种格式：带 `{app, version, state}` 外壳的新备份，以及早期的裸状态。
 * 抛出的错误文案会直接展示给用户，所以要具体到"哪一步不对"。
 */
export const extractBackupState = (parsed: unknown): StoredDashboardState => {
  if (!isPlainObject(parsed)) {
    throw new Error('备份文件不是可识别的 JSON 对象')
  }

  if ('state' in parsed) {
    if (parsed.app !== BACKUP_APP_NAME) {
      throw new Error('这不是 Personal Command Deck 的备份')
    }
    if (!isPlainObject(parsed.state)) {
      throw new Error('备份里没有可导入的数据')
    }
    return parsed.state as StoredDashboardState
  }

  const looksLikeLegacyState = Object.keys(parsed).some((key) =>
    recognizableStateKeys.has(key),
  )
  if (!looksLikeLegacyState) {
    throw new Error('没有找到 Personal Command Deck 数据')
  }
  return parsed as StoredDashboardState
}
