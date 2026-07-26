/**
 * 命令面板的搜索结果。
 *
 * 四类可搜索对象各自映射成一行"标题 + 说明 + 类型 + 点击动作"。
 * 想让新的东西可被搜索，只要在 rows 里再拼一段 map 即可。
 */
import { useMemo } from 'react'
import { useFocusActions } from '../actions/useFocusActions'
import { useQuickLinkActions } from '../actions/useCaptureActions'
import { useTaskActions } from '../actions/useTaskActions'
import { useDashboardStore } from '../state/deckContext'

export type CommandRow = {
  id: string
  title: string
  meta: string
  type: string
  action: () => void
}

/** 无搜索词时展示的条数（相当于"最近可用项"）。 */
const IDLE_RESULT_LIMIT = 8
/** 有搜索词时的最大结果数。 */
const SEARCH_RESULT_LIMIT = 10

export const useCommandResults = (query: string): CommandRow[] => {
  const { dashboard, stats } = useDashboardStore()
  const { openQuickLink } = useQuickLinkActions()
  const { toggleTask } = useTaskActions()
  const { openProjectFocusDialog } = useFocusActions()

  const { quickLinks, tasks, inbox } = dashboard
  const { activeProjects } = stats

  return useMemo(() => {
    const rows: CommandRow[] = [
      ...quickLinks.map((item) => ({
        id: `link-${item.id}`,
        title: item.label,
        meta: item.url,
        type: '快速入口',
        action: () => openQuickLink(item.url),
      })),
      ...tasks.map((item) => ({
        id: `task-${item.id}`,
        title: item.title,
        meta: item.kind === 'top' ? '今日 Top 3' : '普通待办',
        type: '任务',
        action: () => toggleTask(item.id),
      })),
      ...activeProjects.map((item) => ({
        id: `project-${item.id}`,
        title: item.name,
        meta: item.nextAction,
        type: '项目',
        action: () => openProjectFocusDialog(item),
      })),
      ...inbox.map((item) => ({
        id: `inbox-${item.id}`,
        title: item.text,
        meta: '灵感暂存箱',
        type: '灵感',
        // 灵感条目只用于查看，点击相当于关闭面板（关闭动作由调用方统一执行）。
        action: () => {},
      })),
    ]

    const keyword = query.trim().toLowerCase()
    if (!keyword) return rows.slice(0, IDLE_RESULT_LIMIT)

    return rows
      .filter(
        (row) =>
          row.title.toLowerCase().includes(keyword) ||
          row.meta.toLowerCase().includes(keyword) ||
          row.type.toLowerCase().includes(keyword),
      )
      .slice(0, SEARCH_RESULT_LIMIT)
  }, [
    activeProjects,
    inbox,
    openProjectFocusDialog,
    openQuickLink,
    query,
    quickLinks,
    tasks,
    toggleTask,
  ])
}
