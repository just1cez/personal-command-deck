const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  session,
  shell,
  screen,
} = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { randomUUID } = require('node:crypto')
const { createNoteRequests, withTimeout } = require('./note-requests.cjs')

const isDev = process.env.VITE_DEV_SERVER_URL
const appIconPath = path.join(__dirname, 'assets', 'app.ico')
const trayIconPath = path.join(__dirname, 'assets', 'tray.png')
const rendererIndexUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html'))
// Keep these desktop-note limits in sync with src/config/constants.ts.
const DESKTOP_NOTE_CONTENT_MAX_LENGTH = 8_000
const DESKTOP_NOTE_LIMIT = 100
const DESKTOP_NOTE_OPEN_LIMIT = 6
const DESKTOP_NOTE_ID_MAX_LENGTH = 128
const DESKTOP_NOTE_REQUEST_ID_MAX_LENGTH = 128

// Windows toast 通知需要 AppUserModelId 才能正常显示
if (process.platform === 'win32') {
  app.setAppUserModelId('com.personal.commanddeck')
}

let mainWindow = null
let tray = null
let isQuitting = false
let closeDialogOpen = false
let storageFlushTimer = null
const desktopNoteWindows = new Map()
const desktopNoteSnapshots = new Map()
const suppressedDesktopNoteCloses = new Set()
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
  void coordinateClose()
}

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function safeNoteId(value) {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  return id.length > 0 && id.length <= DESKTOP_NOTE_ID_MAX_LENGTH ? id : ''
}

function safeRequestId(value) {
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  return id.length > 0 && id.length <= DESKTOP_NOTE_REQUEST_ID_MAX_LENGTH ? id : undefined
}

function isAppUrl(url) {
  if (!url) return false

  try {
    const parsed = new URL(url)
    if (isDev) return parsed.origin === new URL(isDev).origin
    return (
      parsed.protocol === 'file:' &&
      parsed.host === rendererIndexUrl.host &&
      parsed.pathname === rendererIndexUrl.pathname
    )
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

function isMainRenderer(sender) {
  return Boolean(mainWindow) && sender?.id === mainWindow.webContents.id
}

function desktopNoteIdFromSender(sender) {
  for (const [noteId, noteWindow] of desktopNoteWindows) {
    if (noteWindow.webContents.id === sender?.id) return noteId
  }
  return ''
}

function sanitizeDesktopNoteSnapshot(value) {
  if (!value || typeof value !== 'object') return null
  const id = String(value.id ?? '').trim().slice(0, 120)
  if (!id) return null
  const colors = new Set(['yellow', 'green', 'blue', 'rose', 'slate'])
  const bounds = value.bounds && typeof value.bounds === 'object' ? value.bounds : {}
  const finite = (candidate) => typeof candidate === 'number' && Number.isFinite(candidate)
  const clamp = (candidate, minimum, maximum, fallback) =>
    Math.min(maximum, Math.max(minimum, Math.round(finite(candidate) ? candidate : fallback)))
  return {
    id,
    content: String(value.content ?? '').slice(0, DESKTOP_NOTE_CONTENT_MAX_LENGTH),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt.slice(0, 40) : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt.slice(0, 40) : '',
    color: colors.has(value.color) ? value.color : 'yellow',
    isOpen: value.isOpen === true,
    alwaysOnTop: value.alwaysOnTop === true,
    bounds: {
      x: finite(bounds.x) ? Math.round(bounds.x) : undefined,
      y: finite(bounds.y) ? Math.round(bounds.y) : undefined,
      width: clamp(bounds.width, 240, 1_200, 320),
      height: clamp(bounds.height, 180, 1_000, 300),
    },
  }
}

function clampDesktopNoteBounds(bounds, cascadeIndex = 0) {
  const requested = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }
  const display = Number.isFinite(requested.x) && Number.isFinite(requested.y)
    ? screen.getDisplayMatching(requested)
    : screen.getPrimaryDisplay()
  const workArea = display.workArea
  const width = Math.min(requested.width, workArea.width)
  const height = Math.min(requested.height, workArea.height)
  const cascadeOffset = (cascadeIndex % 8) * 24
  const fallbackX = Math.round(workArea.x + (workArea.width - width) / 2 + cascadeOffset)
  const fallbackY = Math.round(workArea.y + (workArea.height - height) / 2 + cascadeOffset)
  return {
    x: Math.min(workArea.x + workArea.width - width, Math.max(workArea.x, requested.x ?? fallbackX)),
    y: Math.min(workArea.y + workArea.height - height, Math.max(workArea.y, requested.y ?? fallbackY)),
    width,
    height,
  }
}

function scheduleStorageFlush(targetSession = session.defaultSession) {
  if (storageFlushTimer) return
  storageFlushTimer = setTimeout(() => {
    storageFlushTimer = null
    targetSession.flushStorageData()
  }, 2_000)
}

const noteRequests = createNoteRequests(command => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed() || mainWindow.webContents.isCrashed()) {
    throw new Error('主窗口不可用，内容尚未保存')
  }
  mainWindow.webContents.send('desktop-notes:command', command)
})
function sendDesktopNoteCommand(command, requestId) {
  return noteRequests.request(command, requestId)
}
const preparations = new Map()
const readyEditors = new Set()
const closingNotes = new Map()
let exitOperation = null
let snapshotVersion = -1
let rendererVersion = -1
const discardedNoteWindows = new Set()

function prepareWindow(window) {
  if (!window || window.isDestroyed() || window.webContents.isCrashed()) return Promise.reject(new Error('窗口不可用'))
  const requestId = randomUUID()
  const waiting = new Promise((resolve, reject) => {
    preparations.set(requestId, { senderId: window.webContents.id, resolve, reject })
    if (readyEditors.has(window.webContents.id)) window.webContents.send('desktop-notes:prepare', requestId)
  })
  return withTimeout(waiting).finally(() => preparations.delete(requestId))
}
function releaseWindows(windows) {
  for (const window of windows) if (window && !window.isDestroyed()) window.webContents.send('desktop-notes:release')
}
function ensureSaved(result) {
  if (!result.accepted) throw new Error(result.error || '保存失败')
}
async function closeAttempt(noteId, windows, attempt) {
  await Promise.all(windows.map(prepareWindow))
  for (const [id, window] of desktopNoteWindows) {
    if (noteId && id !== noteId) continue
    if (!attempt.active) throw new Error('保存超时')
    ensureSaved(await sendDesktopNoteCommand({ type: 'patch', id, patch: { bounds: window.getBounds() } }))
  }
  if (!attempt.active) throw new Error('保存超时')
  ensureSaved(await sendDesktopNoteCommand({ type: 'barrier', id: '' }))
  if (!attempt.active) throw new Error('保存超时')
  if (noteId) ensureSaved(await sendDesktopNoteCommand({ type: 'closed', id: noteId }))
  if (!attempt.active) throw new Error('保存超时')
  session.defaultSession.flushStorageData()
}
function coordinateClose(noteId) {
  if (exitOperation) return exitOperation
  if (noteId && closingNotes.has(noteId)) return closingNotes.get(noteId)
  const operation = (async () => {
    // 退出先等待正在进行的单窗关闭，避免两条流程同时操作同一窗口。
    if (!noteId) await Promise.all(closingNotes.values())
    while (true) {
      const windows = noteId ? [desktopNoteWindows.get(noteId)] : [mainWindow, ...desktopNoteWindows.values()]
      const attempt = { active: true }
      try {
        await withTimeout(closeAttempt(noteId, windows, attempt))
        if (noteId) closeDesktopNoteWindow(noteId, true)
        else { isQuitting = true; app.quit() }
        return { accepted: true, requestId: '', version: snapshotVersion }
      } catch (error) {
        attempt.active = false
        releaseWindows(windows)
        const owner = noteId ? desktopNoteWindows.get(noteId) : mainWindow
        const options = {
          type: 'warning', title: '内容尚未保存', message: error.message,
          detail: '窗口和草稿已保留。可以重试，或取消本次关闭。',
          buttons: ['重试', noteId ? '取消关闭' : '取消退出', noteId ? '放弃未保存修改并关闭' : '放弃未保存修改并退出'],
          defaultId: 1, cancelId: 1, noLink: true,
        }
        const choice = owner && !owner.isDestroyed()
          ? await dialog.showMessageBox(owner, options) : await dialog.showMessageBox(options)
        if (choice.response === 0) continue
        if (choice.response === 2) {
          if (noteId) { discardedNoteWindows.add(noteId); closeDesktopNoteWindow(noteId, true) }
          else { isQuitting = true; app.quit() }
        }
        return { accepted: false, requestId: '', version: snapshotVersion, error: error.message }
      }
    }
  })().finally(() => { if (noteId) closingNotes.delete(noteId); else exitOperation = null })
  if (noteId) closingNotes.set(noteId, operation)
  else exitOperation = operation
  return operation
}

ipcMain.on('desktop-notes:ack', (event, result) => {
  if (isMainRenderer(event.sender)) noteRequests.acknowledge({ ...result, version: snapshotVersion })
})
ipcMain.on('desktop-notes:ready', (event) => {
  if (!isMainRenderer(event.sender) && !desktopNoteIdFromSender(event.sender)) return
  readyEditors.add(event.sender.id)
  for (const [requestId, pending] of preparations) {
    if (pending.senderId === event.sender.id) event.sender.send('desktop-notes:prepare', requestId)
  }
})
ipcMain.on('desktop-notes:prepared', (event, requestId, error) => {
  const pending = preparations.get(requestId)
  if (!pending || pending.senderId !== event.sender.id) return
  if (error) pending.reject(new Error(String(error)))
  else pending.resolve()
})

function sendDesktopNoteSnapshot(noteId) {
  const noteWindow = desktopNoteWindows.get(noteId)
  const note = desktopNoteSnapshots.get(noteId)
  if (!noteWindow || noteWindow.isDestroyed() || !note) return
  noteWindow.webContents.send('desktop-notes:snapshot', { ...note, version: snapshotVersion })
}

function closeDesktopNoteWindow(noteId, suppressEvent = false) {
  const noteWindow = desktopNoteWindows.get(noteId)
  if (!noteWindow || noteWindow.isDestroyed()) return
  if (suppressEvent) suppressedDesktopNoteCloses.add(noteId)
  noteWindow.close()
}

function createDesktopNoteWindow(note) {
  const existing = desktopNoteWindows.get(note.id)
  if (existing && !existing.isDestroyed()) {
    existing.setAlwaysOnTop(note.alwaysOnTop)
    existing.setSkipTaskbar(true)
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    sendDesktopNoteSnapshot(note.id)
    return existing
  }

  const bounds = clampDesktopNoteBounds(note.bounds, desktopNoteWindows.size)
  const noteWindow = new BrowserWindow({
    ...bounds,
    minWidth: 240,
    minHeight: 180,
    title: '桌面便笺',
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    alwaysOnTop: note.alwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#f1df91',
    icon: appIconPath,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'desktop-notes',
      preload: path.join(__dirname, 'note-preload.cjs'),
    },
  })
  desktopNoteWindows.set(note.id, noteWindow)
  noteWindow.webContents.on('did-start-loading', () => readyEditors.delete(noteWindow.webContents.id))
  const noteContentsId = noteWindow.webContents.id
  noteWindow.webContents.on('destroyed', () => readyEditors.delete(noteContentsId))
  noteWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  )

  if (
    bounds.x !== note.bounds.x ||
    bounds.y !== note.bounds.y ||
    bounds.width !== note.bounds.width ||
    bounds.height !== note.bounds.height
  ) {
    sendDesktopNoteCommand({ type: 'patch', id: note.id, patch: { bounds } })
  }

  let boundsTimer = null
  const reportBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (isQuitting || noteWindow.isDestroyed()) return
      sendDesktopNoteCommand({ type: 'patch', id: note.id, patch: { bounds: noteWindow.getBounds() } })
    }, 250)
  }

  noteWindow.on('move', reportBounds)
  noteWindow.on('resize', reportBounds)
  noteWindow.on('close', (event) => {
    if (boundsTimer) clearTimeout(boundsTimer)
    if (isQuitting || suppressedDesktopNoteCloses.delete(note.id)) return
    event.preventDefault()
    void coordinateClose(note.id)
  })
  noteWindow.on('closed', () => {
    desktopNoteWindows.delete(note.id)
  })
  noteWindow.once('ready-to-show', () => {
    noteWindow.show()
    noteWindow.focus()
    sendDesktopNoteSnapshot(note.id)
  })
  noteWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  noteWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
  })

  if (isDev) {
    const url = new URL(isDev)
    url.searchParams.set('window', 'desktop-note')
    url.searchParams.set('noteId', note.id)
    noteWindow.loadURL(url.toString())
  } else {
    noteWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { window: 'desktop-note', noteId: note.id },
    })
  }
  return noteWindow
}

function syncDesktopNoteWindows(notes) {
  const nextIds = new Set()
  let openCount = 0
  for (const rawNote of (Array.isArray(notes) ? notes : []).slice(0, DESKTOP_NOTE_LIMIT)) {
    const note = sanitizeDesktopNoteSnapshot(rawNote)
    if (!note) continue
    nextIds.add(note.id)
    desktopNoteSnapshots.set(note.id, note)

    const noteWindow = desktopNoteWindows.get(note.id)
    if (note.isOpen) openCount += 1
    if (note.isOpen && openCount > DESKTOP_NOTE_OPEN_LIMIT) {
      note.isOpen = false
      sendDesktopNoteCommand({ type: 'patch', id: note.id, patch: { isOpen: false } })
    }
    if (note.isOpen && !discardedNoteWindows.has(note.id)) {
      if (!noteWindow || noteWindow.isDestroyed()) createDesktopNoteWindow(note)
      else {
        noteWindow.setAlwaysOnTop(note.alwaysOnTop)
        sendDesktopNoteSnapshot(note.id)
      }
    } else if (noteWindow && !noteWindow.isDestroyed()) {
      if (!closingNotes.has(note.id) && !exitOperation) void coordinateClose(note.id)
    }
  }

  for (const noteId of [...desktopNoteSnapshots.keys()]) {
    if (nextIds.has(noteId)) continue
    desktopNoteSnapshots.delete(noteId)
    closeDesktopNoteWindow(noteId, true)
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
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.webContents.on('did-start-loading', () => {
    rendererVersion = -1
    readyEditors.delete(mainWindow.webContents.id)
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

  // 阻止主窗口本身跳转到外部页面（例如拖入链接），外链一律交给系统浏览器
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
  })

  if (isDev) {
    mainWindow.loadURL(isDev)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.on('storage:changed', (event) => {
  if (!isMainRenderer(event.sender)) return
  scheduleStorageFlush(event.sender.session)
})

ipcMain.handle('desktop-notes:sync', (event, notes, version) => {
  if (!isMainRenderer(event.sender)) return { synced: false }
  if (!Number.isSafeInteger(version) || version < rendererVersion) return { synced: false }
  rendererVersion = version
  snapshotVersion += 1
  syncDesktopNoteWindows(notes)
  for (const note of desktopNoteSnapshots.values()) {
    event.sender.send('desktop-notes:snapshot', { ...note, version: snapshotVersion })
  }
  // localStorage 由渲染进程写入；同步窗口后立刻要求 Chromium 刷盘，
  // 降低进程异常退出时刚编辑的便笺丢失概率。
  event.sender.session.flushStorageData()
  return { synced: true }
})

ipcMain.handle('desktop-notes:show', (event, requestedId) => {
  if (!isMainRenderer(event.sender)) return { shown: false }
  const noteId = safeNoteId(requestedId)
  const note = desktopNoteSnapshots.get(noteId)
  if (!note) return { shown: false }
  discardedNoteWindows.delete(noteId)
  createDesktopNoteWindow({ ...note, isOpen: true })
  return { shown: true }
})

ipcMain.handle('desktop-notes:get', (event, requestedId) => {
  const senderId = desktopNoteIdFromSender(event.sender)
  const noteId = safeNoteId(requestedId)
  if (!isMainRenderer(event.sender) && (!senderId || senderId !== noteId)) return null
  const note = desktopNoteSnapshots.get(noteId)
  return note ? { ...note, version: snapshotVersion } : null
})

ipcMain.handle('desktop-notes:patch', (event, requestedId, patch, requestId) => {
  const senderId = desktopNoteIdFromSender(event.sender)
  const noteId = safeNoteId(requestedId)
  if ((!isMainRenderer(event.sender) && (!senderId || senderId !== noteId)) || !patch || typeof patch !== 'object') {
    return { accepted: false }
  }

  const safePatch = {}
  if (typeof patch.content === 'string') safePatch.content = patch.content.slice(0, DESKTOP_NOTE_CONTENT_MAX_LENGTH)
  if (['yellow', 'green', 'blue', 'rose', 'slate'].includes(patch.color)) {
    safePatch.color = patch.color
  }
  if (typeof patch.alwaysOnTop === 'boolean') {
    safePatch.alwaysOnTop = patch.alwaysOnTop
  }
  if (Object.keys(safePatch).length === 0) return { accepted: false }
  return sendDesktopNoteCommand({ type: 'patch', id: noteId, patch: safePatch },
    safeRequestId(requestId) ? `${noteId}:${safeRequestId(requestId)}` : undefined)
})

ipcMain.handle('desktop-notes:action', (event, requestedId, action, requestId) => {
  const senderId = desktopNoteIdFromSender(event.sender)
  const noteId = safeNoteId(requestedId)
  if (!isMainRenderer(event.sender) && (!senderId || senderId !== noteId)) return { accepted: false }
  if (!['close', 'delete', 'add-today', 'add-tomorrow'].includes(action)) return { accepted: false }
  if (action === 'close') return coordinateClose(noteId)
  return sendDesktopNoteCommand({ type: action, id: noteId },
    safeRequestId(requestId) ? `${noteId}:${safeRequestId(requestId)}` : undefined)
})

ipcMain.handle('ai:summary', async (event, request) => {
  if (!isMainRenderer(event.sender)) throw new Error('不允许的调用来源')
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
    signal: AbortSignal.timeout(30_000),
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

ipcMain.handle('app:notify', (event, request) => {
  if (!isMainRenderer(event.sender)) return { shown: false }
  if (!Notification.isSupported()) return { shown: false }
  const title =
    String(request?.title ?? '').trim().slice(0, 80) || 'Personal Command Deck'
  const body = String(request?.body ?? '').trim().slice(0, 200)
  const notification = new Notification({ title, body, icon: appIconPath })
  notification.on('click', showMainWindow)
  notification.show()
  return { shown: true }
})

ipcMain.handle('settings:get', async (event) => {
  if (!isMainRenderer(event.sender)) throw new Error('不允许的调用来源')
  return {
    settings: readSettings(),
    shortcut: getShortcutStatus(),
  }
})

// 录制新快捷键期间挂起已注册的全局热键，否则按下当前组合键会被系统级热键
// 吞掉，键盘事件到不了渲染进程，录制器收不到输入
ipcMain.handle('settings:set-shortcut-capture', (event, active) => {
  if (!isMainRenderer(event.sender)) throw new Error('不允许的调用来源')
  if (active) {
    globalShortcut.unregisterAll()
    registeredShortcut = ''
    return { shortcut: getShortcutStatus() }
  }
  return { shortcut: registerGlobalShortcut() }
})

ipcMain.handle('settings:update-global-shortcut', async (event, request) => {
  if (!isMainRenderer(event.sender)) throw new Error('不允许的调用来源')
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
  isQuitting = true
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

app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault()
    quitApp()
    return
  }
  if (storageFlushTimer) {
    clearTimeout(storageFlushTimer)
    storageFlushTimer = null
  }
  session.defaultSession.flushStorageData()
  globalShortcut.unregisterAll()
})
