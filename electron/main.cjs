const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  globalShortcut,
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
const gotSingleInstanceLock = app.requestSingleInstanceLock()

const defaultSettings = {
  closeBehavior: 'ask',
  globalShortcut: {
    enabled: true,
    accelerator: 'CommandOrControl+Shift+Space',
  },
}

let registeredShortcut = ''
let shortcutMessage = ''

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function readSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'))
    if (settings && typeof settings === 'object') {
      return normalizeSettings(settings)
    }
  } catch {
    // Fall back to asking when the file is missing or malformed.
  }
  return normalizeSettings({})
}

function writeSettings(settings) {
  const normalized = normalizeSettings(settings)
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(
    getSettingsPath(),
    JSON.stringify(normalized, null, 2),
  )
  return normalized
}

function normalizeSettings(settings) {
  const closeBehavior = ['ask', 'tray', 'quit'].includes(settings.closeBehavior)
    ? settings.closeBehavior
    : defaultSettings.closeBehavior
  const shortcut =
    settings.globalShortcut && typeof settings.globalShortcut === 'object'
      ? settings.globalShortcut
      : {}
  const accelerator =
    typeof shortcut.accelerator === 'string'
      ? shortcut.accelerator.trim()
      : defaultSettings.globalShortcut.accelerator

  return {
    closeBehavior,
    globalShortcut: {
      enabled:
        typeof shortcut.enabled === 'boolean'
          ? shortcut.enabled
          : defaultSettings.globalShortcut.enabled,
      accelerator: isSafeAccelerator(accelerator)
        ? accelerator
        : defaultSettings.globalShortcut.accelerator,
    },
  }
}

function isSafeAccelerator(accelerator) {
  if (typeof accelerator !== 'string') return false
  const value = accelerator.trim()
  if (value.length < 3 || value.length > 80) return false
  if (!/^[A-Za-z0-9+\-_=,[\]./;`'\\ ]+$/.test(value)) return false

  const parts = value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2 || parts.length > 5) return false

  const modifiers = new Set([
    'CommandOrControl',
    'CmdOrCtrl',
    'Command',
    'Control',
    'Ctrl',
    'Alt',
    'Option',
    'AltGr',
    'Shift',
    'Super',
    'Meta',
  ])
  const keyPattern =
    /^(Space|Tab|Enter|Return|Escape|Esc|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Plus|Minus|F(?:[1-9]|1[0-9]|2[0-4])|[A-Z0-9]|[,\-_=.[\]/;`'\\])$/i
  const key = parts[parts.length - 1]
  const modifierParts = parts.slice(0, -1)
  return (
    modifierParts.length > 0 &&
    modifierParts.every((part) => modifiers.has(part)) &&
    keyPattern.test(key)
  )
}

function registerGlobalShortcut(settings = readSettings()) {
  globalShortcut.unregisterAll()
  registeredShortcut = ''

  const shortcut = settings.globalShortcut
  if (!shortcut.enabled) {
    shortcutMessage = '快捷键已关闭'
    return { ...shortcut, registered: false, message: '快捷键已关闭' }
  }
  if (!isSafeAccelerator(shortcut.accelerator)) {
    shortcutMessage = '快捷键格式不可用'
    return { ...shortcut, registered: false, message: '快捷键格式不可用' }
  }

  const registered = globalShortcut.register(shortcut.accelerator, showMainWindow)
  registeredShortcut = registered ? shortcut.accelerator : ''
  shortcutMessage = registered ? '快捷键已启用' : '快捷键被系统或其他应用占用'
  return {
    ...shortcut,
    registered,
    message: shortcutMessage,
  }
}

function getShortcutStatus(settings = readSettings()) {
  const shortcut = settings.globalShortcut
  const registered =
    Boolean(registeredShortcut) &&
    registeredShortcut === shortcut.accelerator &&
    globalShortcut.isRegistered(shortcut.accelerator)
  return {
    ...shortcut,
    registered,
    message:
      shortcutMessage ||
      (shortcut.enabled
        ? registered
          ? '快捷键已启用'
          : '快捷键尚未注册'
        : '快捷键已关闭'),
  }
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
    writeSettings({ ...settings, closeBehavior: 'tray' })
  }
  if (result.checkboxChecked && result.response === 1) {
    writeSettings({ ...settings, closeBehavior: 'quit' })
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

ipcMain.handle('settings:get', async () => {
  return {
    settings: readSettings(),
    shortcut: getShortcutStatus(),
  }
})

ipcMain.handle('settings:update-global-shortcut', async (_event, request) => {
  const current = readSettings()
  const enabled =
    typeof request?.enabled === 'boolean'
      ? request.enabled
      : current.globalShortcut.enabled
  const accelerator =
    typeof request?.accelerator === 'string'
      ? request.accelerator.trim()
      : current.globalShortcut.accelerator

  if (enabled && !isSafeAccelerator(accelerator)) {
    return {
      settings: current,
      shortcut: {
        ...current.globalShortcut,
        registered: false,
        message: '快捷键格式不可用，请使用 Ctrl/Alt/Shift 加一个按键',
      },
    }
  }

  const settings = writeSettings({
    ...current,
    globalShortcut: {
      enabled,
      accelerator: isSafeAccelerator(accelerator)
        ? accelerator
        : current.globalShortcut.accelerator,
    },
  })
  const shortcut = registerGlobalShortcut(settings)
  return { settings, shortcut }
})

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) {
      showMainWindow()
      return
    }
    app.whenReady().then(showMainWindow).catch(() => undefined)
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
    registerGlobalShortcut()

    app.on('activate', () => {
      showMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
  globalShortcut.unregisterAll()
})
