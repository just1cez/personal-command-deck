/**
 * 所有"可枚举选项"的唯一数据源。
 *
 * 这个模块的存在意义是**可扩展性**：想加一个主题、一个 AI 提供商、一种提醒类型或
 * 一个入口图标时，只需要在这里加一行，下拉框、图标渲染、默认值、数据校验都会自动跟上。
 *
 * 反例（重构前的做法）：图标名同时写在 `linkIconOptions` 和 `IconByName` 的 if 链里，
 * AI 提供商同时写在 `aiProviderOptions` 和 `aiProviderDefaults` 里，加一项要改两三处。
 */
import {
  Archive,
  Brain,
  CalendarClock,
  FileText,
  Flame,
  Focus,
  Gauge,
  Globe2,
  Link,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Sparkles,
  SquareCheckBig,
  Star,
  Sun,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type {
  AiProvider,
  DayMode,
  DesktopNoteColor,
  MainView,
  SelectOption,
  Theme,
} from '../types'

/* -------------------------------------------------------------------------- */
/* 主视图                                                                      */
/* -------------------------------------------------------------------------- */

export type MainViewOption = {
  value: MainView
  label: string
  hint: string
  icon: React.ReactNode
}

/** 顶部主导航；数组顺序即标签顺序。 */
export const mainViewOptions: MainViewOption[] = [
  { value: 'start', label: '聚焦', hint: '本轮目标', icon: <Focus size={17} /> },
  { value: 'execute', label: '推进', hint: '任务项目', icon: <SquareCheckBig size={17} /> },
  { value: 'review', label: '复盘', hint: '总结归档', icon: <Moon size={17} /> },
]

/* -------------------------------------------------------------------------- */
/* 今日模式与主题                                                              */
/* -------------------------------------------------------------------------- */

export const dayModeOptions: Array<{ value: DayMode; label: string; icon: React.ReactNode }> = [
  { value: '工作日', label: '工作日', icon: <Gauge size={15} /> },
  { value: '周末', label: '周末', icon: <Sun size={15} /> },
  { value: '冲刺', label: '冲刺', icon: <Flame size={15} /> },
  { value: '摸鱼恢复', label: '恢复', icon: <Moon size={15} /> },
]

/**
 * 主题选项。value 会写进 `document.documentElement.dataset.theme`，
 * 新增主题时需要同时在 App.css 里补 `[data-theme='xxx']` 的变量。
 */
export const themeOptions: SelectOption[] = [
  { value: 'dark', label: '深色', icon: <Moon size={15} /> },
  { value: 'clean', label: '清爽', icon: <Sun size={15} /> },
  { value: 'cyber', label: '赛博朋克', icon: <Zap size={15} /> },
  { value: 'paper', label: '纸质笔记', icon: <Pencil size={15} /> },
]

/** 供 state/normalize.ts 校验历史数据用；与上面的选项列表自动保持一致。 */
export const validThemes = new Set(themeOptions.map((option) => option.value as Theme))
export const validDayModes = new Set(dayModeOptions.map((option) => option.value))

/* -------------------------------------------------------------------------- */
/* 桌面便笺                                                                    */
/* -------------------------------------------------------------------------- */

export const desktopNoteColorOptions: Array<{
  value: DesktopNoteColor
  label: string
}> = [
  { value: 'yellow', label: '暖黄' },
  { value: 'green', label: '薄荷绿' },
  { value: 'blue', label: '雾蓝' },
  { value: 'rose', label: '浅粉' },
  { value: 'slate', label: '石墨灰' },
]

export const validDesktopNoteColors = new Set<DesktopNoteColor>(
  desktopNoteColorOptions.map((option) => option.value),
)

/* -------------------------------------------------------------------------- */
/* 快捷入口图标                                                                */
/* -------------------------------------------------------------------------- */

type LinkIconEntry = {
  label: string
  Icon: LucideIcon
  /** false = 不出现在下拉框里，只用于兼容历史数据中残留的图标名。 */
  selectable: boolean
}

/**
 * 快捷入口图标注册表：键即存进 localStorage 的图标名。
 * 对象的键顺序决定下拉框顺序。
 */
const linkIconRegistry: Record<string, LinkIconEntry> = {
  link: { label: 'Link', Icon: Link, selectable: true },
  github: { label: 'GitHub', Icon: Globe2, selectable: true },
  sparkles: { label: 'AI', Icon: Sparkles, selectable: true },
  zap: { label: 'Zap', Icon: Zap, selectable: true },
  mail: { label: 'Mail', Icon: Mail, selectable: true },
  calendar: { label: 'Calendar', Icon: CalendarClock, selectable: true },
  doc: { label: 'Docs', Icon: FileText, selectable: true },
  // 以下图标名不再提供选择，但老数据里可能存在，保留渲染能力避免退化成默认图标。
  sun: { label: 'Sun', Icon: Sun, selectable: false },
  star: { label: 'Star', Icon: Star, selectable: false },
  globe: { label: 'Globe', Icon: Globe2, selectable: false },
}

/**
 * 图标名 -> 组件。
 * 导出成映射表而不是查询函数：组件在渲染中直接索引即可，
 * 静态分析能看出这是"取一个已存在的组件"，而不是"当场造一个组件"。
 */
export const linkIconComponents: Record<string, LucideIcon> = Object.fromEntries(
  Object.entries(linkIconRegistry).map(([name, entry]) => [name, entry.Icon]),
)

/** 下拉框可选的图标列表。 */
export const linkIconOptions: SelectOption[] = Object.entries(linkIconRegistry)
  .filter(([, entry]) => entry.selectable)
  .map(([value, entry]) => ({
    value,
    label: entry.label,
    icon: <entry.Icon size={15} />,
  }))

/** 数据规范化时用来判断"这个图标名还能不能选"。 */
export const selectableLinkIcons = new Set(linkIconOptions.map((option) => option.value))

/* -------------------------------------------------------------------------- */
/* 提醒类型                                                                    */
/* -------------------------------------------------------------------------- */

export const reminderTypeOptions: SelectOption[] = [
  { value: 'Deadline', label: 'Deadline', icon: <CalendarClock size={15} /> },
  { value: '账单', label: '账单', icon: <SquareCheckBig size={15} /> },
  { value: '生日', label: '生日', icon: <Sparkles size={15} /> },
  { value: '面试', label: '面试', icon: <Brain size={15} /> },
  { value: '旅行', label: '旅行', icon: <MapPin size={15} /> },
  { value: '其他', label: '其他', icon: <Link size={15} /> },
]

/* -------------------------------------------------------------------------- */
/* 本机保留策略                                                                */
/* -------------------------------------------------------------------------- */

/** 保留天数快捷选项；`0` 表示永久保留，界面上也允许输入任意自定义天数。 */
export const retentionOptions: SelectOption[] = [
  { value: '0', label: '永久保留' },
  { value: '30', label: '30 天' },
  { value: '90', label: '90 天' },
  { value: '180', label: '180 天' },
  { value: '365', label: '1 年' },
].map((option) => ({
  ...option,
  icon: option.value === '0' ? <Archive size={15} /> : <CalendarClock size={15} />,
}))

/* -------------------------------------------------------------------------- */
/* AI 提供商                                                                   */
/* -------------------------------------------------------------------------- */

type AiProviderEntry = {
  value: AiProvider
  label: string
  icon: React.ReactNode
  /** 切换提供商时自动填入的地址；留空表示保持用户当前填写的值。 */
  baseUrl: string
  model: string
}

/**
 * AI 提供商注册表：下拉框选项与默认地址/模型都从这里派生，加提供商只改这一处。
 * 注意：接口按 OpenAI 的 `/chat/completions` 协议调用，新增提供商需兼容该协议。
 */
const aiProviders: AiProviderEntry[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    icon: <Sparkles size={15} />,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    icon: <Zap size={15} />,
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    value: 'moonshot',
    label: 'Moonshot',
    icon: <Moon size={15} />,
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    value: 'custom',
    label: '自定义',
    icon: <Globe2 size={15} />,
    baseUrl: '',
    model: '',
  },
]

export const aiProviderOptions: SelectOption[] = aiProviders.map(({ value, label, icon }) => ({
  value,
  label,
  icon,
}))

export const aiProviderDefaults = Object.fromEntries(
  aiProviders.map((provider) => [
    provider.value,
    { baseUrl: provider.baseUrl, model: provider.model },
  ]),
) as Record<AiProvider, { baseUrl: string; model: string }>

export const validAiProviders = new Set<AiProvider>(aiProviders.map((provider) => provider.value))
