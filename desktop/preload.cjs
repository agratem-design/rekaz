const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  
  // Backup triggers and queries
  startBackup: () => ipcRenderer.invoke('backup:start-manual'),
  openBackupFolder: (filePath) => ipcRenderer.invoke('backup:open-folder', filePath),
  getBackupStatus: () => ipcRenderer.invoke('backup:get-status'),
  
  // App information
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),

  // Event subscription with cleanup function
  onBackupStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('backup:status', listener);
    return () => {
      ipcRenderer.removeListener('backup:status', listener);
    };
  }
});
