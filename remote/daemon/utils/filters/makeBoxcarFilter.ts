import { Filter } from './FilterInterface';

export default function makeBoxcarFilter(length: number): Filter & { setSize(size: number): void } {
  const history: number[] = [];

  let sum = 0;

  /**
   * Reset boxcar filter
   */
  function reset(): void {
    sum = 0;
    history.length = 0;
  }

  /**
   * Trim the history to the length we need
   */
  function handleOverLength(): void {
    while (history.length > length) sum -= history.pop() as number;
  }

  /**
   * Change the size of the current boxcar
   * @param n New size for boxcar filter
   */
  function setSize(n: number): void {
    if (n < 1) throw new RangeError('Boxcar length cannot be 0 or negative');
    if (n > 30) throw new RangeError('Boxcar length too long');
    length = n;

    handleOverLength();
  }

  /**
   * Advance boxcar one step
   *
   * @param x Value to add to the beginning of filter
   */
  function feed(x: number): number {
    // Invalid value checking
    if (!isFinite(x)) {
      throw new Error('Got invalid Number in Boxcar filter: ' + x);
    }
    history.unshift(x);
    sum += x;

    handleOverLength();

    return sum / Math.min(history.length, length);
  }

  setSize(length);

  return { feed, setSize, reset };
}
