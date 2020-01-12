import { join } from 'path';
import isDev from 'electron-is-dev';
import { BrowserWindow, app, screen } from 'electron';
import { startMotorControl } from './motorControl';

let mainWindow: BrowserWindow;

function createWindow(): void {
  let offset: { x: number; y: number };

  if (isDev) {
    const displays = screen.getAllDisplays();
    const externalDisplay =
      // For Cameron's dev machine
      displays[2] ||
      // For people that have 2 screens
      displays.find(display => {
        return display.bounds.x !== 0 || display.bounds.y !== 0;
      });

    if (externalDisplay) {
      offset = {
        x: externalDisplay.bounds.x + 150,
        y: externalDisplay.bounds.y + 50,
      };
    }
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ...offset!,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'build', 'index.html'));
  }

  mainWindow.webContents.once('dom-ready', () => {
    const mainShutdown = startMotorControl(mainWindow);

    mainWindow.on('closed', mainShutdown);
  });

  mainWindow.on('closed', () => mainWindow.destroy());
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
