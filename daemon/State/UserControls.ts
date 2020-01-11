/* eslint-disable @typescript-eslint/no-explicit-any */

import { clampPositive, clampRange } from '../utils/filters/clampRange';
import { makeObjectSetterRecursive } from '../utils/makeProtectedObject';

import { State as StateType } from '../../shared/State';
import { PIDConstants, forEachPID } from '../../shared/utils/PIDTypes';
import { recursiveAssign } from '../utils/recursiveAssign';
import { UserControlUpdate } from '../../shared/UserControls';

/**
 * These are the control values tat are actually in use.
 * Default values are set here.
 * These are separated from the 'protected' controls.
 * Protected controls are sanitized and used to update there 'real' controls.
 */
export const realUserControls: StateType['userControls'] = {
  sequence: 0,
};

// const motorPidLimits: Partial<PIDConstants> = { kP: 10 * 1000, kI: 0, kD: 20 };

// function makePIDSetters(o: PIDConstants, limits: Partial<PIDConstants> = {}): PIDConstants<(next: number) => void> {
//   return forEachPID(which => (next: number): void => {
//     if (Number.isFinite(next)) o[which] = clampPositive(next, limits[which] ?? Infinity);
//   });
// }

/**
 * These are the functions that sanitize the controls as they come in
 * from potentially corrupt sources.
 * After sanitization, the real values are place into corresponding `realControls`
 */
export const protectedControls = makeObjectSetterRecursive(realUserControls, {
  sequence: (next: any): void => {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realUserControls.sequence = next;
  },
});

/**
 * Update the internal `state.userControls` with new sanitized values.
 *
 * @param userControlsUpdate Incoming changes to user controls
 */
function handleIncomingControls(userControlsUpdate: UserControlUpdate): void {
  recursiveAssign(protectedControls, userControlsUpdate);
}

// TODO: Call above function...
