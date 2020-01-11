export default function ExponentialFilter(lambda: number): (value: number) => number {
  let current: number;

  return function feed(value: number): number {
    // Coerce to Number
    const num = Number(value);

    // Invalid value checking
    if (!isFinite(num)) {
      throw new Error('Non finite argument: ' + value);
    }

    if (current === undefined) {
      return (current = num);
    }

    return (current = lambda * num + (1 - lambda) * current);
  };
}
