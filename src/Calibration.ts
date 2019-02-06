import angleAverage from './AngleAverage';
import PositiveModulus from './PositiveModulus';

export default function processData(
  forwardData: number[],
  reverseData: number[],
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

  const forward = forwardData.map(smoothNeighborhoodCircular);
  const reverse = reverseData.map(smoothNeighborhoodCircular);

  const middle = forward.map((v, i) => angleAverage([v, reverse[i]], modulus));

  const inverseTable: number[] = [];

  for (let i = 0; i < 2 ** 12; i++)
    inverseTable[i] = PositiveModulus(
      Math.round(smoothNeighborhoodCircular(0, i * 4, middle)),
      modulus
    );

  return { forward, reverse, middle, forwardData, reverseData, inverseTable };
}
