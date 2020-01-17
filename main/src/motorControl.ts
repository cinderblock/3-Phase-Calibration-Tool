import { BrowserWindow } from 'electron';

import * as debug from './utils/debug';
import { state, updateTimes } from './State';
import { setupUserControls, realControls, protectedControls } from './State/UserControls';
import initializeMotor from './Motors/CommHandler';
import { start, addAttachListener, CommandMode, Command } from 'smooth-control';
import { makePacket, Opcode, Marker } from 'mlx90363';
import { RunMode } from './renderer-shared-types/UserControls';

let activeMotor: ReturnType<typeof initializeMotor> | undefined;

function updateUI(window: BrowserWindow): void {
  window.webContents.send('StateUpdate', state);
}

let blockSend = false;

/**
 * Send a command to motor safely
 * @param command Command to send
 * @returns null - when motor not connected. false - when busy sending - promise when sent
 */
function safeSend(command: Command): null | false | Promise<void> {
  if (blockSend) return false;
  blockSend = true;

  const res = activeMotor?.motor.write(command);
  if (!res) {
    blockSend = false;
    return null;
  }

  return res.then(() => {
    blockSend = false;
  });
}

const getXYZPacket = makePacket({
  opcode: Opcode.GET1,
  marker: Marker.XYZ,
  data16: [, 0xffff],
});

function getData(): void {
  const res = safeSend({ mode: CommandMode.MLXDebug, data: getXYZPacket });
  if (res === null) {
    console.log('Motor missing');
    realControls.mode = RunMode.Manual;
  }
  if (res === undefined) {
    // Still sending last command
  }
}

function updateMotor(): void {
  // TODO: take UI controls and turn them into motor commands

  if (realControls.mode === RunMode.Automatic || realControls.mode === RunMode.Calibration) {
    getData();
  }
}

export function clearFault(): void {
  const res = safeSend({ mode: CommandMode.ClearFault });

  if (!res) {
    console.log('Failed to send clearFault');
    if (res === undefined) console.log('Motor missing!');
  }
}

export function sendMlxReadManual(mode: 'xyz' | 'nop'): void {
  if (realControls.mode != RunMode.Manual) return;

  const data =
    mode == 'nop'
      ? makePacket({ opcode: Opcode.NOP__Challenge })
      : makePacket({
          opcode: Opcode.GET1,
          marker: Marker.XYZ,
          data16: [, 0xffff],
        });

  const res = activeMotor?.motor.write({ mode: CommandMode.MLXDebug, data });

  if (!res) {
    console.log('Failed to sendMlxReadManual');
    if (res === undefined) console.log('Motor missing!');
  }
}

export function selectMotor(serial: string): void {
  // TODO: implement
  if (activeMotor) {
    activeMotor.close();
  }

  activeMotor = initializeMotor(serial, 0, true, state.motorState, () => {
    // on attach
    console.log('atched!');

    protectedControls.mode = RunMode.Manual;

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
  }, 3);

  const controlsShutdown = setupUserControls();

  return (): void => {
    clearInterval(main);
    controlsShutdown();
  };
}

debug.green('Hello, world.');
