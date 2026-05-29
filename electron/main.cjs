const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
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
      preload: path.join(__dirname, 'preload.cjs'),
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
