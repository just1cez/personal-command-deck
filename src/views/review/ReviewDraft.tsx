/**
 * 复盘草稿 + AI 设置面板。
 *
 * 两条生成路径：没接 API 时用本地规则拼一段（离线可用、瞬间出结果），
 * 接了 API 就把今天的数据整理成提示词交给模型。两者输出格式一致。
 */
import { Cpu, Sparkles } from 'lucide-react'
import { useAiSummary } from '../../actions/useAiSummary'
import { EditorField } from '../../components/ui/EditorField'
import { ReviewSectionHeading } from '../../components/ui/PanelTitle'
import { ThemedSelect } from '../../components/ui/ThemedSelect'
import { aiProviderOptions } from '../../config/options'
import { useDashboardStore } from '../../state/deckContext'
import type { AiProvider } from '../../types'

export function ReviewDraft() {
  const { dashboard } = useDashboardStore()
  const ai = useAiSummary()

  const summaryModeLabel = dashboard.ai.enabled ? 'AI 总结' : '本地总结'

  return (
    <section className="review-draft" aria-label="AI 复盘草稿">
      <ReviewSectionHeading icon={<Sparkles size={17} />} title="复盘草稿">
        <div className="review-actions">
          <button
            type="button"
            className={dashboard.ai.enabled ? 'api-active' : ''}
            onClick={ai.toggleSettings}
          >
            <Cpu size={15} />
            {dashboard.ai.enabled ? 'API 已接入' : '接入 API'}
          </button>
          <button type="button" disabled={ai.loading} onClick={() => void ai.generateSummary()}>
            <Sparkles size={15} />
            {ai.loading ? '生成中...' : '生成复盘草稿'}
          </button>
          {ai.loading && <button type="button" onClick={ai.cancelGeneration}>取消生成</button>}
        </div>
      </ReviewSectionHeading>

      {ai.settingsOpen && (
        <div className="ai-settings-panel">
          <div className="ai-settings-head">
            <div>
              <span>AI API</span>
              <strong>
                {dashboard.ai.enabled
                  ? `${dashboard.ai.provider} · ${dashboard.ai.model || '未选模型'}`
                  : '默认使用本地总结'}
              </strong>
            </div>
            <label className="ai-toggle">
              <input
                type="checkbox"
                checked={dashboard.ai.enabled}
                onChange={(event) => ai.updateSettings({ enabled: event.target.checked })}
              />
              <span>{dashboard.ai.enabled ? '已启用' : '未启用'}</span>
            </label>
          </div>

          <div className="ai-settings-grid">
            <EditorField label="提供商">
              <ThemedSelect
                compact
                value={dashboard.ai.provider}
                aria-label="AI 提供商"
                options={aiProviderOptions}
                onChange={(provider) => ai.setProvider(provider as AiProvider)}
              />
            </EditorField>
            <EditorField label="API Key">
              <input
                type="password"
                value={dashboard.ai.apiKey}
                placeholder="只保存在本机 localStorage"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => ai.updateSettings({ apiKey: event.target.value })}
              />
            </EditorField>
            <EditorField label="API 地址" className="ai-base-field">
              <input
                value={dashboard.ai.baseUrl}
                placeholder="https://api.openai.com/v1"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => ai.updateSettings({ baseUrl: event.target.value })}
              />
            </EditorField>
            <EditorField label="模型">
              <input
                value={dashboard.ai.model}
                placeholder="gpt-4.1-mini"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => ai.updateSettings({ model: event.target.value })}
              />
            </EditorField>
          </div>

          <div className="ai-settings-note">
            <span>提示词会自动读取今日任务、项目、暂存、提醒和复盘输入。</span>
            <button type="button" className="secondary-action" onClick={ai.closeSettings}>
              完成
            </button>
          </div>

          {/* 只有启用了 AI 才提示配置缺失，否则没接 API 的用户会一直看到红字。 */}
          {dashboard.ai.enabled && ai.settingsIssue && (
            <p className="ai-error">{ai.settingsIssue}</p>
          )}
          {ai.error && <p className="ai-error">{ai.error}</p>}
        </div>
      )}

      <div className="review-summary">
        <div>
          <Sparkles size={17} />
          <span>{summaryModeLabel}</span>
        </div>
        <pre>
          {dashboard.reviewSummary ||
            '点“生成复盘草稿”后，会根据今天完成项、项目、暂存、提醒和复盘输入生成一段轻量复盘。'}
        </pre>
      </div>
    </section>
  )
}
