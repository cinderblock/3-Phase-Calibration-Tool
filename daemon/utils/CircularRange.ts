const TAU = Math.PI * 2;

export interface CircularRange {
  normalizeHalf: (angle: number) => number;
  normalize: (angle: number) => number;
  average: (angles: readonly number[], throwOnUndefined?: boolean) => number;
}

export default function CircularRange(range: number = TAU, throwOnUndefinedDefault = false): CircularRange {
  const scale = range / TAU;
  /**
   * Return the positive modulus of a number
   */
  function mod(x: number, m: number): number {
    return ((x % m) + m) % m;
  }

  /**
   * Normalize an arbitrary angle to the interval [-180, 180) (if range is 360)
   */
  function normalizeHalf(angle: number): number {
    const half = range / 2;
    return mod(angle + half, range) - half;
  }

  /**
   * Normalize angle to the interval [0, 360) (if range is 360)
   */
  function normalize(angle: number): number {
    return mod(angle, range);
  }

  /**
   * Calculate the average angle of an array of angles
   */
  function average(angles: ReadonlyArray<number>, throwOnUndefined = throwOnUndefinedDefault): number {
    // Basically treat each angle as a vector, add all the vectors up,
    // and return the angle of the resultant vector.

    let y = 0;
    let x = 0;

    for (let i = 0; i < angles.length; i++) {
      const a = angles[i] / scale;
      y += Math.sin(a);
      x += Math.cos(a);
    }

    // If the resultant vector is very short, this means the average angle is likely wrong or ambiguous.
    // For instance, what if a users asks for the average of the angles [0, PI]?
    if (x * x + y * y < Number.EPSILON) {
      if (throwOnUndefined) throw 'Average angle is ambiguous';
      return NaN;
    }

    return Math.atan2(y, x) * scale;
  }

  return { normalizeHalf, normalize, average };
}
