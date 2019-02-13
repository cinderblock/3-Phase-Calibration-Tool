import angleAverage from './AngleAverage';
import PositiveModulus from './PositiveModulus';

export default function processData(
  forwardData: number[],
  reverseData: number[],
  countsPerMechanicalRevolution: number
) {
  function average(angles: number[]) {
    return angleAverage(angles, 1 << 14);
  }

  // Helper function
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

    return average(neighborhood);
  }

  // Smooth the
  const forward = forwardData.map(smoothNeighborhoodCircular);
  const reverse = reverseData.map(smoothNeighborhoodCircular);

  // TODO: This is not quite the right average. We want to find the middle in x not y. Close enough.
  const middle = forward.map((v, i) => average([v, reverse[i]]));

  const inverseTable: number[] = [];

  // Only generate 12-bit lookup table (of 14)
  for (let i = 0; i < 2 ** 12; i++)
    inverseTable[i] = PositiveModulus(
      // Get the
      Math.round(smoothNeighborhoodCircular(0, i * 4, middle)),
      countsPerMechanicalRevolution
    );

  return { forward, reverse, middle, forwardData, reverseData, inverseTable };
}
