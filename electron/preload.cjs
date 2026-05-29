const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('commandDeck', {
  generateAiSummary: (request) => ipcRenderer.invoke('ai:summary', request),
})
