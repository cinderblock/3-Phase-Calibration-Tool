import { Filter } from './FilterInterface';

export default function makeIntegrator(): Filter {
  // zero the integral first time through
  let current = 0;

  /**
   * Reset integrator to default value
   */
  function reset(): void {
    current = 0;
  }

  /**
   * Feed a new value into the integrator
   * @param value Next value to feed to filter
   */
  function feed(value: number): number;
  /**
   * Reset integrator
   */
  function feed(): void;
  function feed(value?: number): number | void {
    if (value === undefined) return reset();

    // Coerce to Number
    const num = Number(value);

    // Invalid value checking
    if (!isFinite(num)) throw new RangeError('Got invalid Number in Integrator: ' + value);

    return (current += num);
  }

  return { feed, reset };
}
