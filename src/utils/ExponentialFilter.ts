export default function ExponentialFilter(lambda: number) {
  // TODO: could check lambda range
  let current: number;

  return function feed(value: number) {
    // Coerce to Number
    const num = Number(value);

    // Invalid value checking
    if (!isFinite(num)) {
      throw 'Got invalid Number in ExponentialFilter:' + value;
    }

    if (current === undefined) {
      current = num;
    } else {
      current = lambda * num + (1 - lambda) * current;
    }

    return current;
  };
}
