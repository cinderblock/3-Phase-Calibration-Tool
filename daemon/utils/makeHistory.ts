export interface HistoryBuffer<T> {
  shift: () => void;
  get: (index: number) => T;
  reset: () => void;
}

export function makeHistoryBuffer<T extends {}>(length: number, initialFill = (): T => ({} as T)): HistoryBuffer<T> {
  const history: T[] = [];
  let pos = 0;

  function shift(): void {
    pos++;
    pos %= length;
  }

  function get(index: number): T {
    if (index >= length) throw new RangeError("Can't access history that has been forgotten!");

    return history[(pos + index) % length];
  }

  function reset(): void {
    for (let i = 0; i < length; i++) history.push(initialFill());
  }

  reset();

  return { shift, get, reset };
}
