/**
 * Converts seconds into some short human readable approximation.
 *
 * For instance:
 *
 * 1 => '1.00s'
 * 65 => '65.0s'
 * 200 => '3.3m'
 * 7000 => '1.9h'
 * 140 000 => '2d'
 * @param seconds Number of seconds to convert
 */
export function secondsToHumanReadable(seconds: number): string {
  if (seconds < 0) return '-' + secondsToHumanReadable(-seconds);
  if (seconds < 100) return seconds.toPrecision(3) + 's';
  const minutes = seconds / 60;
  if (minutes < 60) return minutes.toPrecision(2) + 'm';
  const hours = minutes / 60;
  if (hours < 60) return hours.toPrecision(2) + 'h';
  const days = hours / 24;
  return days.toFixed(1) + 'd';
}
