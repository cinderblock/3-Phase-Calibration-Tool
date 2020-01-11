export function PowerAccumulationApproximator(resistance: number): (value?: number) => number {
  if (resistance <= 0 || resistance >= 1)
    throw new RangeError('Invalid resistance used in PowerAccumulationApproximator');

  // zero the integral first time through
  let current = 0;

  let lastTime = Date.now();

  // At some constant time period, reduce the accumulated power by some proportional amount.
  setInterval(() => {
    current *= resistance;
  }, 100);

  function feed(value?: number): number {
    // Special case. Reset to 0.
    if (value === undefined) {
      return (current = 0);
    }

    const now = Date.now();

    // Make sure we don't react poorly to motor being newly connected
    const dt = Math.min(now - lastTime, 1000);

    lastTime = now;

    // Coerce to Number
    const amplitude = Number(value);
    // Invalid value checking
    if (!isFinite(amplitude)) throw new RangeError('Got invalid Number in Integrator: ' + value);

    const num = amplitude * amplitude * dt;

    return (current += num);
  }

  return feed;
}
