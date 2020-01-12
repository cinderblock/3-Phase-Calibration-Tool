import { state } from '.';
import { uptimeSeconds } from '../utils/time';

export function updateTimes(): void {
  const now = uptimeSeconds();
  state.dt = state.uptime ? now - state.uptime : undefined;
  state.uptime = now;
  state.time = Date.now();
}
