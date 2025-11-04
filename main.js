const path = require('path');
const { app, BrowserWindow, nativeTheme } = require('electron');

function createWindow() {
  nativeTheme.themeSource = 'dark';

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
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
