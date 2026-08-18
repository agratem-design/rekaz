const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const backupService = require('./backupService.cjs');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;

function getIconPath() {
  const possiblePaths = [
    path.join(__dirname, '../dist/favicon.ico'),
    path.join(__dirname, '../public/favicon.ico'),
    path.join(__dirname, 'dist/favicon.ico'),
    path.join(__dirname, 'favicon.ico')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'منظومة ركاز - إدارة المشاريع والمقاولات',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Determine path to load
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devUrl = process.env.ELECTRON_START_URL;

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    // In production or packaged app
    const indexPathInParentDist = path.join(__dirname, '../dist/index.html');
    const indexPathInSubDist = path.join(__dirname, 'dist/index.html');
    const indexPathCurrent = path.join(__dirname, 'index.html');

    if (fs.existsSync(indexPathInParentDist)) {
      mainWindow.loadFile(indexPathInParentDist);
    } else if (fs.existsSync(indexPathInSubDist)) {
      mainWindow.loadFile(indexPathInSubDist);
    } else if (fs.existsSync(indexPathCurrent)) {
      mainWindow.loadFile(indexPathCurrent);
    } else {
      mainWindow.loadURL('http://localhost:8080');
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Trigger silent backup 5 seconds after startup
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        backupService.runBackup({
          triggerType: 'auto',
          onProgress: (statusData) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('backup:status', statusData);
            }
          }
        }).catch((err) => {
          console.error('[Auto Backup Error]:', err.message);
        });
      }
    }, 5000);
  });

  // Handle external link clicks
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure second instance focuses primary window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// App lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Setup IPC handlers
 */
function setupIpcHandlers() {
  // 1. Manual Backup Trigger
  ipcMain.handle('backup:start-manual', async () => {
    try {
      const result = await backupService.runBackup({
        triggerType: 'manual',
        onProgress: (statusData) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backup:status', statusData);
          }
        }
      });
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 2. Open Backup Directory / Select File in Windows Explorer
  ipcMain.handle('backup:open-folder', async (_event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }

    const backupDir = backupService.getBackupDirectory();
    if (fs.existsSync(backupDir)) {
      await shell.openPath(backupDir);
      return { success: true };
    }

    return { success: false, error: 'Directory does not exist' };
  });

  // 3. Get Backup Status & History
  ipcMain.handle('backup:get-status', async () => {
    return backupService.getBackupStatus();
  });

  // 4. App Info
  ipcMain.handle('app:get-info', async () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      userData: app.getPath('userData')
    };
  });
}
