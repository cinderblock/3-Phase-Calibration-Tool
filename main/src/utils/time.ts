const startTime = process.hrtime();

/**
 * High resolution number of seconds since start of execution
 */
export function uptimeSeconds(): number {
  // get time (in [sec,nSec]) relative to startTime
  const timeHR = process.hrtime(startTime);
  // Convert to seconds, loosing some precision likely
  return timeHR[0] + timeHR[1] / 1e9;
}

/**
 * Convert a number into a printable string with leading zeros up to a fixed length
 * @param number Number to print
 * @param digits Number of digits to pad with leading zeros to
 */
function padDigits(number: number, digits: number): string {
  return Array(Math.max(digits - String(number).length + 1, 0)).join('0') + number;
}

/**
 * Convert a Date into a ISO formatted string in the current time zone
 *
 * from https://stackoverflow.com/a/18906013/4612476
 * @param date Date to print
 */
export function getISOStringLocal(date: Date): string {
  let offsetMinutes = date.getTimezoneOffset();

  let timezone = 'Z';

  if (offsetMinutes) {
    const negative = offsetMinutes > 0;

    // getTimezoneOffset returns 480 for GMT-08:00
    if (!negative) {
      offsetMinutes *= -1;
    }

    const offsetHours = Math.floor(offsetMinutes / 60);
    offsetMinutes %= 60;

    timezone = (negative ? '-' : '+') + padDigits(offsetHours, 2) + ':' + padDigits(offsetMinutes, 2);
  }

  return (
    date.getFullYear() +
    '-' +
    padDigits(date.getMonth() + 1, 2) +
    '-' +
    padDigits(date.getDate(), 2) +
    'T' +
    padDigits(date.getHours(), 2) +
    ':' +
    padDigits(date.getMinutes(), 2) +
    ':' +
    padDigits(date.getSeconds(), 2) +
    '.' +
    padDigits(date.getMilliseconds(), 2) +
    timezone
  );
}

/**
 * Convert a number of seconds into a human readable approximation of that time
 *
 * @param seconds Number of seconds
 */
export function secondsToHumanReadable(seconds: number): string {
  if (seconds < 0) return '-' + secondsToHumanReadable(-seconds);
  if (seconds < 100) return seconds.toPrecision(2) + 's';
  const minutes = seconds / 60;
  if (minutes < 60) return minutes.toPrecision(2) + 'm';
  const hours = minutes / 60;
  if (hours < 60) return hours.toPrecision(2) + 'h';
  const days = hours / 24;
  return days.toFixed(1) + 'd';
}
