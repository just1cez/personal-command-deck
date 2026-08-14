const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('commandDeck', {
  generateAiSummary: (request) => ipcRenderer.invoke('ai:summary', request),
  getDesktopSettings: () => ipcRenderer.invoke('settings:get'),
  updateGlobalShortcut: (request) =>
    ipcRenderer.invoke('settings:update-global-shortcut', request),
  setShortcutCapture: (active) =>
    ipcRenderer.invoke('settings:set-shortcut-capture', active),
  notify: (request) => ipcRenderer.invoke('app:notify', request),
  markStorageChanged: () => ipcRenderer.send('storage:changed'),
  syncDesktopNotes: (notes) => ipcRenderer.invoke('desktop-notes:sync', notes),
  getDesktopNote: (noteId) => ipcRenderer.invoke('desktop-notes:get', noteId),
  showDesktopNote: (noteId) => ipcRenderer.invoke('desktop-notes:show', noteId),
  patchDesktopNote: (noteId, patch) =>
    ipcRenderer.invoke('desktop-notes:patch', noteId, patch),
  flushDesktopNote: (noteId, content) =>
    ipcRenderer.send('desktop-notes:flush', noteId, content),
  runDesktopNoteAction: (noteId, action) =>
    ipcRenderer.invoke('desktop-notes:action', noteId, action),
  onDesktopNoteCommand: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('desktop-notes:command', listener)
    return () => ipcRenderer.removeListener('desktop-notes:command', listener)
  },
  onDesktopNoteSnapshot: (callback) => {
    const listener = (_event, note) => callback(note)
    ipcRenderer.on('desktop-notes:snapshot', listener)
    return () => ipcRenderer.removeListener('desktop-notes:snapshot', listener)
  },
})
