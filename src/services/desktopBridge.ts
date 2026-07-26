/**
 * Electron 预加载脚本暴露的桥接接口（`electron/preload.cjs` -> `window.commandDeck`）。
 *
 * Web 端不存在这个对象，因此**每个能力都要单独探测**，不能只判断 `window.commandDeck`——
 * 桌面版升级过程中也可能出现"有桥接但缺某个方法"的情况。
 *
 * 组件里请调用下面的 `canXxx()` 而不是直接摸 `window`，这样：
 * - 判断逻辑只有一处，行为一致；
 * - 将来要加 Tauri / Web 之外的运行时，只改这个文件。
 */
import type {
  AiSummaryRequest,
  AiSummaryResponse,
  DesktopSettings,
  GlobalShortcutSettings,
  GlobalShortcutStatus,
} from '../types'

/** 主进程返回的设置载荷。 */
export type DesktopSettingsPayload = {
  settings: DesktopSettings
  shortcut: GlobalShortcutStatus
}

export type CommandDeckBridge = {
  /** 由主进程代发 AI 请求，避免渲染进程直接暴露 API Key。 */
  generateAiSummary: (request: AiSummaryRequest) => Promise<AiSummaryResponse>
  getDesktopSettings: () => Promise<DesktopSettingsPayload>
  updateGlobalShortcut: (request: GlobalShortcutSettings) => Promise<DesktopSettingsPayload>
  /**
   * 录制快捷键期间挂起全局热键。
   * 否则用户按下的组合键会被已注册的热键抢走，永远录不进来。
   */
  setShortcutCapture?: (active: boolean) => Promise<unknown>
  /** 发送系统通知（Windows toast）。 */
  notify?: (request: { title: string; body: string }) => Promise<unknown>
}

declare global {
  interface Window {
    commandDeck?: CommandDeckBridge
  }
}

export const getDesktopBridge = () => window.commandDeck

/** 是否运行在桌面版。 */
export const isDesktopRuntime = () => Boolean(window.commandDeck)

export const canReadDesktopSettings = () => Boolean(window.commandDeck?.getDesktopSettings)

export const canUpdateGlobalShortcut = () => Boolean(window.commandDeck?.updateGlobalShortcut)

/** 桌面版可以走主进程转发 AI 请求；Web 端只能由浏览器直接请求。 */
export const canProxyAiSummary = () => Boolean(window.commandDeck?.generateAiSummary)

/** 通知主进程"正在录制快捷键，先别响应全局热键"。不支持时静默忽略。 */
export const setShortcutCapture = (active: boolean) => {
  const bridge = window.commandDeck
  if (!bridge?.setShortcutCapture) return
  void bridge.setShortcutCapture(active).catch(() => undefined)
}
