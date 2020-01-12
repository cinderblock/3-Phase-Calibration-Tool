import React from 'react';
import { State } from '../main-shared-types/State';
import fastEqual from 'fast-deep-equal';
import { useState, useEffect } from 'react';
import backend from '.';
import { IpcRendererEvent } from 'electron';

export type BackendStateMapper<T> = (state: State) => T;

type Equal<T> = (a: T, b: T) => boolean;

export function useBackendStateUpdate<T>(mapper: BackendStateMapper<T>, equal?: Equal<T>): T;
export function useBackendStateUpdate<T>(mapper: BackendStateMapper<T>, initialState: T): T;
export function useBackendStateUpdate<T>(mapper: BackendStateMapper<T>, equal?: Equal<T> | T, initialState?: T): T {
  if (typeof equal != 'function') {
    initialState = equal;
    equal = fastEqual;
  }

  const [state, setState] = useState<T>(initialState as T);

  useEffect(() => {
    const listener = (event: IpcRendererEvent, nextState: State): void => {
      const reduced = mapper(nextState);
      if ((equal as Equal<T>)(reduced, state)) return;
      setState(reduced);
    };

    backend.on('StateUpdate', listener);

    return (): void => {
      backend.removeListener('StateUpdate', listener);
    };
  });

  return state;
}

export function BackendStateData<T>({
  mapper,
  equal,
}: {
  mapper: BackendStateMapper<T>;
  equal?: Equal<T>;
}): JSX.Element {
  return <>{useBackendStateUpdate(mapper, equal)}</>;
}
