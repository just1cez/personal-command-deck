/**
 * 桌面版的全局呼出快捷键。
 *
 * 这是一块**只有桌面版才存在**的能力：Web 端下所有控件都会被禁用，
 * 并显示"仅在桌面版可用"。快捷键是否注册成功由 Electron 主进程说了算
 * （可能被别的软件占用），所以每次保存都以主进程返回的状态为准，
 * 而不是本地乐观更新。
 */
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SHORTCUT_STATUS, ERROR_TEXT, NOTICE } from '../config/constants'
import {
  canReadDesktopSettings,
  canUpdateGlobalShortcut,
  getDesktopBridge,
  setShortcutCapture,
} from '../services/desktopBridge'
import type { GlobalShortcutStatus } from '../types'

export const useDesktopShortcut = () => {
  const [status, setStatus] = useState<GlobalShortcutStatus>(DEFAULT_SHORTCUT_STATUS)
  const [accelerator, setAccelerator] = useState(DEFAULT_SHORTCUT_STATUS.accelerator)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  /** 桌面版是否支持修改快捷键；决定所有控件的可用状态。 */
  const supported = canUpdateGlobalShortcut()

  // 启动时读一次主进程的设置。cancelled 标记防止组件已卸载还去 setState。
  useEffect(() => {
    let cancelled = false

    const loadDesktopSettings = async () => {
      if (!canReadDesktopSettings()) {
        setNotice(NOTICE.shortcutDesktopOnly)
        return
      }
      try {
        const response = await getDesktopBridge()!.getDesktopSettings()
        if (cancelled) return
        setStatus(response.shortcut)
        setAccelerator(response.shortcut.accelerator)
        setNotice(response.shortcut.message)
      } catch {
        if (!cancelled) setNotice(NOTICE.shortcutLoadFailed)
      }
    }

    void loadDesktopSettings()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * 保存到主进程，并以它返回的结果为准。
   * @param enabled        省略时沿用当前的启用状态
   * @param nextAccelerator 省略时沿用当前的按键组合
   */
  const save = useCallback(
    async (enabled = status.enabled, nextAccelerator = accelerator) => {
      const bridge = getDesktopBridge()
      if (!bridge?.updateGlobalShortcut) {
        setNotice(NOTICE.shortcutDesktopOnly)
        return
      }

      setLoading(true)
      try {
        const response = await bridge.updateGlobalShortcut({
          enabled,
          accelerator: nextAccelerator.trim(),
        })
        setStatus(response.shortcut)
        setAccelerator(response.shortcut.accelerator)
        setNotice(response.shortcut.message)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : ERROR_TEXT.shortcutSaveFailed)
      } finally {
        setLoading(false)
      }
    },
    [accelerator, status.enabled],
  )

  /** 勾选/取消"呼出"。先本地反馈一下，最终状态还是以主进程返回的为准。 */
  const toggleEnabled = useCallback(
    (enabled: boolean) => {
      setStatus((current) => ({ ...current, enabled }))
      void save(enabled)
    },
    [save],
  )

  /** 录到一个新组合：立即写入并启用，省掉一次"再点保存"。 */
  const recordAccelerator = useCallback(
    (nextAccelerator: string) => {
      setAccelerator(nextAccelerator)
      void save(true, nextAccelerator)
    },
    [save],
  )

  /** 录制期间让主进程挂起已注册的热键，否则相同组合会被它先吃掉。 */
  const setCapturing = useCallback((capturing: boolean) => {
    setShortcutCapture(capturing)
  }, [])

  return {
    status,
    accelerator,
    loading,
    notice,
    supported,
    toggleEnabled,
    recordAccelerator,
    setCapturing,
  }
}
