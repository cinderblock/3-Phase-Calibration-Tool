import angleAverage from './AngleAverage';
import PositiveModulus from './PositiveModulus';

export default function processData(
  forward: number[],
  reverse: number[],
  modulus: number
) {
  function smoothNeighborhoodCircular(value: number, i: number, arr: number[]) {
    const minWidth = 5;
    const minPoints = 4;

    var neighborhood: number[] = [];

    var j = 0;

    do {
      neighborhood = neighborhood.concat(
        arr[PositiveModulus(i - j, arr.length)],
        arr[PositiveModulus(i + j, arr.length)]
      );
      j++;
    } while (j <= minWidth || neighborhood.length < minPoints);

    return angleAverage(neighborhood, modulus);
  }

  const forwardFits = forward.map(smoothNeighborhoodCircular);
  const reverseFits = reverse.map(smoothNeighborhoodCircular);

  const middle = forwardFits.map((v, i) =>
    angleAverage([v, reverseFits[i]], modulus)
  );

  return { forward, forwardFits, reverse, reverseFits, middle };
}
