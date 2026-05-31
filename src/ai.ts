import type {
  AiSettings,
  AiSummaryRequest,
  AiSummaryResponse,
  DashboardState,
  DesktopSettings,
  GlobalShortcutSettings,
  GlobalShortcutStatus,
} from './types'
import { daysUntil, todayIso } from './utils'

declare global {
  interface Window {
    commandDeck?: {
      generateAiSummary: (request: AiSummaryRequest) => Promise<AiSummaryResponse>
      getDesktopSettings: () => Promise<{
        settings: DesktopSettings
        shortcut: GlobalShortcutStatus
      }>
      updateGlobalShortcut: (
        request: GlobalShortcutSettings,
      ) => Promise<{
        settings: DesktopSettings
        shortcut: GlobalShortcutStatus
      }>
    }
  }
}

const listLines = (items: string[], fallback: string) =>
  items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${fallback}`

export const buildReviewPrompt = (dashboard: DashboardState) => {
  const completedTasks = dashboard.tasks
    .filter((task) => task.done)
    .map((task) => `${task.kind === 'top' ? 'Top 3' : '待办'}：${task.title}`)
  const openTasks = dashboard.tasks
    .filter((task) => !task.done)
    .map((task) => `${task.kind === 'top' ? 'Top 3' : '待办'}：${task.title}`)
  const projects = dashboard.projects.map(
    (project) =>
      `${project.name}：下一步 ${project.nextAction || '未填写'}，累计 ${project.minutes} 分钟`,
  )
  const inbox = dashboard.inbox.map((item) => item.text)
  const tomorrowTasks = dashboard.tomorrowTasks.map(
    (task) => `${task.kind === 'top' ? 'Top 3' : '待办'}：${task.title}`,
  )
  const reminders = dashboard.reminders
    .slice()
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
    .map((item) => {
      const days = daysUntil(item.date)
      const countdown = days < 0 ? '已过期' : days === 0 ? '今天' : `${days} 天后`
      return `${item.title}（${item.type}，${item.date}，${countdown}）`
    })

  return [
    '请根据下面的个人指挥台数据，生成一段中文收工复盘。',
    '要求：具体、短、像给自己看的行动复盘；不要鸡汤；不要编造没有给出的事实；如果信息不足就温和指出并给明天第一步。',
    '输出固定为三段，每段一行：',
    '今日推进：...',
    '卡点观察：...',
    '明天第一步：...',
    '',
    `日期：${todayIso()}`,
    `今日模式：${dashboard.dayMode}`,
    `能量：${dashboard.energy}/5`,
    `当前专注：${dashboard.currentFocus || '未记录'}`,
    `专注累计：${dashboard.projects.reduce((total, project) => total + project.minutes, 0)} 分钟`,
    '',
    '复盘输入：',
    `- 今天做了什么：${dashboard.review.did.trim() || '未填写'}`,
    `- 卡在哪里：${dashboard.review.stuck.trim() || '未填写'}`,
    `- 明天第一件事：${dashboard.review.tomorrow.trim() || '未填写'}`,
    '',
    '已布置的明日任务：',
    listLines(tomorrowTasks, '暂无明日任务'),
    '',
    '已完成任务：',
    listLines(completedTasks, '暂无已完成任务'),
    '',
    '未完成任务：',
    listLines(openTasks, '暂无未完成任务'),
    '',
    '项目推进：',
    listLines(projects, '暂无项目'),
    '',
    '灵感暂存：',
    listLines(inbox, '暂无暂存灵感'),
    '',
    '提醒与倒计时：',
    listLines(reminders, '暂无提醒'),
  ].join('\n')
}

export const getAiSettingsIssue = (settings: AiSettings) => {
  if (!settings.apiKey.trim()) return '请先填写 API Key'
  if (!settings.baseUrl.trim()) return '请先填写 API 地址'
  if (!settings.model.trim()) return '请先填写模型名称'
  return ''
}

export const requestAiSummary = async (
  settings: AiSettings,
  prompt: string,
) => {
  const issue = getAiSettingsIssue(settings)
  if (issue) throw new Error(issue)

  const request: AiSummaryRequest = {
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
    prompt,
  }

  if (window.commandDeck?.generateAiSummary) {
    const response = await window.commandDeck.generateAiSummary(request)
    return response.content.trim()
  }

  const endpoint = `${request.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        {
          role: 'system',
          content:
            '你是一个克制、具体的个人复盘助手，只输出用户要求的中文复盘内容。',
        },
        { role: 'user', content: request.prompt },
      ],
      temperature: 0.4,
    }),
  })

  const data = (await response.json().catch(() => null)) as
    | { error?: { message?: string }; choices?: { message?: { content?: string } }[] }
    | null

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `API 请求失败：${response.status}`)
  }

  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('API 没有返回总结内容')
  return content
}
