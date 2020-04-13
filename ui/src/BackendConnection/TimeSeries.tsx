import React from 'react';
import { TimeSeries } from 'react-smoothie';
import { ITimeSeriesOptions } from 'smoothie';

import backend from '.';
import { BackendStateMapper } from './BackendState';

import { State } from '../main-shared-types/State';

function makeTimeSeriesUpdate(
  reducer: BackendStateMapper<number | undefined | null>,
  timeSeriesOptions?: ITimeSeriesOptions,
): TimeSeries {
  const ret = new TimeSeries(timeSeriesOptions);
  backend.on('StateUpdate', (_, state: State) => {
    try {
      const y = reducer(state);

      if (y === undefined) return;
      if (y === null) return;

      ret.append(state.time, y);
    } catch (e) {
      console.log('Error reducing value:', e);
    }
  });

  return ret;
}

export function useTimeSeries(
  reducer: BackendStateMapper<number | undefined>,
  timeSeriesOptions?: ITimeSeriesOptions,
): TimeSeries {
  const ref = React.useRef<TimeSeries | null>(null);

  // TODO: Use something like the following to keep the TimeSeries object around (possibly unless it's options change)
  // while allowing the reducer to depend on local state/deps.
  /*
  reducer = React.useCallback(noFail(reducer), deps);

  if (ref.current === null) {
    ref.current = new TimeSeries(timeSeriesOptions);

    backend.on('StateUpdate', (state: State) => {
      const y = reducer(state);
      if (y !== undefined) ref.current.append(state.time, y);
    });
  }
  //*/

  if (ref.current === null) ref.current = makeTimeSeriesUpdate(reducer, timeSeriesOptions);

  return ref.current;
}
