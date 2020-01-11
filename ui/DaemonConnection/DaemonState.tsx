import React from 'react';
import { State } from '../../shared/State';
import fastEqual from 'fast-deep-equal';
import { noFail } from '../utils/noFail';
import { useState, useEffect } from 'react';
import socket from '.';

export type DaemonStateReducer<T> = (state: State) => T;

type Equal<T> = (a: T, b: T) => boolean;

export function useDaemonStateUpdate<T>(reducer: DaemonStateReducer<T>, equal?: Equal<T>): T;
export function useDaemonStateUpdate<T>(reducer: DaemonStateReducer<T>, initialState: T): T;
export function useDaemonStateUpdate<T>(reducer: DaemonStateReducer<T>, equal?: Equal<T> | T, initialState?: T): T {
  if (typeof equal != 'function') {
    initialState = equal;
    equal = fastEqual;
  }

  const [state, setState] = useState<T>(initialState as T);

  reducer = noFail(reducer);

  const listener = (nextState: State): void => {
    const reduced = reducer(nextState);
    if ((equal as Equal<T>)(reduced, state)) return;
    setState(reduced);
  };

  useEffect(() => {
    socket.on('update', listener);
    return (): void => {
      socket.removeListener('update', listener);
    };
  });

  return state;
}

export function DaemonStateData<T>({
  reducer,
  equal,
}: {
  reducer: DaemonStateReducer<T>;
  equal?: Equal<T>;
}): JSX.Element {
  return <>{useDaemonStateUpdate(reducer, equal)}</>;
}
