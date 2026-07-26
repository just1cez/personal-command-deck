/**
 * 全局常量。
 *
 * 这里集中三类东西：
 * 1. 存储键、版本号等"改动会影响历史数据兼容性"的标识；
 * 2. 业务上限与节流间隔（Top 3 上限、专注时长范围、各种定时器周期）；
 * 3. 面向用户的状态提示 / 二次确认 / 兜底错误文案。
 *
 * 之所以把散落在各处的字面量收拢到这里：
 * - 调参时只改一个地方，不用在几千行 JSX 里翻；
 * - 文案集中后，将来要做多语言只需替换这一个模块。
 *
 * 注意：JSX 里的按钮标题、输入框 placeholder 这类"和布局绑死"的文案仍然留在原位，
 * 搬到这里反而会让组件更难读。
 */
import type { GlobalShortcutStatus } from '../types'

/* -------------------------------------------------------------------------- */
/* 本地存储                                                                    */
/* -------------------------------------------------------------------------- */

/** 仪表盘主数据在 localStorage 中的键；改动它等于放弃全部历史数据。 */
export const STORAGE_KEY = 'personal-command-dashboard-v1'

/** 记住用户上次停留的主视图（聚焦 / 推进 / 复盘）。 */
export const MAIN_VIEW_STORAGE_KEY = 'personal-command-deck-main-view'

/** 备份文件的身份标记，导入时用它判断"这是不是本应用的备份"。 */
export const BACKUP_APP_NAME = 'Personal Command Deck'

/** 备份文件格式版本，格式升级时 +1 并在 `state/backup.ts` 里加迁移分支。 */
export const BACKUP_VERSION = 1

/* -------------------------------------------------------------------------- */
/* 名言池                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 内置名言池版本。
 * 每次往 `state/quotes.ts` 的 defaultQuotes 里补充新句子时 +1，
 * 老用户下次加载时会自动把新增的内置名言合并进自己的池子（已删除的除外）。
 */
export const QUOTE_POOL_VERSION = 4

export const QUOTE_TEXT_MAX_LENGTH = 140
export const QUOTE_AUTHOR_MAX_LENGTH = 48

/* -------------------------------------------------------------------------- */
/* 任务                                                                        */
/* -------------------------------------------------------------------------- */

/** 今日 Top 3 的硬上限；刻意保持小，避免"最重要的事"退化成待办清单。 */
export const TOP_TASK_LIMIT = 3

export const TOP_TASK_TITLE_MAX_LENGTH = 60
export const TODO_TITLE_MAX_LENGTH = 80

/**
 * 完成度滑块的步进。
 * 刻意做粗：进度条只需要回答"大概推进到哪了"，精确到 1% 只会增加决策负担。
 */
export const PROGRESS_STEP = 10

/** 能量刻度；控制条上的圆点数量与数据校验共用这一份定义。 */
export const ENERGY_LEVELS = [1, 2, 3, 4, 5]
export const ENERGY_MIN = ENERGY_LEVELS[0]
export const ENERGY_MAX = ENERGY_LEVELS[ENERGY_LEVELS.length - 1]

/* -------------------------------------------------------------------------- */
/* 专注                                                                        */
/* -------------------------------------------------------------------------- */

export const FOCUS_MINUTES_MIN = 5
export const FOCUS_MINUTES_MAX = 120

/** 首次使用时的默认专注时长（一个标准番茄钟）。 */
export const DEFAULT_FOCUS_MINUTES = 25

/** 加减号按钮每次调整的分钟数。 */
export const FOCUS_MINUTES_STEP = 5

/** 项目专注弹窗里的快捷时长。 */
export const FOCUS_DURATION_PRESETS = [15, 25, 30, 45, 60]

/** 单个任务/项目累计专注秒数的上限，用于拦截脏数据（约 10 万分钟）。 */
export const FOCUS_SECONDS_MAX = 100_000 * 60

/** 单个项目累计分钟数的上限。 */
export const FOCUS_MINUTES_TOTAL_MAX = 100_000

/** 没有正在进行的专注时，`currentFocus` 显示的占位文案。 */
export const IDLE_FOCUS_LABEL = '等待下一次启动'

/**
 * 没有绑定任何项目时本轮目标的文案。
 * 一个项目都没有也应该能开始专注——先动起来比先建档更重要。
 */
export const FREE_FOCUS_LABEL = '自由专注'

/**
 * 初始数据里"主场"项目的名字。
 * 聚焦页在没有明确项目归属时会优先把时间记到它上面；用户删掉它也不影响功能，
 * 只是会退化成"记到第一个进行中的项目"。
 */
export const DEFAULT_PROJECT_NAME = '个人指挥台'

/* -------------------------------------------------------------------------- */
/* 归档与保留策略                                                              */
/* -------------------------------------------------------------------------- */

/** 本机最多保存多少条每日归档。 */
export const ARCHIVE_HISTORY_LIMIT = 60

/** 复盘页"最近归档"里展示的条数。 */
export const RECENT_ARCHIVE_LIMIT = 6

/** 保留天数上限（10 年）。0 表示永久保留。 */
export const RETENTION_MAX_DAYS = 3650

/** 保留天数步进按钮的粒度。 */
export const RETENTION_STEP_DAYS = 30

/** 剩余天数 ≤ 该值的提醒算"临近"，会高亮并计入首页信号。 */
export const URGENT_REMINDER_DAYS = 3

/** 新建提醒时默认往后推的天数。 */
export const DEFAULT_REMINDER_LEAD_DAYS = 7

/* -------------------------------------------------------------------------- */
/* 时间与定时器                                                                */
/* -------------------------------------------------------------------------- */

export const DAY_MS = 86_400_000

/** 顶部时钟刷新周期。 */
export const CLOCK_TICK_MS = 1_000

/** 专注倒计时对时周期；真正的剩余时间由 endsAt 推算，这里只负责触发重算。 */
export const FOCUS_TICK_MS = 1_000

/** 每日名言的跨天检查周期。 */
export const DAILY_QUOTE_TICK_MS = 60_000

/** 过期归档 / 已结项项目的清理周期（1 小时）。 */
export const RETENTION_SWEEP_MS = 3_600_000

/** 上移/下移后高亮动画的持续时间，需与 App.css 中的动画时长保持一致。 */
export const ORDER_MOVE_HIGHLIGHT_MS = 280

/** 提示条自动消失的时间：够看清，又不会一直占着视线。 */
export const NOTICE_AUTO_DISMISS_MS = 6_000

/* -------------------------------------------------------------------------- */
/* 桌面端                                                                      */
/* -------------------------------------------------------------------------- */

/** 桌面端全局快捷键的初始状态（Web 端会一直停留在这个"不可用"状态）。 */
export const DEFAULT_SHORTCUT_STATUS: GlobalShortcutStatus = {
  enabled: false,
  accelerator: 'CommandOrControl+Shift+Space',
  registered: false,
  message: '桌面版可用',
}

/* -------------------------------------------------------------------------- */
/* 用户可见文案                                                                */
/* -------------------------------------------------------------------------- */

/** 顶部/底部提示条里出现的一次性状态提示。 */
export const NOTICE = {
  storageFailure: '本地存储写入失败，请先导出备份后再清理数据',
  invalidLink: '链接无效：只支持 http/https 地址',

  focusRecorded: (projectName: string, minutes: number) =>
    `已记录 ${minutes} 分钟到 ${projectName}`,
  focusRecordedUnderOneMinute: (projectName: string) =>
    `已记录不到 1 分钟到 ${projectName}`,
  focusRecordHint: '专注暂停、重置或自然结束时，会把已过去的分钟记录到当前项目。',

  tomorrowTasksCarried: (count: number) => `已把 ${count} 项明日任务带入今日任务`,
  tomorrowTasksPromoted: '已把明日任务带入今日任务',

  localSummaryReady: '已生成本地总结',
  aiSummaryReady: 'AI 总结已生成',

  archived: '已归档今天，可在最近归档里查看',
  archiveDeleted: '已删除这条复盘归档',

  backupExported: '已导出备份（不包含 API Key）',
  backupImported: '已导入备份（保留本机 API Key）',
  backupImportCancelled: '已取消导入',
  backupImportFailed: (reason: string) => `导入失败：${reason}`,

  retentionForever: '已设置为永久保留',
  retentionDays: (days: number) =>
    `已设置为保留 ${days} 天，超出时间的本机记录会自动清理`,
  retentionCancelled: '已取消修改保留天数',

  focusCompleteTitle: '专注完成',
  focusCompleteBody: (taskLabel: string) =>
    taskLabel ? `「${taskLabel}」这一轮已结束` : '这一轮专注已结束',

  shortcutDesktopOnly: '快捷键设置仅在桌面版可用',
  shortcutLoadFailed: '快捷键设置读取失败',
}

/** window.confirm 的提示语。 */
export const CONFIRM = {
  deleteArchive: (date: string) => `删除 ${date} 的每日复盘归档？此操作只影响本机数据。`,
  importBackup: '导入会覆盖当前本地数据，但会保留本机已填写的 API Key。确认继续？',
  /** 调小保留天数会立刻删数据，必须先说清楚要删多少。 */
  pruneByRetention: (total: number, archives: number, projects: number) =>
    `按新设置会立即清理 ${total} 条本机记录（复盘归档 ${archives} 条、已结项项目 ${projects} 条），删除后无法恢复。确认继续？`,
}

/** catch 到非 Error 对象时的兜底错误文案。 */
export const ERROR_TEXT = {
  weatherUnavailable: '天气服务暂时不可用',
  weatherIncomplete: '天气数据不完整',
  weatherFailed: '天气查询失败',
  weatherCityFailed: '城市设置失败',
  aiSummaryFailed: 'AI 总结生成失败',
  shortcutSaveFailed: '快捷键保存失败',
  backupBadFormat: '文件格式不对',
  fileReadFailed: '文件读取失败',
}
