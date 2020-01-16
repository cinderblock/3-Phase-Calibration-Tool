import { BrowserWindow } from 'electron';

import * as debug from './utils/debug';
import { state, updateTimes } from './State';
import { setupUserControls, realControls } from './State/UserControls';
import initializeMotor from './Motors/CommHandler';
import { start, addAttachListener, MLXCommand, CommandMode } from 'smooth-control';
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';

let activeMotor: ReturnType<typeof initializeMotor> | undefined;

function updateUI(window: BrowserWindow): void {
  window.webContents.send('StateUpdate', state);
}

function updateMotor(): void {
  // TODO: take UI controls and turn them into motor commands
}

export function clearFault(): void {
  activeMotor?.clearFault();
}

export function sendMlxRead(mode: 'xyz' | 'nop'): void {
  const data =
    mode == 'nop'
      ? makePacket({ opcode: Opcode.NOP__Challenge })
      : makePacket({
          opcode: Opcode.GET1,
          marker: Marker.XYZ,
          data16: [, 0xffff],
        });

  activeMotor?.motor.write({ mode: CommandMode.MLXDebug, data });
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
