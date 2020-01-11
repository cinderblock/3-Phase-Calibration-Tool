// Shameless stealing from https://www.johndcook.com/blog/standard_deviation/

interface StatisticalObserver {
  clear: () => void;
  push: (x: number) => void;
  readonly mean: number;
  readonly variance: number;
  readonly standardDeviation: number;
  readonly count: number;
  readonly max: number;
  readonly min: number;
}

export default function makeStatisticalObserver(): StatisticalObserver {
  let oldMean: number;
  let newMean: number;
  let lastStat: number;
  let newStat: number;
  let count = 0;
  let max = -Infinity;
  let min = Infinity;

  function clear(): void {
    count = 0;
  }

  function push(x: number): void {
    count++;

    if (x > max) max = x;
    if (x < min) min = x;

    // See Knuth TAOCP vol 2, 3rd edition, page 232
    if (count == 1) {
      oldMean = newMean = x;
      lastStat = 0.0;
    } else {
      newMean = oldMean + (x - oldMean) / count;
      newStat = lastStat + (x - oldMean) * (x - newMean);

      // set up for next iteration
      oldMean = newMean;
      lastStat = newStat;
    }
  }

  function variance(): number {
    return count > 1 ? newStat / (count - 1) : 0.0;
  }

  return {
    clear,
    push,
    get mean(): number {
      return count > 0 ? newMean : 0.0;
    },
    get variance(): number {
      return variance();
    },
    get standardDeviation(): number {
      return Math.sqrt(variance());
    },
    get count(): number {
      return count;
    },
    get max(): number {
      return max;
    },
    get min(): number {
      return min;
    },
  };
}
