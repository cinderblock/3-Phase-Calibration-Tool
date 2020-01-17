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
} from '../renderer-shared-types/UserControls';
import { clampPositive } from '../utils/filters/clampRange';

const AMPLITUDE_LIMIT = 100;

// State of the system with initial values
export const realControls: UserControlsFull = {
  sequence: 0,
  mode: RunMode.Disconnected,
};

export const protectedControls = makeObjectSetterRecursiveTyped(realControls, {
  sequence(next) {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realControls.sequence = next;
  },

  connected(next) {
    if (typeof next === 'string') selectMotor(next);
  },

  angle(next) {
    if (Number.isFinite(next)) realControls.angle = clampPositive(next, 2 * Math.PI);
  },

  amplitude(next) {
    if (Number.isFinite(next)) realControls.amplitude = clampPositive(next, AMPLITUDE_LIMIT);
  },

  mode(next) {
    if (typeof next !== 'number') return;
    if (!Object.values(RunMode).includes(next)) return;

    realControls.mode = next;
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
