const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('commandDeck', {
  generateAiSummary: (request) => ipcRenderer.invoke('ai:summary', request),
  getDesktopSettings: () => ipcRenderer.invoke('settings:get'),
  updateGlobalShortcut: (request) =>
    ipcRenderer.invoke('settings:update-global-shortcut', request),
})
