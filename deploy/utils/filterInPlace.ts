export function filterInPlace<T>(
  a: T[],
  condition: (element: T, index: number, arr: T[]) => boolean,
  thisArg?: Record<string, T>,
): T[] {
  let j = 0;

  // Iterate through the array
  for (let i = 0; i < a.length; i++) {
    const element = a[i];

    // Check each element
    if (!condition.call(thisArg, element, i, a)) continue;

    // Move the one we just matched unless it's already in its correct place
    if (i !== j) a[j] = element;

    // That element passed the filter
    j++;
  }

  // Truncate the array
  a.length = j;

  return a;
}
