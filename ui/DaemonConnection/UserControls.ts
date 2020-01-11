import { UserControllable, UserControlsAutomatic } from '../../shared/UserControls';
import socket from '.';
import { useCallback } from 'react';

let sequence = 0;

/**
 * Update controls state on backend.
 * @future Eventually, maybe this will return something for optimistic updates?
 * @param update The new Controls to send to backend
 */
export function updateUserControls(update: UserControllable): void {
  const userControls: UserControllable & Partial<UserControlsAutomatic> = update;

  userControls.sequence = sequence++;

  socket.emit('userControls', userControls);

  console.log('Sending user controls:', userControls);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useUserControls<T extends (...args: any[]) => UserControllable>(
  event: T,
): (...args: Parameters<T>) => ReturnType<typeof updateUserControls> {
  return useCallback((...args) => updateUserControls(event(...args)), [event]);
}
