import { UserControllable, UserControlsFull } from '../../../remote/shared/UserControls';
import socket from '.';
import { useCallback } from 'react';
import { RecursivePartial } from '../utils/RecursivePartial';

let sequence = 0;

/**
 * Update controls state on backend.
 * @future Eventually, maybe this will return something for optimistic updates?
 * @param update The new Controls to send to backend
 */
export function updateUserControls(update: UserControllable): void {
  const userControls: RecursivePartial<UserControlsFull> = update;

  userControls.sequence = sequence++;

  socket.emit('userControls', userControls);

  console.log('Sending user controls:', userControls);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useUserControls<T extends any[]>(
  event: (...args: T) => UserControllable,
  deps: React.DependencyList = [],
): (...args: T) => ReturnType<typeof updateUserControls> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((...args) => updateUserControls(event(...args)), [event, ...deps]);
}
