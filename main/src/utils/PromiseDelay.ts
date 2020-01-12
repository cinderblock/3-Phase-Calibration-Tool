/**
 * Create a new Promise that will resolve in some number of milliseconds
 *
 * @param ms Resolve time in milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}
