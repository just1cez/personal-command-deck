/**
 * 本地备份的导出与导入。
 *
 * 导入是这个应用里唯一会**整体替换**状态的操作，所以：
 * - 动手前必须弹确认框；
 * - 导入的数据同样要过一遍 normalizeDashboardState，不能信任文件内容；
 * - 保留本机已填的 API Key（备份文件里没有 Key）。
 */
import { useCallback } from 'react'
import { ERROR_TEXT, CONFIRM, NOTICE } from '../config/constants'
import { buildBackupFile, extractBackupState } from '../state/backup'
import { useDashboardStore } from '../state/deckContext'
import { normalizeDashboardState } from '../state/normalize'
import { downloadTextFile, readFileAsText, todayIso } from '../utils'

export const useBackupActions = () => {
  const { dashboard, setDashboard, showNotice } = useDashboardStore()

  const exportBackup = useCallback(() => {
    downloadTextFile(
      `personal-command-deck-${todayIso()}.json`,
      JSON.stringify(buildBackupFile(dashboard), null, 2),
    )
    showNotice(NOTICE.backupExported)
  }, [dashboard, showNotice])

  const importBackup = useCallback(
    async (file: File) => {
      try {
        const text = await readFileAsText(file)
        // 先解析，确认这确实是一份能用的备份，再问用户要不要覆盖。
        const incoming = extractBackupState(JSON.parse(text))

        if (!window.confirm(CONFIRM.importBackup)) {
          showNotice(NOTICE.backupImportCancelled)
          return
        }

        setDashboard((current) =>
          normalizeDashboardState(incoming, { currentState: current, preserveAiKey: true }),
        )
        showNotice(NOTICE.backupImported)
      } catch (error) {
        showNotice(
          NOTICE.backupImportFailed(
            error instanceof Error ? error.message : ERROR_TEXT.backupBadFormat,
          ),
        )
      }
    },
    [setDashboard, showNotice],
  )

  return { exportBackup, importBackup }
}
