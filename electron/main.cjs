const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
  session,
  shell,
} = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const isDev = process.env.VITE_DEV_SERVER_URL
const appIconPath = path.join(__dirname, 'assets', 'app.ico')
const trayIconPath = path.join(__dirname, 'assets', 'tray.png')

let mainWindow = null
let tray = null
let isQuitting = false
let closeDialogOpen = false

const defaultSettings = {
  closeBehavior: 'ask',
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function readSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'))
    if (['ask', 'tray', 'quit'].includes(settings.closeBehavior)) {
      return { ...defaultSettings, ...settings }
    }
  } catch {
    // Fall back to asking when the file is missing or malformed.
  }
  return defaultSettings
}

function writeSettings(settings) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(
    getSettingsPath(),
    JSON.stringify({ ...defaultSettings, ...settings }, null, 2),
  )
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function hideMainWindow() {
  if (mainWindow) mainWindow.hide()
}

function quitApp() {
  isQuitting = true
  app.quit()
}

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isAppUrl(url) {
  if (!url) return false
  if (!isDev) return url.startsWith('file://')

  try {
    return new URL(url).origin === new URL(isDev).origin
  } catch {
    return false
  }
}

function createTray() {
  if (tray) return tray

  const trayIcon = nativeImage.createFromPath(trayIconPath)
  tray = new Tray(trayIcon)
  tray.setToolTip('Personal Command Deck')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开 Personal Command Deck',
        click: showMainWindow,
      },
      {
        label: '隐藏窗口',
        click: hideMainWindow,
      },
      { type: 'separator' },
      {
        label: '退出',
        click: quitApp,
      },
    ]),
  )
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)

  return tray
}

async function handleWindowClose(event) {
  if (isQuitting) return
  event.preventDefault()

  const settings = readSettings()
  if (settings.closeBehavior === 'tray') {
    hideMainWindow()
    return
  }
  if (settings.closeBehavior === 'quit') {
    quitApp()
    return
  }
  if (closeDialogOpen) return

  closeDialogOpen = true
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: '关闭 Personal Command Deck',
    message: '要把 Personal Command Deck 最小化到系统托盘吗？',
    detail: '最小化到托盘后，应用会继续运行。你可以从托盘菜单重新打开，或选择退出。',
    buttons: ['最小化到托盘', '直接退出', '取消'],
    defaultId: 0,
    cancelId: 2,
    checkboxLabel: '记住我的选择',
    checkboxChecked: false,
    noLink: true,
  })
  closeDialogOpen = false

  if (result.checkboxChecked && result.response === 0) {
    writeSettings({ closeBehavior: 'tray' })
  }
  if (result.checkboxChecked && result.response === 1) {
    writeSettings({ closeBehavior: 'quit' })
  }

  if (result.response === 0) {
    hideMainWindow()
  } else if (result.response === 1) {
    quitApp()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    title: 'Personal Command Deck',
    backgroundColor: '#0f1418',
    autoHideMenuBar: true,
    icon: appIconPath,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.on('close', (event) => {
    void handleWindowClose(event)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(isDev)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('ai:summary', async (_event, request) => {
  const apiKey = String(request?.apiKey ?? '').trim()
  const baseUrl = String(request?.baseUrl ?? '').trim()
  const model = String(request?.model ?? '').trim()
  const prompt = String(request?.prompt ?? '').trim()

  if (!apiKey) throw new Error('请先填写 API Key')
  if (!baseUrl) throw new Error('请先填写 API 地址')
  if (!model) throw new Error('请先填写模型名称')
  if (!prompt) throw new Error('没有可发送的复盘提示词')

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            '你是一个克制、具体的个人复盘助手，只输出用户要求的中文复盘内容。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `API 请求失败：${response.status}`)
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('API 没有返回总结内容')
  return { content }
})

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const isMainWindow =
      Boolean(mainWindow) && webContents.id === mainWindow.webContents.id
    callback(
      permission === 'geolocation' &&
        isMainWindow &&
        isAppUrl(webContents.getURL()),
    )
  })

  createWindow()
  createTray()

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
})
