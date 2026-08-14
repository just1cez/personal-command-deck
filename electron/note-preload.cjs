const { contextBridge, ipcRenderer } = require('electron')

// 桌面便笺使用最小权限桥接：不暴露 AI、通知、全局快捷键或主窗口设置。
contextBridge.exposeInMainWorld('commandDeck', {
  getDesktopNote: (noteId) => ipcRenderer.invoke('desktop-notes:get', noteId),
  patchDesktopNote: (noteId, patch) =>
    ipcRenderer.invoke('desktop-notes:patch', noteId, patch),
  flushDesktopNote: (noteId, content) =>
    ipcRenderer.send('desktop-notes:flush', noteId, content),
  runDesktopNoteAction: (noteId, action) =>
    ipcRenderer.invoke('desktop-notes:action', noteId, action),
  onDesktopNoteSnapshot: (callback) => {
    const listener = (_event, note) => callback(note)
    ipcRenderer.on('desktop-notes:snapshot', listener)
    return () => ipcRenderer.removeListener('desktop-notes:snapshot', listener)
  },
})
