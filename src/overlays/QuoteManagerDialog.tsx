/**
 * 名言池管理。
 *
 * 三种操作：新增自己的句子、临时停用不想看到的、彻底删除。
 * 停用而不删除是有意保留的中间态——很多句子只是"最近不想看"。
 */
import { useState } from 'react'
import { Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import { useQuoteActions } from '../actions/useQuoteActions'
import { QUOTE_AUTHOR_MAX_LENGTH, QUOTE_TEXT_MAX_LENGTH } from '../config/constants'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import { fallbackQuote, getQuoteById } from '../state/quotes'

export function QuoteManagerDialog() {
  const { dashboard } = useDashboardStore()
  const { quoteManagerOpen, setQuoteManagerOpen } = useDeckUi()
  const { addQuote, updateQuote, toggleQuote, removeQuote, rerollDailyQuote } = useQuoteActions()

  const [newText, setNewText] = useState('')
  const [newAuthor, setNewAuthor] = useState('')

  if (!quoteManagerOpen) return null

  const todaysQuote =
    getQuoteById(dashboard.quotePool, dashboard.dailyQuote.quoteId) ?? fallbackQuote
  const enabledCount = dashboard.quotePool.filter((quote) => quote.enabled).length
  const canAdd = newText.trim().length > 0 && newAuthor.trim().length > 0

  const submitNewQuote = () => {
    if (!addQuote(newText, newAuthor)) return
    setNewText('')
    setNewAuthor('')
  }

  return (
    <div
      className="command-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => setQuoteManagerOpen(false)}
    >
      <div className="quote-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="quote-manager-header">
          <div>
            <Sparkles size={20} />
            <div>
              <h2>名言池</h2>
              <span>{enabledCount} 条启用</span>
            </div>
          </div>
          <div className="quote-manager-actions">
            <button className="quote-reroll-button" type="button" onClick={rerollDailyQuote}>
              <RefreshCw size={15} />
              今天换一句
            </button>
            <button
              className="icon-button"
              type="button"
              title="关闭名言池"
              onClick={() => setQuoteManagerOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="quote-current">
          <span>今日显示</span>
          <strong>{todaysQuote.text}</strong>
          <small>-- {todaysQuote.author}</small>
        </div>

        <div className="quote-form">
          <textarea
            value={newText}
            maxLength={QUOTE_TEXT_MAX_LENGTH}
            placeholder="新增一句有明确作者的名言"
            aria-label="新增名言正文"
            onChange={(event) => setNewText(event.target.value)}
          />
          <input
            value={newAuthor}
            maxLength={QUOTE_AUTHOR_MAX_LENGTH}
            placeholder="作者"
            aria-label="新增名言作者"
            onChange={(event) => setNewAuthor(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNewQuote()
            }}
          />
          <button type="button" disabled={!canAdd} onClick={submitNewQuote}>
            <Plus size={16} />
            添加
          </button>
        </div>

        <div className="quote-list">
          {dashboard.quotePool.map((quote) => (
            <div
              className={[
                'quote-row',
                quote.enabled ? '' : 'disabled',
                quote.id === dashboard.dailyQuote.quoteId ? 'selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={quote.id}
            >
              <label className="quote-toggle">
                <input
                  type="checkbox"
                  checked={quote.enabled}
                  onChange={() => toggleQuote(quote.id)}
                />
                <span>{quote.enabled ? '启用' : '停用'}</span>
              </label>
              <textarea
                value={quote.text}
                maxLength={QUOTE_TEXT_MAX_LENGTH}
                aria-label={`${quote.author} 名言正文`}
                onChange={(event) => updateQuote(quote.id, { text: event.target.value })}
              />
              <input
                value={quote.author}
                maxLength={QUOTE_AUTHOR_MAX_LENGTH}
                aria-label={`${quote.text} 作者`}
                onChange={(event) => updateQuote(quote.id, { author: event.target.value })}
              />
              <button
                className="icon-button danger"
                type="button"
                title="删除名言"
                onClick={() => removeQuote(quote.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!dashboard.quotePool.length && (
            <p className="quote-empty">名言池已清空，会显示兜底文案。</p>
          )}
        </div>
      </div>
    </div>
  )
}
