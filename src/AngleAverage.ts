import PositiveModulus from './PositiveModulus';

export default function angleAverage(angles: number[], scale = 2 * Math.PI) {
  var y = angles.reduce(
    (acc, a) => acc + Math.sin((a * 2 * Math.PI) / scale),
    0
  );
  var x = angles.reduce(
    (acc, a) => acc + Math.cos((a * 2 * Math.PI) / scale),
    0
  );

  return PositiveModulus((Math.atan2(y, x) * scale) / (2 * Math.PI), scale);
}
