import { BrowserWindow } from 'electron';

import * as debug from './utils/debug';
import { state, updateTimes } from './State';
import { setupUserControls } from './State/UserControls';
import initializeMotor from './Motors/CommHandler';
import { start, addAttachListener } from 'smooth-control';

function updateUI(window: BrowserWindow): void {
  window.webContents.send('StateUpdate', state);
}

function updateMotor(): void {
  // TODO: take UI controls and turn them into motor commands
}

export function startMotorControl(window: BrowserWindow): () => void {
  const removeAttachListener = addAttachListener((serial, usbDevice, isDuplicate, consumer) => {
    console.log('Motor connected:', serial);
    state.connectedMotorSerials.push(serial);
  });

  start();

  const main = setInterval(() => {
    removeAttachListener();
    updateTimes();
    updateMotor();
    updateUI(window);
  }, 2);

  const controlsShutdown = setupUserControls();

  return (): void => {
    clearInterval(main);
    controlsShutdown();
  };
}

debug.green('Hello, world.');
