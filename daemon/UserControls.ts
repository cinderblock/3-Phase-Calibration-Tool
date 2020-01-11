/* eslint-disable @typescript-eslint/no-explicit-any */

import { makeObjectSetterRecursive } from './utils/makeProtectedObject';

import { recursiveAssign } from './utils/recursiveAssign';
import { UserControlUpdate, UserControlsFull } from '../shared/UserControls';
// State of the system with initial values
export const realControls: UserControlsFull = {
  sequence: 0,
};

export const protectedControls = makeObjectSetterRecursive(realControls, {
  sequence: (next: any): void => {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realControls.sequence = next;
  },
});

/**
 * Update the internal `state.userControls` with new sanitized values.
 *
 * @param userControlsUpdate Incoming changes to user controls
 */
export function handleIncomingControls(userControlsUpdate: UserControlUpdate): void {
  recursiveAssign(protectedControls, userControlsUpdate);
}
