/* eslint-disable @typescript-eslint/no-explicit-any */

import { makeObjectSetterRecursive } from '../utils/makeProtectedObject';

import { recursiveAssign } from '../utils/recursiveAssign';
import { UserControlUpdate, UserControlsFull } from '../renderer-shared-types/UserControls';
import { ipcMain, IpcMainEvent } from 'electron';
// State of the system with initial values
export const realControls: UserControlsFull = {
  sequence: 0,
};

export const protectedControls = makeObjectSetterRecursive(realControls, {
  sequence(next) {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realControls.sequence = next;
  },
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
