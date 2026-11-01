const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('commandDeck', {
  generateAiSummary: (request) => ipcRenderer.invoke('ai:summary', request),
  getDesktopSettings: () => ipcRenderer.invoke('settings:get'),
  updateGlobalShortcut: (request) =>
    ipcRenderer.invoke('settings:update-global-shortcut', request),
  setShortcutCapture: (active) =>
    ipcRenderer.invoke('settings:set-shortcut-capture', active),
  notify: (request) => ipcRenderer.invoke('app:notify', request),
  acknowledgeNoteCommand: result => ipcRenderer.send('desktop-notes:ack', result),
  markStorageChanged: () => ipcRenderer.send('storage:changed'),
  syncDesktopNotes: (notes, version) => ipcRenderer.invoke('desktop-notes:sync', notes, version),
  getDesktopNote: (noteId) => ipcRenderer.invoke('desktop-notes:get', noteId),
  showDesktopNote: (noteId) => ipcRenderer.invoke('desktop-notes:show', noteId),
  patchDesktopNote: (noteId, patch, requestId) =>
    ipcRenderer.invoke('desktop-notes:patch', noteId, patch, requestId),
  runDesktopNoteAction: (noteId, action, requestId) =>
    ipcRenderer.invoke('desktop-notes:action', noteId, action, requestId),
  onDesktopNoteCommand: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('desktop-notes:command', listener)
    return () => ipcRenderer.removeListener('desktop-notes:command', listener)
  },
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
