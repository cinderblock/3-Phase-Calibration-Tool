import { state } from './main';
import { uptimeSeconds } from '../utils/time';

/**
 * High resolution start of latest "run", seconds
 */
let runStartTime = 0;

export function updateTimes(): void {
  const now = uptimeSeconds();
  state.dt = state.runTime ? now - state.runTime : undefined;
  state.runTime = now - runStartTime;
  state.time = Date.now();
}

export function zeroRunTime(): void {
  state.runTime = 0;
  runStartTime = uptimeSeconds();
}
