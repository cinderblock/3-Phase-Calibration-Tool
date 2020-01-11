import { loadavg as osLoadAvg } from 'os';

/**
 * Get the current system load.
 *
 * Load is measure of how much each CPU core is being used. A value of 1 nominally means a whole CPU is being used.
 * Many systems have 4 cores and under high loads numbers greater than 1 are common.
 *
 * A single computation heavy process will only ever use one core and a value of 1 means the process is CPU bottle necked.
 *
 * @returns A 3 value array corresponding to the system load average of the last 1 minute, 5 minutes, and 15 minutes respectively.
 */
export const loadavg = (): [number, number, number] => osLoadAvg() as [number, number, number];
