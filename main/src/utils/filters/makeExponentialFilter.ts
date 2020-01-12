import { Filter } from './FilterInterface';

export default function makeExponentialFilter(lambda: number): Filter & { setLambda: (l: number) => void } {
  let current: number | undefined;

  /**
   * Reset the internal filter to starting conditions
   */
  function reset(): void {
    current = undefined;
  }

  /**
   * Change the lambda value of the filter on the fly
   *
   * @param l New lambda
   */
  function setLambda(l: number): void {
    if (l < 0) throw new RangeError('Lambda cannot be less than 0.');
    if (l > 1) throw new RangeError('Lambda cannot be greater than 1.');

    lambda = l;
  }

  /**
   * Feed a value into the filter
   *
   * @param value Value to feed into filter
   */
  function feed(value: number): number {
    // Invalid value checking
    if (!isFinite(value)) throw new RangeError('Got invalid Number in ExponentialFilter: ' + value);

    if (current === undefined || !isFinite(current)) {
      return (current = value);
    }

    return (current = lambda * value + (1 - lambda) * current);
  }

  setLambda(lambda);

  return { feed, setLambda, reset };
}
