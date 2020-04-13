import { ipcMain, IpcMainEvent } from 'electron';

import { selectMotor, clearFault, sendMlxReadManual } from '../motorControl';

import { recursiveAssign } from '../utils/recursiveAssign';
import { makeObjectSetterRecursiveTyped } from '../utils/makeProtectedObject';
import {
  UserControlUpdate,
  UserControlsFull,
  UserCommand,
  UserCommands,
  RunMode,
  MotorCommandMode,
} from '../shared/UserControls';
import { clampPositive, clampRange } from '../utils/filters/clampRange';

const AMPLITUDE_LIMIT = 100;
const VELOCITY_LIMIT = 100;

// State of the system with initial values
export const realControls: UserControlsFull = {
  sequence: 0,
  mode: RunMode.Disconnected,
  mlxCommandInterval: 3,
  drive: {
    CommandInterval: 3,
    CommandMode: MotorCommandMode.PhasePosition,
  },
};

export const protectedControls = makeObjectSetterRecursiveTyped(realControls, {
  sequence(next) {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realControls.sequence = next;
  },

  connected(next) {
    if (typeof next === 'string') selectMotor(next);
  },

  mode(next: unknown) {
    if (typeof next !== 'number') return;
    if (!Object.values(RunMode).includes(next)) return;

    realControls.mode = next;
  },

  mlxCommandInterval(next) {
    if (Number.isFinite(next)) realControls.mlxCommandInterval = clampPositive(next, 2000);
  },

  drive: {
    CommandInterval(next): void {
      if (Number.isFinite(next)) realControls.drive.CommandInterval = clampPositive(next, 2000);
    },

    CommandMode(next: unknown): void {
      if (typeof next !== 'number') return;
      if (!Object.values(MotorCommandMode).includes(next)) return;

      realControls.drive.CommandMode = next;
    },

    angle(next: unknown): void {
      if (typeof next !== 'number') return;
      if (Number.isFinite(next)) realControls.drive.angle = clampPositive(next, 2 * Math.PI);
    },

    amplitude(next: unknown): void {
      if (typeof next !== 'number') return;
      if (Number.isFinite(next)) realControls.drive.amplitude = clampPositive(next, AMPLITUDE_LIMIT);
    },

    velocity(next: unknown): void {
      if (typeof next !== 'number') return;
      if (Number.isFinite(next)) realControls.drive.velocity = clampRange(next, VELOCITY_LIMIT);
    },
  },
});

/**
 * Update the internal `state.userControls` with new sanitized values.
 *
 * @param userControlsUpdate Incoming changes to user controls
 */
function handleIncomingControls(event: IpcMainEvent, userControlsUpdate: UserControlUpdate): void {
  // DEBUG
  console.log('Received Controls:', userControlsUpdate);

  recursiveAssign(protectedControls, userControlsUpdate);
}

function handleIncomingCommand(event: IpcMainEvent, command: UserCommand): void {
  // DEBUG
  console.log('Received Command:', command);

  switch (command.command) {
    default:
      return;
    case UserCommands.ClearFault:
      return clearFault();
    case UserCommands.ReadMLX:
      if (!command.period) return sendMlxReadManual(command.which);
  }
}

export function setupUserControls(): () => void {
  ipcMain.on('userControls', handleIncomingControls);
  ipcMain.on('userCommand', handleIncomingCommand);

  return (): void => {
    ipcMain.removeListener('userControls', handleIncomingControls);
    ipcMain.removeListener('userCommand', handleIncomingCommand);
  };
}
