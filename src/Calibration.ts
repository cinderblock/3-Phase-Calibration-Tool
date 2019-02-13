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

    let neighborhood: number[] = [];

    let j = 0;

    do {
      neighborhood = neighborhood.concat(
        arr[PositiveModulus(i - j, arr.length)],
        arr[PositiveModulus(i + j, arr.length)]
      );
      j++;
    } while (j <= minWidth || neighborhood.length < minPoints);

    return average(neighborhood);
  }

  const forward = forwardData.map(smoothNeighborhoodCircular);
  const reverse = reverseData.map(smoothNeighborhoodCircular);

  const middle = forward.map((v, i) => average([v, reverse[i]]));

  const inverses: (number[] | undefined)[] = [];

  for (let i = 0; i < middle.length; i++) {
    const mlxValue = Math.round(middle[i]) % (1 << 14);

    const angle = i % countsPerMechanicalRevolution;

    let t;
    if ((t = inverses[mlxValue])) t.push(angle);
    else inverses[mlxValue] = [angle];
  }

  const inverseTable: number[] = [];

  // Only generate 12-bit inverted lookup table (of 14)
  for (let i = 0; i < 2 ** 12; i++) {
    const minWidth = 3;
    const minPoints = middle.length / countsPerMechanicalRevolution;

    let neighborhood: number[] = inverses[i * 4] || [];

    for (let j = 1; j <= minWidth || neighborhood.length < minPoints; j++) {
      neighborhood = neighborhood.concat(
        // Inverses were stored in original 14-bit values
        inverses[PositiveModulus(i * 4 - j, 2 ** 14)] || [],
        inverses[PositiveModulus(i * 4 + j, 2 ** 14)] || []
      );
    }

    inverseTable[i] =
      Math.round(angleAverage(neighborhood, countsPerMechanicalRevolution)) %
      countsPerMechanicalRevolution;
  }

  return { forward, reverse, middle, forwardData, reverseData, inverseTable };
}
