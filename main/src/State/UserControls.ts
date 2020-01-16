import { ipcMain, IpcMainEvent } from 'electron';

import { selectMotor, clearFault, sendMlxRead } from '../motorControl';

import { recursiveAssign } from '../utils/recursiveAssign';
import { makeObjectSetterRecursive } from '../utils/makeProtectedObject';
import { UserControlUpdate, UserControlsFull, UserCommand, UserCommands } from '../renderer-shared-types/UserControls';
import { clampPositive } from '../utils/filters/clampRange';

const AMPLITUDE_LIMIT = 100;

// State of the system with initial values
export const realControls: UserControlsFull = {
  sequence: 0,
};

export const protectedControls = makeObjectSetterRecursive(realControls, {
  sequence(next) {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realControls.sequence = next;
  },

  connected(next) {
    if (typeof next === 'string') selectMotor(next);
  },

  angle(next) {
    const num = Number(next);
    if (Number.isFinite(num)) realControls.angle = clampPositive(num, 2 * Math.PI);
  },

  amplitude(next) {
    const num = parseInt(next);
    if (Number.isFinite(num)) realControls.amplitude = clampPositive(num, AMPLITUDE_LIMIT);
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
      if (!command.period) return sendMlxRead(command.which);
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
