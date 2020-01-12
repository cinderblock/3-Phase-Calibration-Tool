import { ipcMain, IpcMainEvent } from 'electron';

import { selectMotor, setTestMode } from '../motorControl';

import { recursiveAssign } from '../utils/recursiveAssign';
import { makeObjectSetterRecursive } from '../utils/makeProtectedObject';
import { UserControlUpdate, UserControlsFull } from '../renderer-shared-types/UserControls';

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

  testCommand: next => setTestMode(next),
});

/**
 * Update the internal `state.userControls` with new sanitized values.
 *
 * @param userControlsUpdate Incoming changes to user controls
 */
function handleIncomingControls(event: IpcMainEvent, userControlsUpdate: UserControlUpdate): void {
  // DEBUG
  // console.log('received controls:', userControlsUpdate);

  recursiveAssign(protectedControls, userControlsUpdate);
}

export function setupUserControls(): () => void {
  ipcMain.on('userControls', handleIncomingControls);

  return (): void => {
    ipcMain.removeListener('userControls', handleIncomingControls);
  };
}
