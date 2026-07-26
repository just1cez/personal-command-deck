/**
 * 名言池的增删改与"今天换一句"。
 *
 * 贯穿所有动作的一条规则：**当天显示的那句永远必须是可用的**。
 * 只要池子变动可能让它失效（停用、删除），就立刻重新抽一句。
 */
import { useCallback } from 'react'
import { fallbackQuote, getQuoteById, pickQuoteId } from '../state/quotes'
import { useDashboardStore } from '../state/deckContext'
import type { DashboardState, Quote } from '../types'
import { todayIso, uid } from '../utils'

/** 池子变动后重新确认今日名言：还能用就保持不变，不能用就换一句。 */
const ensureUsableDailyQuote = (
  current: DashboardState,
  quotePool: Quote[],
  changedQuoteId: string,
): DashboardState['dailyQuote'] =>
  getQuoteById(quotePool, current.dailyQuote.quoteId)
    ? current.dailyQuote
    : { date: todayIso(), quoteId: pickQuoteId(quotePool, changedQuoteId) }

export const useQuoteActions = () => {
  const { updateDashboard } = useDashboardStore()

  const addQuote = useCallback(
    (rawText: string, rawAuthor: string) => {
      const text = rawText.trim()
      const author = rawAuthor.trim()
      // 要求必须有作者：这样名言池不会退化成随手记事本。
      if (!text || !author) return false

      const quote: Quote = { id: uid(), text, author, enabled: true }
      updateDashboard(
        (current) => ({
          ...current,
          quotePool: [quote, ...current.quotePool],
          // 之前池子是空的（在显示兜底句），新加的这句立刻顶上。
          dailyQuote:
            current.dailyQuote.quoteId === fallbackQuote.id
              ? { date: todayIso(), quoteId: quote.id }
              : current.dailyQuote,
        }),
        '添加名言',
      )
      return true
    },
    [updateDashboard],
  )

  /** 编辑正文或作者；改成空白视为无效编辑，直接忽略。 */
  const updateQuote = useCallback(
    (id: string, patch: Partial<Quote>) => {
      const text = patch.text?.trim()
      const author = patch.author?.trim()
      if (patch.text !== undefined && !text) return
      if (patch.author !== undefined && !author) return

      updateDashboard(
        (current) => ({
          ...current,
          quotePool: current.quotePool.map((quote) =>
            quote.id === id
              ? { ...quote, ...patch, text: text ?? quote.text, author: author ?? quote.author }
              : quote,
          ),
        }),
        '编辑名言',
      )
    },
    [updateDashboard],
  )

  const toggleQuote = useCallback(
    (id: string) => {
      updateDashboard((current) => {
        const quotePool = current.quotePool.map((quote) =>
          quote.id === id ? { ...quote, enabled: !quote.enabled } : quote,
        )
        return {
          ...current,
          quotePool,
          dailyQuote: ensureUsableDailyQuote(current, quotePool, id),
        }
      }, '启用/停用名言')
    },
    [updateDashboard],
  )

  const removeQuote = useCallback(
    (id: string) => {
      updateDashboard((current) => {
        const quotePool = current.quotePool.filter((quote) => quote.id !== id)
        return {
          ...current,
          quotePool,
          dailyQuote: ensureUsableDailyQuote(current, quotePool, id),
        }
      }, '删除名言')
    },
    [updateDashboard],
  )

  /** 手动换一句；会尽量避开当前这句。 */
  const rerollDailyQuote = useCallback(() => {
    updateDashboard(
      (current) => ({
        ...current,
        dailyQuote: {
          date: todayIso(),
          quoteId: pickQuoteId(current.quotePool, current.dailyQuote.quoteId),
        },
      }),
      '更换今日名言',
    )
  }, [updateDashboard])

  return { addQuote, updateQuote, toggleQuote, removeQuote, rerollDailyQuote }
}
