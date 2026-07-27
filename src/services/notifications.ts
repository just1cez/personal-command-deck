/**
 * 专注结束的系统通知。
 *
 * 两条通道，按可用性降级：
 * 1. 桌面版走主进程（Windows toast，不受浏览器权限限制）；
 * 2. Web 端用 Notification API，需要用户先授权。
 *
 * 任何一步失败都静默吞掉——界面里的记录提示仍然看得见，
 * 通知只是锦上添花，不该因为它报错打断专注流程。
 */
import { NOTICE } from '../config/constants'
import { getDesktopBridge } from './desktopBridge'

/**
 * 请求 Web 通知权限。
 *
 * 刻意在**用户点击"开始专注"时**才请求，而不是一进应用就弹窗——
 * 这时用户刚表达了"我要专注"的意图，授权提示才有上下文。
 * 桌面版有自己的通知通道，不需要走这一步。
 */
export const requestWebNotificationPermission = () => {
  if (getDesktopBridge()) return
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => undefined)
  }
}

/**
 * 通知这一轮专注结束。
 * @param taskLabel 本轮目标，用于拼出正文
 * @param detail    结算提示（例如"已记录 25 分钟到 X"），有的话优先显示
 */
export const notifyFocusComplete = (taskLabel: string, detail: string) => {
  const title = NOTICE.focusCompleteTitle
  const body = detail || NOTICE.focusCompleteBody(taskLabel)

  const bridge = getDesktopBridge()
  if (bridge?.notify) {
    void bridge.notify({ title, body }).catch(() => undefined)
    return
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      // 桌面通知不可用时，界面内的记录提示仍然可见。
    }
  }
}
