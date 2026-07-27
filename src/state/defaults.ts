/**
 * 首次启动（或本地数据损坏）时的初始状态。
 *
 * 这份数据同时承担"示例"职责：新用户打开就能看到一个填好的面板，
 * 知道每个区域该放什么，而不是面对一堆空列表。
 *
 * 注意：`uid()` / `todayIso()` 在模块加载时求值，因此 defaultState 是一份
 * 在本次会话内固定的快照——不要在多处 mutate 它。
 */
import {
  DEFAULT_FOCUS_MINUTES,
  DEFAULT_PROJECT_NAME,
  QUOTE_POOL_VERSION,
} from '../config/constants'
import type { DashboardState } from '../types'
import { dateAfter, todayIso, uid } from '../utils'
import { defaultQuotes, pickQuoteId } from './quotes'

export const defaultState: DashboardState = {
  quotePoolVersion: QUOTE_POOL_VERSION,
  quotePool: defaultQuotes,
  dailyQuote: { date: todayIso(), quoteId: pickQuoteId(defaultQuotes) },
  dailyCarryoverDate: todayIso(),
  theme: 'dark',
  dayMode: '工作日',
  energy: 4,
  weather: {
    icon: '☀',
    temp: '27°',
    label: 'Hong Kong',
    condition: '手动天气',
  },
  currentFocus: '个人指挥台 MVP',
  tasks: [
    { id: uid(), title: '确定今天最重要的一个推进点', done: false, kind: 'top', focusSeconds: 0 },
    { id: uid(), title: '完成个人指挥台本地版主界面', done: false, kind: 'top', focusSeconds: 0 },
    { id: uid(), title: '睡前写 3 分钟复盘', done: false, kind: 'top', focusSeconds: 0 },
    { id: uid(), title: '整理下载文件夹', done: false, kind: 'todo', focusSeconds: 0 },
    { id: uid(), title: '回复两封需要处理的邮件', done: true, kind: 'todo', focusSeconds: 0 },
  ],
  tomorrowTasks: [
    {
      id: uid(),
      title: '打开聚焦页，确认第一轮要推进什么',
      done: false,
      kind: 'top',
      focusSeconds: 0,
    },
  ],
  projects: [
    {
      id: uid(),
      name: DEFAULT_PROJECT_NAME,
      nextAction: '把常用入口和今日面板调顺手',
      minutes: 0,
      focusSeconds: 0,
      active: true,
    },
    {
      id: uid(),
      name: '健身',
      nextAction: '安排下一次 30 分钟力量训练',
      minutes: 0,
      focusSeconds: 0,
      active: true,
    },
    {
      id: uid(),
      name: '写作',
      nextAction: '写一段关于本周状态的短笔记',
      minutes: 0,
      focusSeconds: 0,
      active: true,
    },
  ],
  quickLinks: [
    { id: uid(), label: 'GitHub', url: 'https://github.com', icon: 'github' },
    { id: uid(), label: 'ChatGPT', url: 'https://chat.openai.com', icon: 'sparkles' },
    { id: uid(), label: 'Gemini', url: 'https://gemini.google.com', icon: 'zap' },
    { id: uid(), label: 'Mail', url: 'https://mail.google.com', icon: 'mail' },
    { id: uid(), label: 'Calendar', url: 'https://calendar.google.com', icon: 'calendar' },
    { id: uid(), label: 'Docs', url: 'https://docs.google.com', icon: 'doc' },
  ],
  inbox: [
    {
      id: uid(),
      text: '做个自动整理截图的小工具',
      createdAt: new Date().toISOString(),
    },
  ],
  reminders: [
    { id: uid(), title: '信用卡账单', date: dateAfter(5), type: '账单' },
    { id: uid(), title: '妈妈生日', date: dateAfter(19), type: '生日' },
    { id: uid(), title: 'Side Project 里程碑', date: dateAfter(12), type: 'Deadline' },
  ],
  review: {
    did: '',
    stuck: '',
    tomorrow: '',
  },
  reviewSummary: '',
  ai: {
    // 默认走本地总结，用户主动填了 Key 才会联网。
    enabled: false,
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  retention: {
    // 0 = 永久保留，默认不替用户删任何东西。
    reviewArchiveDays: 0,
    completedProjectDays: 0,
  },
  archives: [],
  focus: {
    running: false,
    secondsLeft: DEFAULT_FOCUS_MINUTES * 60,
    durationMinutes: DEFAULT_FOCUS_MINUTES,
    projectId: '',
    taskLabel: '',
    taskId: '',
  },
}
