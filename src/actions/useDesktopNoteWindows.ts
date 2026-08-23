/**
 * 主窗口与独立桌面便笺窗口之间的同步桥。
 * 只有主窗口持有 DashboardState；便笺窗口通过 Electron IPC 提交动作。
 */
import { useEffect } from 'react'
import { getDesktopBridge } from '../services/desktopBridge'
import { useDashboardStore } from '../state/deckContext'
import { useDesktopNoteActions } from './useDesktopNoteActions'

export const useDesktopNoteWindows = () => {
  const { dashboard } = useDashboardStore()
  const {
    updateNote,
    closeNote,
    deleteNote,
    addToToday,
    addToTomorrow,
  } = useDesktopNoteActions()

  useEffect(() => {
    const bridge = getDesktopBridge()
    if (!bridge?.onDesktopNoteCommand) return

    return bridge.onDesktopNoteCommand((command) => {
      if (command.type === 'patch') {
        updateNote(command.id, command.patch, '同步桌面便笺')
      } else if (command.type === 'closed') {
        closeNote(command.id)
      } else if (command.type === 'delete') {
        deleteNote(command.id)
      } else if (command.type === 'add-today') {
        addToToday(command.id)
      } else if (command.type === 'add-tomorrow') {
        addToTomorrow(command.id)
      }
    })
  }, [addToToday, addToTomorrow, closeNote, deleteNote, updateNote])

  useEffect(() => {
    const sync = getDesktopBridge()?.syncDesktopNotes
    if (!sync) return
    void sync(dashboard.desktopNotes).catch(() => undefined)
  }, [dashboard.desktopNotes])
}
