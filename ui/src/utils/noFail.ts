/**
 * Create a new version of a function that, on exception, simply returns undefined instead
 * @param original Function to wrap
 */
export function noFail<F extends (...args: A[]) => R, A, R>(original: F): (...args: Parameters<F>) => R {
  return (...args: Parameters<F>): R => {
    try {
      return original(...args);
    } catch (e) {}
    return (undefined as unknown) as R;
  };
}
