import CircularRange from '../utils/CircularRange';
import { clampRange } from '../utils/filters/clampRange';

export interface CountConverters {
  /**
   * Convert to logical position from motor counts, with a zero shift
   * @param counts Motor counts in range [0, motorCountsPerRevolution). Values outside this range will be normalized.
   */
  countsToPosition(counts: number): number;

  /**
   * Convert from logical position to motor counts with a zero shift
   * @param pos Motor position in range [-1, 1]. Values outside this range will be clamped
   */
  positionToCounts(pos: number): number;
}

export function makeCountConverter(motorCountsPerRevolution: number, zero: number): CountConverters {
  const motorCountsRange = CircularRange(motorCountsPerRevolution);

  function countsToPosition(counts: number): number {
    counts -= zero;
    counts = motorCountsRange.normalizeHalf(counts);
    counts /= motorCountsPerRevolution;
    counts *= 4;

    return counts;
  }

  function positionToCounts(pos: number): number {
    // Limit to [-1, 1]
    pos = clampRange(pos, 1);

    pos /= 4;
    pos *= motorCountsPerRevolution;
    pos += zero;

    pos = motorCountsRange.normalize(pos);

    return pos;
  }

  return { countsToPosition, positionToCounts };
}
