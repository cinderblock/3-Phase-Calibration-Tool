import { posix } from 'path';
import isDev from 'electron-is-dev';
import { BrowserWindow, app, screen } from 'electron';
import { startMotorControl } from './motorControl';

const { join } = posix;

let mainWindow: BrowserWindow;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(join(__dirname, '../build/index.html'));
  }

  const mainShutdown = startMotorControl(mainWindow);

  mainWindow.on('closed', mainShutdown);
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
