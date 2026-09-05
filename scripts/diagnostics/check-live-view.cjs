const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  await win.loadURL('http://localhost:4173/');
  await new Promise(r => setTimeout(r, 2000));

  // Capture current state
  const img1 = await win.webContents.capturePage();
  fs.writeFileSync('C:/Users/p/.gemini/antigravity/brain/93271d1b-7b1e-4730-b18a-987ebc27640f/current_browser_view.png', img1.toPNG());
  
  const currentUrl = win.webContents.getURL();
  const title = await win.webContents.executeJavaScript('document.title');
  const bodyText = await win.webContents.executeJavaScript('document.body.innerText.substring(0, 300)');
  const sidebarExists = await win.webContents.executeJavaScript('Boolean(document.querySelector("aside"))');
  const sidebarVisible = await win.webContents.executeJavaScript('(() => { const el = document.querySelector("aside"); return el ? window.getComputedStyle(el).display : "none"; })()');
  const sidebarRect = await win.webContents.executeJavaScript('(() => { const el = document.querySelector("aside"); return el ? el.getBoundingClientRect() : null; })()');
  
  console.log('Current URL:', currentUrl);
  console.log('Title:', title);
  console.log('Body Text Snippet:', bodyText.replace(/\n/g, ' '));
  console.log('Sidebar Exists:', sidebarExists);
  console.log('Sidebar Display:', sidebarVisible);
  console.log('Sidebar Rect:', sidebarRect);

  app.quit();
});
