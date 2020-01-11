/**
 * Call a timeout function if a watchdog interval is ever missed
 *
 * @param interval Interval to wait for an event before firing timeout function
 * @param timeout The function to call when the interval is missed
 */
export default function makeWatchdog(interval: number, timeout: () => void): (nextInterval?: number) => void {
  let handle: NodeJS.Timeout;

  function start(): void {
    handle = setTimeout(timeout, interval);
  }

  /**
   * Prevent timeout event from happening for the next interval
   */
  function clearInterval(nextInterval?: number): void {
    if (nextInterval) interval = nextInterval;
    clearTimeout(handle);
    start();
  }

  return clearInterval;
}
