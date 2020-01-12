import { BrowserWindow } from 'electron';

import * as debug from './utils/debug';
import { state, updateTimes } from './State';
import { setupUserControls } from './State/UserControls';

function updateUI(window: BrowserWindow): void {
  window.webContents.send('StateUpdate', state);
}

function updateMotor(): void {
  // TODO: take UI controls and turn them into motor commands
}

export function startMotorControl(window: BrowserWindow): () => void {
  const main = setInterval(() => {
    updateTimes();
    updateMotor();
    updateUI(window);
  }, 100);

  const controlsShutdown = setupUserControls();

  return (): void => {
    clearInterval(main);
    controlsShutdown();
    window.destroy();
  };
}

debug.green('Hello, world.');
