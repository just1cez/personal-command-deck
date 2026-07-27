/**
 * 每日名言池。
 *
 * 规则：
 * - 每天抽一句，抽中结果连同日期存进 `dailyQuote`，当天刷新页面不会换句子；
 * - 只在启用的名言里抽，并尽量避开上一句；
 * - 内置名言池升级时（QUOTE_POOL_VERSION +1），把用户没删过的新句子合并进来。
 */
import { QUOTE_POOL_VERSION } from '../config/constants'
import type { DailyQuote, Quote, StoredDashboardState } from '../types'
import { todayIso, uid } from '../utils'
import { isPlainObject, trimmedText } from './parsers'

/**
 * 曾经内置、后来下架的名言 id。
 * 记在这里是为了在版本合并时避免它们"复活"。
 */
const retiredDefaultQuoteIds = new Set(['quote-confucius-mountain'])

export const defaultQuotes: Quote[] = [
  {
    id: 'quote-turing-short-road',
    text: '我们只能看见前方很短的一段路，但能看见那里有许多事要做。',
    author: 'Alan Turing',
    enabled: true,
  },
  {
    id: 'quote-drucker-future',
    text: '预测未来最好的方法，就是把它创造出来。',
    author: 'Peter Drucker',
    enabled: true,
  },
  {
    id: 'quote-mlk-staircase',
    text: '你不需要看完整个楼梯，只要踏出第一步。',
    author: 'Martin Luther King Jr.',
    enabled: true,
  },
  {
    id: 'quote-clarke-magic',
    text: '任何足够先进的技术，都与魔法无异。',
    author: 'Arthur C. Clarke',
    enabled: true,
  },
  {
    id: 'quote-einstein-explain',
    text: '如果你不能把它解释清楚，你就还没有真正理解它。',
    author: 'Albert Einstein',
    enabled: true,
  },
  {
    id: 'quote-edison-failure',
    text: '我没有失败。我只是发现了一万种行不通的方法。',
    author: 'Thomas Edison',
    enabled: true,
  },
  {
    id: 'quote-edison-genius',
    text: '天才是百分之一的灵感，加上百分之九十九的汗水。',
    author: 'Thomas Edison',
    enabled: true,
  },
  {
    id: 'quote-luce-simplicity',
    text: '简单是复杂的最终形态。',
    author: 'Clare Boothe Luce',
    enabled: true,
  },
  {
    id: 'quote-kierkegaard-life',
    text: '生活只能向后理解，但必须向前生活。',
    author: 'Søren Kierkegaard',
    enabled: true,
  },
  {
    id: 'quote-einstein-question',
    text: '重要的不是停止提问。',
    author: 'Albert Einstein',
    enabled: true,
  },
  {
    id: 'quote-pasteur-chance',
    text: '机会总是留给有准备的人。',
    author: 'Louis Pasteur',
    enabled: true,
  },
  {
    id: 'quote-socrates-ignorance',
    text: '知道自己无知，才是真正的知识。',
    author: 'Socrates',
    enabled: true,
  },
  {
    id: 'quote-maya-angelou-courage',
    text: '勇气是所有美德中最重要的，因为没有勇气，你无法持续实践其他任何美德。',
    author: 'Maya Angelou',
    enabled: true,
  },
  {
    id: 'quote-deck-small-step',
    text: '先推进能落地的一小步。',
    author: 'Personal Command Deck',
    enabled: true,
  },
]

/** 名言池被清空或全部停用时显示的兜底句。 */
export const fallbackQuote: Quote = {
  id: 'quote-fallback',
  text: '先做最重要的那一步。',
  author: 'Custom',
  enabled: true,
}

/**
 * 随机抽一条启用中的名言。
 * `excludedId` 用来尽量避开上一句；如果排除后没得选了，就退回全量池子。
 */
export const pickQuoteId = (quotes: Quote[], excludedId?: string) => {
  const enabledQuotes = quotes.filter((quote) => quote.enabled)
  if (!enabledQuotes.length) return fallbackQuote.id

  const candidates = enabledQuotes.filter((quote) => quote.id !== excludedId)
  const pool = candidates.length ? candidates : enabledQuotes
  return pool[Math.floor(Math.random() * pool.length)].id
}

/** 按 id 找一条**启用中**的名言；被停用或已删除都会返回 undefined。 */
export const getQuoteById = (quotes: Quote[], quoteId: string) =>
  quotes.find((quote) => quote.id === quoteId && quote.enabled)

/**
 * 解析"今天该显示哪一句"。
 * 只有当记录的日期是今天、且那条名言仍然可用时才沿用，否则重新抽一条。
 */
export const resolveDailyQuote = (
  quotePool: Quote[],
  dailyQuote?: Partial<DailyQuote>,
): DailyQuote => {
  const today = todayIso()
  if (
    dailyQuote?.date === today &&
    dailyQuote.quoteId &&
    getQuoteById(quotePool, dailyQuote.quoteId)
  ) {
    return { date: today, quoteId: dailyQuote.quoteId }
  }

  return { date: today, quoteId: pickQuoteId(quotePool) }
}

/**
 * 规范化名言相关的三个字段，并完成两类迁移：
 * 1. 内置池升级：把用户没删过的新内置名言补进来；
 * 2. 早期版本的单条 `motto`：作为一条自定义名言并入池子。
 */
export const normalizeQuotes = (parsed: StoredDashboardState) => {
  const quotePool = Array.isArray(parsed.quotePool)
    ? parsed.quotePool
        .map((quote) => {
          const item: Record<string, unknown> = isPlainObject(quote) ? quote : {}
          return {
            id: trimmedText(item.id) || uid(),
            text: trimmedText(item.text),
            author: trimmedText(item.author),
            // 缺字段时默认启用，只有显式 false 才算停用。
            enabled: item.enabled !== false,
          }
        })
        .filter(
          (quote) => quote.text && quote.author && !retiredDefaultQuoteIds.has(quote.id),
        )
    : defaultQuotes

  const existingQuoteIds = new Set(quotePool.map((quote) => quote.id))
  const upgradedQuotePool =
    (parsed.quotePoolVersion ?? 1) < QUOTE_POOL_VERSION
      ? [...quotePool, ...defaultQuotes.filter((quote) => !existingQuoteIds.has(quote.id))]
      : quotePool

  const legacyMotto = parsed.motto?.trim()
  const migratedQuotePool =
    legacyMotto && !upgradedQuotePool.some((quote) => quote.text === legacyMotto)
      ? [...upgradedQuotePool, { id: uid(), text: legacyMotto, author: 'Custom', enabled: true }]
      : upgradedQuotePool

  return {
    quotePoolVersion: QUOTE_POOL_VERSION,
    quotePool: migratedQuotePool,
    dailyQuote: resolveDailyQuote(migratedQuotePool, parsed.dailyQuote),
  }
}
