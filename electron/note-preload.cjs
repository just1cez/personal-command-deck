const { contextBridge, ipcRenderer } = require('electron')

// 桌面便笺使用最小权限桥接：不暴露 AI、通知、全局快捷键或主窗口设置。
contextBridge.exposeInMainWorld('commandDeck', {
  getDesktopNote: (noteId) => ipcRenderer.invoke('desktop-notes:get', noteId),
  patchDesktopNote: (noteId, patch, requestId) =>
    ipcRenderer.invoke('desktop-notes:patch', noteId, patch, requestId),
  runDesktopNoteAction: (noteId, action, requestId) =>
    ipcRenderer.invoke('desktop-notes:action', noteId, action, requestId),
  onNotePrepare: (callback) => {
    const listener = (_event, requestId) => {
      Promise.resolve().then(() => callback(requestId)).then(
        () => ipcRenderer.send('desktop-notes:prepared', requestId),
        error => ipcRenderer.send('desktop-notes:prepared', requestId, error?.message || '保存失败'),
      )
    }
    ipcRenderer.on('desktop-notes:prepare', listener)
    ipcRenderer.send('desktop-notes:ready')
    return () => ipcRenderer.removeListener('desktop-notes:prepare', listener)
  },
  onNoteRelease: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('desktop-notes:release', listener)
    return () => ipcRenderer.removeListener('desktop-notes:release', listener)
  },
  onDesktopNoteSnapshot: (callback) => {
    const listener = (_event, note) => callback(note)
    ipcRenderer.on('desktop-notes:snapshot', listener)
    return () => ipcRenderer.removeListener('desktop-notes:snapshot', listener)
  },
})
