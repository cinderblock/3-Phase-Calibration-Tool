export function forEachPID<T>(func: (constant: keyof PIDConstants) => T): PIDConstants<T> {
  return { kP: func('kP'), kI: func('kI'), kD: func('kD') };
}

export function mapPID<T, R>(o: PIDConstants<T>, func: (v: T, constant: keyof PIDConstants) => R): PIDConstants<R> {
  return forEachPID(constant => func(o[constant], constant));
}

export type PIDConstants<T = number> = {
  kP: T;
  kI: T;
  kD: T;
};

export type PIDs = keyof PIDConstants;
