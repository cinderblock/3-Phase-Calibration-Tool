import makeIntegrator from './makeIntegrator';
import { Filter } from './FilterInterface';
import { PIDConstants } from '../../renderer-shared-types/utils/PIDTypes';

export default function makePIDController({ kP, kI, kD }: PIDConstants): Filter & PIDConstants {
  let last: number | undefined;
  const int = makeIntegrator();

  /**
   * Feed the next error signal into PID
   * @param err The signal we're servo-ing to zero
   */
  function feed(err: number): number {
    // Invalid value checking
    if (!isFinite(err)) {
      throw new RangeError('Got invalid Number(s) in PIDController: ' + err);
    }

    if (last === undefined) last = err;

    const ret = kP * err + kI * int.feed(err) + kD * (last - err);

    last = err;

    return ret;
  }

  /**
   * Reset internals to initial state
   */
  function reset(): void {
    last = undefined;
    int.reset();
  }

  return {
    feed,
    reset,

    set kP(v: number) {
      kP = v;
    },
    set kI(v: number) {
      kI = v;
    },
    set kD(v: number) {
      kD = v;
    },
    get kP(): number {
      return kP;
    },
    get kI(): number {
      return kI;
    },
    get kD(): number {
      return kD;
    },
  };
}
