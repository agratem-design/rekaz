// ركاز — نسخة سطح المكتب (Windows). تحمّل نفس تطبيق الويب المبني (dist) وتتصل بنفس قاعدة البيانات.
const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')

// نسخة واحدة فقط من البرنامج
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.setAppUserModelId('ly.rikaz.app')
let mainWindow = null

function isAppUrl(url) {
  return url.startsWith('file:') || (process.env.ELECTRON_START_URL && url.startsWith(process.env.ELECTRON_START_URL))
}

function windowOptions(extra = {}) {
  return {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'ركاز',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f8f4ec',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
    ...extra,
  }
}

function wireWindow(win) {
  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win.show())
  // نوافذ الطباعة داخل البرنامج، والروابط الخارجية في المتصفح
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow', overrideBrowserWindowOptions: windowOptions({ width: 1000, height: 900 }) }
    if (url.startsWith('http:') || url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-create-window', (child) => wireWindow(child))
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow(windowOptions())
  wireWindow(mainWindow)
  if (process.env.ELECTRON_START_URL) mainWindow.loadURL(process.env.ELECTRON_START_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  mainWindow.on('closed', () => (mainWindow = null))
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => app.quit())
