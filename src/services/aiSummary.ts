/**
 * AI 复盘总结。
 *
 * 请求路径有两条：
 * - 桌面版：交给主进程转发（API Key 不经过渲染进程的网络栈，也避开跨域限制）；
 * - Web 端：浏览器直接按 OpenAI 的 `/chat/completions` 协议请求。
 *
 * 不联网时的本地兜底方案在 domain/summary.ts。
 */
import type { AiSettings, AiSummaryRequest, DashboardState } from '../types'
import { daysUntil, todayIso } from '../utils'
import { sortRemindersByDate } from '../domain/reminders'
import { selectDailyFocus } from '../domain/focusRecords'
import { canProxyAiSummary, getDesktopBridge } from './desktopBridge'

/** 把一组条目排成 markdown 列表；空列表用一句兜底说明代替，避免提示词里出现空段落。 */
const listLines = (items: string[], fallback: string) =>
  items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${fallback}`

/**
 * 组装复盘提示词。
 *
 * 设计要点：
 * - 先给约束（要具体、不要鸡汤、不要编造），再给事实；
 * - 固定输出三段，方便和本地总结的格式对齐，用户切换时观感一致；
 * - 所有事实都来自本地数据，不含 API Key 等敏感信息。
 */
export const buildReviewPrompt = (dashboard: DashboardState) => {
  const dailyFocus = selectDailyFocus(dashboard, todayIso())
  const describeTask = (task: { kind: string; title: string }) =>
    `${task.kind === 'top' ? 'Top 3' : '待办'}：${task.title}`

  const completedTasks = dashboard.tasks.filter((task) => task.done).map(describeTask)
  const openTasks = dashboard.tasks.filter((task) => !task.done).map(describeTask)
  const tomorrowTasks = dashboard.tomorrowTasks.map(describeTask)

  const projects = dashboard.projects.map(
    (project) =>
      `${project.name}：下一步 ${project.nextAction || '未填写'}，累计 ${project.minutes} 分钟`,
  )
  const inbox = dashboard.inbox.map((item) => item.text)

  const reminders = sortRemindersByDate(dashboard.reminders).map((item) => {
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
    `今日专注：${dailyFocus.actualMinutes} 分钟（${dailyFocus.actualSeconds} 秒），计划 ${dailyFocus.plannedMinutes} 分钟，共 ${dailyFocus.segmentCount} 段`,
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

/**
 * 检查 AI 配置是否完整。
 * @returns 空字符串表示配置没问题，否则是给用户看的提示。
 */
export const getAiSettingsIssue = (settings: AiSettings) => {
  if (!settings.apiKey.trim()) return '请先填写 API Key'
  if (!settings.baseUrl.trim()) return '请先填写 API 地址'
  if (!settings.model.trim()) return '请先填写模型名称'
  return ''
}

/** 调用 AI 生成总结；配置不全或接口报错都会抛出带可读文案的 Error。 */
export const requestAiSummary = async (settings: AiSettings, prompt: string, signal?: AbortSignal) => {
  const issue = getAiSettingsIssue(settings)
  if (issue) throw new Error(issue)

  const request: AiSummaryRequest = {
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
    prompt,
  }

  // 桌面版优先走主进程，Key 不出渲染进程。
  const proxySummary = getDesktopBridge()?.generateAiSummary
  if (canProxyAiSummary() && proxySummary) {
    const response = await proxySummary(request)
    return response.content.trim()
  }

  const endpoint = `${request.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
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
          content: '你是一个克制、具体的个人复盘助手，只输出用户要求的中文复盘内容。',
        },
        { role: 'user', content: request.prompt },
      ],
      // 低温度：复盘要稳定复述事实，不需要发挥。
      temperature: 0.4,
    }),
  })

  // 出错时接口不一定返回 JSON，这里先兜住解析异常再判断状态码。
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
