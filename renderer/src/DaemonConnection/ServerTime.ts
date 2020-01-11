import { useState, useEffect } from 'react';
import SocketConnection from '.';
import ExponentialFilter from '../utils/ExponentialFilter';
import { State as SharedState } from '../../shared/State';

let delta: number;

const filter = ExponentialFilter(0.01);

type Receiver = (delta: number) => void;

const receivers: Receiver[] = [];

SocketConnection.on('update', ({ time }: SharedState) => {
  const now = Date.now();

  delta = filter(time - now);

  receivers.forEach(receiver => receiver(delta));
});

function ServerDelta(): number {
  return delta;
}

function ServerTime(): number {
  return Date.now() + delta;
}

function notifyNewDelta(receiver: Receiver): () => void {
  receivers.push(receiver);

  return function unNotify(): void {
    receivers.splice(receivers.indexOf(receiver), 1);
  };
}

function useServerDelta(precision = 1): number {
  const [d, setDelta] = useState(delta);
  useEffect(() =>
    notifyNewDelta(newDelta => {
      if (newDelta === undefined && d === undefined) return;
      if (Math.abs(d - newDelta) < precision) return;
      setDelta(newDelta);
    }),
  );
  return d;
}

export { ServerTime, ServerDelta, notifyNewDelta, useServerDelta };
