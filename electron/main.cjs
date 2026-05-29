const { app, BrowserWindow, session, shell } = require('electron')
const path = require('node:path')

const isDev = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    title: 'Personal Command Deck',
    backgroundColor: '#0f1418',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(isDev)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'geolocation')
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
