/**
 * 轻量调试通道。
 *
 * 设计目标：在**不改变任何业务行为**的前提下，让"状态为什么变成这样"变得可观察。
 *
 * 使用方式：
 * - `npm run dev` 下默认开启，控制台会打印每一次状态变更的动作名；
 * - 打包后的桌面版默认关闭，在控制台执行 `commandDeckDebug.enable()` 即可临时打开
 *   （开关写进 localStorage，重启后依然有效，`disable()` 关闭）；
 * - `commandDeckDebug.state()` 打印当前完整状态快照（API Key 会被脱敏）。
 *
 * 所有日志都带 `[deck:xxx]` 前缀，方便在 DevTools 里按关键字过滤。
 */
import type { DashboardState } from './types'

const DEBUG_FLAG_KEY = 'personal-command-deck-debug'

declare global {
  interface Window {
    commandDeckDebug?: {
      enable: () => string
      disable: () => string
      state: () => DashboardState | null
    }
  }
}

const readStoredFlag = () => {
  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === 'on'
  } catch {
    // 隐私模式 / 存储被禁用时读不到，按"未开启"处理即可。
    return false
  }
}

// 可选链是为了让这个模块在 Vite 之外（例如 Node 里的脚本/测试）也能安全导入。
let debugEnabled = Boolean(import.meta.env?.DEV) || readStoredFlag()

export const isDebugEnabled = () => debugEnabled

export const setDebugEnabled = (enabled: boolean) => {
  debugEnabled = enabled
  try {
    if (enabled) window.localStorage.setItem(DEBUG_FLAG_KEY, 'on')
    else window.localStorage.removeItem(DEBUG_FLAG_KEY)
  } catch {
    // 写不进去只影响"下次启动是否还开着"，本次会话依然生效。
  }
  return debugEnabled
}

/**
 * 打印一条调试日志。
 * @param scope 模块名，例如 'store' / 'focus' / 'weather'
 */
export const debugLog = (scope: string, message: string, payload?: unknown) => {
  if (!debugEnabled) return
  if (payload === undefined) console.debug(`[deck:${scope}] ${message}`)
  else console.debug(`[deck:${scope}] ${message}`, payload)
}

/** 打印一条调试警告；即使调试开关关闭也会输出，因为它代表"确实出问题了"。 */
export const debugWarn = (scope: string, message: string, payload?: unknown) => {
  if (payload === undefined) console.warn(`[deck:${scope}] ${message}`)
  else console.warn(`[deck:${scope}] ${message}`, payload)
}

/** 脱敏后的状态快照：调试输出里绝不出现用户的 API Key。 */
export const redactState = (state: DashboardState): DashboardState => ({
  ...state,
  ai: { ...state.ai, apiKey: state.ai.apiKey ? '***' : '' },
})

/**
 * 把调试入口挂到 window 上。
 * 由 DeckProvider 在挂载时调用一次，`readState` 始终返回最新状态。
 */
export const installDebugBridge = (readState: () => DashboardState) => {
  window.commandDeckDebug = {
    enable: () => (setDebugEnabled(true) ? '[deck] 调试日志已开启' : ''),
    disable: () => (setDebugEnabled(false) ? '' : '[deck] 调试日志已关闭'),
    state: () => redactState(readState()),
  }
  debugLog('debug', '调试入口已挂载到 window.commandDeckDebug')

  return () => {
    delete window.commandDeckDebug
  }
}
