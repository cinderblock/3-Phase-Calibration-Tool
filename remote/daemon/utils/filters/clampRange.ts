/**
 * Keep a value within a specified range
 * @param x Value to filter
 * @param min lower bound to clamp values to
 * @param max upper bound to clamp values to
 */
export function clampRange(x: number, min: number, max: number): number;
/**
 * Keep a value within a specified range, symmetric around 0
 * @param x Value to filter
 * @param range max/min range to clamp value to
 */
export function clampRange(x: number, range: number): number;
export function clampRange(x: number, min: number, max?: number): number {
  // Make max optional (will use symmetric range around 0)
  if (max === undefined) max = -min;

  // Handle arguments out of order
  if (min > max) return clampRange(x, max, min);

  if (x > max) return max;
  if (x < min) return min;

  return x;
}

/**
 * Prevent a value from going negative
 *
 * @param x Value to clamp
 */
export function clampPositive(x: number, max = Infinity): number {
  return clampRange(x, 0, max);
}
