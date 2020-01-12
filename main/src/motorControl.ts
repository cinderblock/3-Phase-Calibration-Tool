import { BrowserWindow } from 'electron';

import * as debug from './utils/debug';
import { state, updateTimes } from './State';
import { setupUserControls, realControls } from './State/UserControls';
import initializeMotor from './Motors/CommHandler';
import { start, addAttachListener, MLXCommand, CommandMode } from 'smooth-control';

import { TestCommand } from './renderer-shared-types/UserControls';
import { delay } from './utils/PromiseDelay';

let activeMotor: ReturnType<typeof initializeMotor> | undefined;

function updateUI(window: BrowserWindow): void {
  window.webContents.send('StateUpdate', state);
}

let manualBusy = false;

function updateMotor(): void {
  // TODO: take UI controls and turn them into motor commands

  if (realControls.testCommand === 'manual' && !manualBusy) {
    const angle = realControls.angle;
    if (angle === undefined) return;
    const res = activeMotor?.motor.write({ mode: CommandMode.Calibration, amplitude: 0, angle });

    if (!res) {
      console.log('Failed to send?');
      realControls.testCommand = undefined;
    } else {
      manualBusy = true;
      res
        .then(() => delay(50))
        .then(() => {
          manualBusy = false;
        });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setTestMode(next: any): void {
  // Next test mode

  switch (next as TestCommand) {
    case 'clearFault':
      activeMotor?.clearFault();
      break;
    case 'debugMLX':
      // activeMotor?.motor.write({ mode: CommandMode.MLXDebug,  });
      break;
    case 'manual':
      if (realControls.testCommand === 'manual') return;
      realControls.angle = 0;
      break;
    default:
      return;
  }

  realControls.testCommand = next;
}

export function selectMotor(serial: string): void {
  // TODO: implement
  if (activeMotor) {
    activeMotor.close();
  }

  activeMotor = initializeMotor(serial, 0, true, state.motorState, () => {
    // on attach
    console.log('atched!');

    realControls.connected = serial;
  });
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
