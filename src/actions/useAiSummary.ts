/**
 * 复盘草稿的生成（本地规则 / AI 两条路径）与 AI 配置面板的状态。
 *
 * loading、error、设置面板开关都是**只有复盘草稿这一块用得到**的界面状态，
 * 所以留在这个 hook 里，不进全局 context。
 */
import { useCallback, useState } from 'react'
import { ERROR_TEXT, NOTICE } from '../config/constants'
import { aiProviderDefaults } from '../config/options'
import { buildLocalSummary } from '../domain/summary'
import {
  buildReviewPrompt,
  getAiSettingsIssue,
  requestAiSummary,
} from '../services/aiSummary'
import { useDashboardStore } from '../state/deckContext'
import type { AiProvider, DashboardState } from '../types'

export const useAiSummary = () => {
  const { dashboard, updateDashboard, showNotice } = useDashboardStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** 配置缺什么；空串表示配置完整。 */
  const settingsIssue = getAiSettingsIssue(dashboard.ai)

  const updateSettings = useCallback(
    (patch: Partial<DashboardState['ai']>) => {
      updateDashboard(
        (current) => ({ ...current, ai: { ...current.ai, ...patch } }),
        '修改 AI 设置',
      )
      // 用户已经在动手改配置了，旧的报错就没必要继续挂着。
      setError('')
    },
    [updateDashboard],
  )

  /** 切换提供商时带出它的默认地址与模型；预设为空（自定义）则保留用户已填的值。 */
  const setProvider = useCallback(
    (provider: AiProvider) => {
      updateDashboard((current) => {
        const preset = aiProviderDefaults[provider]
        return {
          ...current,
          ai: {
            ...current.ai,
            provider,
            baseUrl: preset.baseUrl || current.ai.baseUrl,
            model: preset.model || current.ai.model,
          },
        }
      }, '切换 AI 提供商')
      setError('')
    },
    [updateDashboard],
  )

  const toggleSettings = useCallback(() => setSettingsOpen((current) => !current), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  /**
   * 生成复盘草稿。
   * 没启用 AI 就走本地规则，立刻出结果；启用了但配置不全则展开设置面板并提示。
   */
  const generateSummary = useCallback(async () => {
    if (!dashboard.ai.enabled) {
      updateDashboard(
        (current) => ({
          ...current,
          reviewSummary: buildLocalSummary(
            current.review,
            current.tasks.filter((task) => task.done),
            current.tasks.filter((task) => !task.done),
            current.inbox,
            current.tomorrowTasks,
          ),
        }),
        '生成本地总结',
      )
      setError('')
      showNotice(NOTICE.localSummaryReady)
      return
    }

    const issue = getAiSettingsIssue(dashboard.ai)
    if (issue) {
      setError(issue)
      setSettingsOpen(true)
      return
    }

    setLoading(true)
    setError('')
    try {
      const summary = await requestAiSummary(dashboard.ai, buildReviewPrompt(dashboard))
      updateDashboard((current) => ({ ...current, reviewSummary: summary }), '生成 AI 总结')
      showNotice(NOTICE.aiSummaryReady)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : ERROR_TEXT.aiSummaryFailed,
      )
    } finally {
      setLoading(false)
    }
  }, [dashboard, showNotice, updateDashboard])

  return {
    settingsOpen,
    toggleSettings,
    closeSettings,
    loading,
    error,
    settingsIssue,
    updateSettings,
    setProvider,
    generateSummary,
  }
}
