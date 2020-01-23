import { BrowserWindow } from 'electron';

import * as debug from './utils/debug';
import { state, updateTimes } from './State';
import { setupUserControls, realControls, protectedControls } from './State/UserControls';
import initializeMotor from './Motors/CommHandler';
import { start, addAttachListener, CommandMode, Command } from 'smooth-control';
import { makePacket, Opcode, Marker } from 'mlx90363';
import { RunMode, MotorCommandMode } from './renderer-shared-types/UserControls';

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

let mlxBlockingDelay: NodeJS.Timeout | undefined;

function updateMlxData(): void {
  if (mlxBlockingDelay) return;

  const res = safeSend({ mode: CommandMode.MLXDebug, data: getXYZPacket });

  if (res === null) {
    console.log('Motor missing');
    realControls.mode = RunMode.Manual;
    return;
  }
  if (res === undefined) {
    // Still sending last command
    return;
  }

  mlxBlockingDelay = setTimeout(() => {
    mlxBlockingDelay = undefined;
  }, realControls.mlxCommandInterval);

  // No reason to keep process running if this timeout gets lost
  mlxBlockingDelay.unref();
}

function sendCurrentMotorCommandAutomatic(): ReturnType<typeof safeSend> | undefined {
  switch (realControls.drive.CommandMode) {
    case MotorCommandMode.PhasePosition:
      if (realControls.drive.angle === undefined) return undefined;
      if (realControls.drive.amplitude === undefined) return undefined;
      return safeSend({
        mode: CommandMode.Calibration,
        angle: realControls.drive.angle,
        amplitude: realControls.drive.amplitude,
      });

    case MotorCommandMode.Synchronous:
      if (realControls.drive.velocity === undefined) return undefined;
      if (realControls.drive.amplitude === undefined) return undefined;
      return safeSend({
        mode: CommandMode.SynchronousDrive,
        amplitude: realControls.drive.amplitude,
        velocity: realControls.drive.velocity,
      });

    case MotorCommandMode.Push:
    case MotorCommandMode.Servo:
      return undefined;
  }
}

function sendCurrentMotorCommand(): ReturnType<typeof safeSend> | undefined {
  switch (realControls.mode) {
    case RunMode.Disconnected:
    default:
      return null;
    case RunMode.Manual:
      // All command sends to motor re initiated by user
      return undefined;

    case RunMode.Automatic:
      return sendCurrentMotorCommandAutomatic();

    case RunMode.Calibration:
      throw new Error('Not Yet Implemented');
  }
}

let motorBlockingDelay: NodeJS.Timeout | undefined;

function updateMotorData(): void {
  if (motorBlockingDelay) return;

  const res = sendCurrentMotorCommand();

  if (res === null) {
    // console.log('Motor missing');
    realControls.mode = RunMode.Manual;
    return;
  }
  if (res === undefined) {
    // Missing required info
    return;
  }
  if (res === false) {
    // Motor missing
    return;
  }

  motorBlockingDelay = setTimeout(() => {
    motorBlockingDelay = undefined;
  }, realControls.drive.CommandInterval);

  // No reason to keep process running if this timeout gets lost
  motorBlockingDelay.unref();
}

function updateMotor(): void {
  if (realControls.mode === RunMode.Automatic || realControls.mode === RunMode.Calibration) {
    updateMlxData();

    updateMotorData();
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
